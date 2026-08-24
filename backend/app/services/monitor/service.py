"""Realtime мониторингийн үйлчилгээ (Step 7).

Pipeline (архитектурын дараалал хэвээр):
    Forex API → 5M/15M candle-close илрүүлэлт → Indicators →
    Deterministic Signal Engine → Signal өөрчлөлтийн илрүүлэлт →
    ├ Dashboard (SSE)  ├ Browser (клиент тал)  ├ Telegram  └ Qwen тайлбар

Гол зарчмууд:
  • Tick бүрд биш, ЗӨВХӨН candle хаагдахад л signal тооцоологдоно
    (5M хаагдахад — 5M шинэчилнэ; 15M хаагдахад — 15M шинэчилнэ).
  • Одоогийн үнэ (quote) тусдаа, удаан давтамжтай poll-логдоно.
  • Хаагдаагүй (формилогдож буй) лааг signal-д ХЭЗЭЭ Ч ашиглахгүй —
    look-ahead bias-гүй.
  • Signal-ийн ЧИГЛЭЛ өөрчлөгдөхөд л alert үүснэ; онооны жижиг
    хэлбэлзэл (78→79) duplicate alert үүсгэхгүй.
  • Эхний тооцоолол бол зөвхөн baseline — restart/reconnect үед
    хуурамч alert гарахгүй.
  • Telegram/Qwen-ийн алдаа мониторингийг зогсоохгүй.
"""

from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from typing import Any

from app.core.config import Settings
from app.core.errors import MarketDataError, TelegramError
from app.schemas.alerts import AlertRecord, StreamEvent
from app.schemas.market import Candle, Interval
from app.schemas.signal import SignalDirection, SignalResponse
from app.services.ai.explainer import ExplanationService
from app.services.alerts.store import InMemoryAlertStore
from app.services.alerts.telegram import TelegramNotifier
from app.services.analysis.scoring import compute_signal
from app.services.analysis.service import (
    FETCH_15M,
    FETCH_5M,
    MIN_CANDLES_15M,
    MIN_CANDLES_5M,
    candles_to_snapshot,
)
from app.services.market_data.service import MarketDataService
from app.services.market_data.symbols import get_pair, supported_symbols
from app.services.monitor.broadcaster import Broadcaster

logger = logging.getLogger("forex_analyzer.monitor")

_DT_MIN = datetime.min.replace(tzinfo=timezone.utc)


# ---------- цэвэр туслагч функцууд (unit-тестэд шууд шалгагдана) ----------


def floor_ts(dt: datetime, interval_s: int) -> datetime:
    """UTC timestamp-ийг interval-ын хилд доош бүхэлчилнэ."""
    ts = int(dt.timestamp())
    return datetime.fromtimestamp(ts - ts % interval_s, tz=timezone.utc)


def last_closed_candle_ts(now: datetime, interval_s: int) -> datetime:
    """Одоогоор хаагдсан хамгийн сүүлийн лааны timestamp."""
    return floor_ts(now, interval_s) - timedelta(seconds=interval_s)


def has_new_closed_candle(now: datetime, last_processed: datetime, interval_s: int) -> tuple[bool, datetime]:
    """Шинэ лаан хаагдсан эсэх + түүний timestamp."""
    closed = last_closed_candle_ts(now, interval_s)
    return closed > last_processed, closed


def should_alert(previous: SignalDirection | None, current: SignalDirection) -> bool:
    """Alert зөвхөн чиглэл өөрчлөгдөхөд; baseline (None) ба давталт үгүй."""
    return previous is not None and previous is not current


def keep_closed_only(candles: list[Candle], closed_ts: datetime) -> list[Candle]:
    """Формилогдож буй (хаагдаагүй) лаануудыг хасна — look-ahead bias хаалт."""
    return [c for c in candles if c.timestamp <= closed_ts]


# ---------- үндсэн сервис ----------


@dataclass
class MonitorService:
    """Бүх дэмжигдэх pair-уудыг ажиглаж, candle-close дээр signal тооцно."""

    market: MarketDataService
    store: InMemoryAlertStore
    broadcaster: Broadcaster
    settings: Settings
    explainer: ExplanationService
    telegram: TelegramNotifier | None = None

    # pair бүрийн төлөв
    _last_5m: dict[str, datetime] = field(default_factory=dict)
    _last_15m: dict[str, datetime] = field(default_factory=dict)
    _cached_15m: dict[str, list[Candle]] = field(default_factory=dict)
    _last_signal: dict[str, SignalDirection] = field(default_factory=dict)
    _last_signals: dict[str, SignalResponse] = field(default_factory=dict)
    _last_quote_poll: dict[str, datetime] = field(default_factory=dict)

    def pairs(self) -> list[str]:
        """Монитор хийх pair-ууд — тохиргоогоор нэмж/хасаж болно."""
        raw = self.settings.monitor_pairs.strip()
        if raw:
            wanted = [p.strip().upper() for p in raw.split(",") if p.strip()]
            return [p for p in wanted if get_pair(p) is not None]
        return supported_symbols()

    def snapshot(self) -> dict[str, Any]:
        """SSE холболтын эхэнд клиент рүү илгээх одоогийн төлөв."""
        return {
            "monitoring": True,
            "pairs": self.pairs(),
            "signals": {s: sig.model_dump(mode="json") for s, sig in self._last_signals.items()},
            "alerts": [a.model_dump(mode="json") for a in self.store.history(limit=20)],
        }

    # ---------- үндсэн loop ----------

    async def run(self) -> None:
        """Хязгааргүй мониторинг loop — lifespan-д task болгон эхлүүлнэ."""
        pairs = self.pairs()
        logger.info("Мониторинг эхэлж байна: %s", ", ".join(pairs))
        await self._broadcast_status("running", f"monitoring {len(pairs)} pairs")

        while True:
            loop_start = asyncio.get_running_loop().time()
            failures = 0
            for symbol in pairs:
                now = datetime.now(timezone.utc)
                try:
                    await self._process_pair(symbol, now)
                except MarketDataError as exc:
                    failures += 1
                    logger.warning("monitor %s market алдаа: %s", symbol, exc.message)
                    await self._broadcast_status("degraded", f"{symbol}: {exc.message}")
                except Exception:  # noqa: BLE001 — мониторинг хэзээ ч зогсохгүй
                    failures += 1
                    logger.exception("monitor %s боловсруулагдаагүй алдаа", symbol)
                await asyncio.sleep(self.settings.monitor_stagger_s)

            elapsed = asyncio.get_running_loop().time() - loop_start
            delay = max(0.0, self.settings.monitor_tick_s - elapsed)
            if failures == len(pairs) and pairs:
                # Бүх pair амжилтгүй → exponential backoff (60с хүртэл)
                backoff = min(60.0, self.settings.monitor_tick_s * (2 ** min(failures, 4)))
                logger.error("Бүх pair амжилтгүй — %0.1fс хүлээж байна", backoff)
                await asyncio.sleep(backoff)
            else:
                await asyncio.sleep(delay)

    # ---------- pair боловсруулалт ----------

    async def _process_pair(self, symbol: str, now: datetime) -> None:
        """Нэг pair: quote poll → 15M close → 5M close → signal."""
        pair = get_pair(symbol)
        if pair is None:
            return

        # 1) Одоогийн үнэ — удаан давтамжтай (signal-д нөлөөлөхгүй)
        await self._maybe_poll_quote(symbol, now)

        # 2) 15M лаан хаагдсан бол шинэчилнэ (trend confirmation)
        new15, closed15 = has_new_closed_candle(now, self._last_15m.get(symbol, _DT_MIN), Interval.M15.seconds)
        if new15:
            candles = await self.market.get_candles(symbol, Interval.M15, FETCH_15M)
            closed_only = keep_closed_only(candles.candles, closed15)
            if len(closed_only) >= MIN_CANDLES_15M:
                self._cached_15m[symbol] = closed_only
                self._last_15m[symbol] = closed15
                logger.info("%s: 15M лаан хаагдлаа (%s)", symbol, closed15.isoformat())

        # 3) 5M лаан хаагдсан бол signal тооцоолно (entry timing)
        new5, closed5 = has_new_closed_candle(now, self._last_5m.get(symbol, _DT_MIN), Interval.M5.seconds)
        if not new5:
            return  # шинэ лаан үгүй → API дуудлага үгүй, signal тооцоо үгүй

        candles5 = await self.market.get_candles(symbol, Interval.M5, FETCH_5M)
        closed5_only = keep_closed_only(candles5.candles, closed5)
        self._last_5m[symbol] = closed5
        cached15 = self._cached_15m.get(symbol)
        if len(closed5_only) < MIN_CANDLES_5M or cached15 is None:
            logger.warning("%s: 5M/15M өгөгдөл хангалтгүй — signal тооцсонгүй", symbol)
            return

        logger.info("%s: 5M лаан хаагдлаа (%s) → signal тооцоолж байна", symbol, closed5.isoformat())
        s5 = candles_to_snapshot(closed5_only, "5m", MIN_CANDLES_5M)
        s15 = candles_to_snapshot(cached15, "15m", MIN_CANDLES_15M)
        signal = compute_signal(symbol, s5, s15, pair.pip_decimals)

        previous = self._last_signal.get(symbol)
        changed = should_alert(previous, signal.signal)
        self._last_signal[symbol] = signal.signal
        self._last_signals[symbol] = signal

        await self.broadcaster.broadcast(
            StreamEvent(type="signal", payload={**signal.model_dump(mode="json"), "changed": changed})
        )

        if changed:
            await self._on_signal_change(signal)

    async def _maybe_poll_quote(self, symbol: str, now: datetime) -> None:
        last = self._last_quote_poll.get(symbol)
        if last is not None and (now - last).total_seconds() < self.settings.quote_poll_s:
            return
        quote = await self.market.get_quote(symbol)
        self._last_quote_poll[symbol] = now
        await self.broadcaster.broadcast(StreamEvent(type="price", payload=quote.model_dump(mode="json")))

    # ---------- signal өөрчлөлт → alert + notify + AI ----------

    async def _on_signal_change(self, signal: SignalResponse) -> None:
        """Чиглэл өөрчлөгдлөө: alert бичих → Telegram → Qwen тайлбар → broadcast.

        Ямар ч алхам амжилтгүй болсон ч дараагийнх нь үргэлжилнэ.
        """
        settings = self.store.get_settings()
        if not settings.allows(signal.signal):
            logger.info("%s %s alert тохиргоогоор дарангуйлагдлаа", signal.symbol, signal.signal.value)
            return

        record = AlertRecord(
            id=self.store.next_id(),
            symbol=signal.symbol,
            signal=signal.signal,
            confidence=signal.confidence,
            buy_score=signal.buy_score,
            sell_score=signal.sell_score,
            wait_score=signal.wait_score,
            entry=signal.entry,
            stop_loss=signal.stop_loss,
            take_profit=signal.take_profit,
            risk_reward=signal.risk_reward,
            reasons=signal.reasons,
        )

        # Telegram — server-side, алдаа нь зогсоохгүй
        if self.telegram is not None and self.telegram.configured and settings.telegram_enabled:
            try:
                await self.telegram.send_alert(record)
                record.telegram_notification_sent = True
            except TelegramError as exc:
                logger.warning("Telegram илгээлт амжилтгүй (#%d): %s", record.id, exc.message)

        self.store.add(record)

        # Qwen тайлбар — ЗӨВХӨН signal өөрчлөгдөхөд, tick бүр биш
        explanation = None
        ai_status = "disabled"
        ai_message = "AI тайлбар идэвхжээгүй"
        if self.settings.ai_on_signal_change:
            explanation, ai_status, ai_message = await self.explainer.explain(signal)

        await self.broadcaster.broadcast(
            StreamEvent(
                type="alert",
                payload={
                    **record.model_dump(mode="json"),
                    "explanation": explanation.model_dump(mode="json") if explanation else None,
                    "ai_status": ai_status,
                    "ai_message": ai_message,
                },
            )
        )

    # ---------- бусад ----------

    async def _broadcast_status(self, state: str, message: str) -> None:
        await self.broadcaster.broadcast(
            StreamEvent(
                type="status",
                payload={
                    "state": state,
                    "message": message,
                    "pairs": self.pairs(),
                    "subscribers": self.broadcaster.subscriber_count,
                },
            )
        )

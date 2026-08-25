"""Step 7 — Realtime monitor тестүүд.

Хамрах хүрээ:
  • Цэвэр туслагч: floor_ts / last_closed_candle_ts / has_new_closed_candle /
    should_alert / keep_closed_only
  • 5M / 15M candle-close илрүүлэлт (шинэ лаангүй бол API дуудлага үгүй)
  • Signal өөрчлөлт → alert; давхар signal (BUY→BUY) → alert үгүй
  • Telegram амжилт / алдаа үед alert хэвээр
  • Qwen unavailable үед alert үүсэж, мониторинг үргэлжилнө
  • Forex API алдааг process_pair дамжуулна (run() барьж авч үргэлжилнэ)
  • Monitor нь production signal engine-ийг шууд ашиглана
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

import pytest

from app.core.config import Settings
from app.core.errors import MarketDataError, ProviderUnavailableError, TelegramSendError
from app.schemas.alerts import AlertRecord
from app.schemas.market import Candle, CandlesResponse, Interval, QuoteResponse
from app.schemas.signal import (
    MacdState,
    SignalDirection,
    TimeframeAnalysis,
    TrendState,
)
from app.schemas.signal import SignalResponse
from app.services.alerts.store import InMemoryAlertStore
from app.services.analysis import scoring as scoring_module
from app.services.monitor import service as monitor_module
from app.services.monitor.broadcaster import Broadcaster
from app.services.monitor.service import (
    MonitorService,
    floor_ts,
    has_new_closed_candle,
    keep_closed_only,
    last_closed_candle_ts,
    should_alert,
)

T0 = datetime(2026, 1, 5, 10, 0, tzinfo=timezone.utc)


# ---------- цэвэр туслагч функцууд ----------


def test_floor_ts_aligns_to_boundary() -> None:
    dt = T0 + timedelta(seconds=137)  # 10:02:17
    assert floor_ts(dt, 300) == T0
    assert floor_ts(dt, 900) == T0 - timedelta(minutes=15) + timedelta(minutes=15)  # 10:00
    assert floor_ts(T0 + timedelta(minutes=16), 900) == T0 + timedelta(minutes=15)


def test_last_closed_candle_ts() -> None:
    # 10:05:01 → сүүлд хаагдсан 5M лаан = 10:00
    now = T0 + timedelta(minutes=5, seconds=1)
    assert last_closed_candle_ts(now, 300) == T0
    assert last_closed_candle_ts(now, 900) == T0 - timedelta(minutes=15)


def test_has_new_closed_candle() -> None:
    now = T0 + timedelta(minutes=5, seconds=1)
    # өмнө нь 09:55 боловсруулсан → 10:00 шинэ
    ok, closed = has_new_closed_candle(now, T0 - timedelta(minutes=5), 300)
    assert ok and closed == T0
    # өмнө нь 10:00 боловсруулсан → шинэ биш
    ok, _ = has_new_closed_candle(now, T0, 300)
    assert not ok


def test_should_alert_only_on_direction_change() -> None:
    assert should_alert(None, SignalDirection.BUY) is False  # baseline
    assert should_alert(SignalDirection.BUY, SignalDirection.BUY) is False  # давталт
    assert should_alert(SignalDirection.BUY, SignalDirection.SELL) is True
    assert should_alert(SignalDirection.WAIT, SignalDirection.BUY) is True
    assert should_alert(SignalDirection.SELL, SignalDirection.WAIT) is True


def test_keep_closed_only_drops_forming_candle() -> None:
    candles = [
        Candle(timestamp=T0, open=1, high=2, low=0.5, close=1.5),
        Candle(timestamp=T0 + timedelta(minutes=5), open=1, high=2, low=0.5, close=1.5),  # формилогдож буй
    ]
    kept = keep_closed_only(candles, T0)
    assert len(kept) == 1 and kept[0].timestamp == T0


# ---------- тестийн doubles ----------


def flat_candles(n: int, minutes: int, end: datetime, base: float = 1.17) -> list[Candle]:
    out: list[Candle] = []
    for i in range(n):
        ts = end - timedelta(minutes=minutes * (n - 1 - i))
        o = base
        c = base + 0.00001
        out.append(Candle(timestamp=ts, open=o, high=c + 0.00002, low=o - 0.00002, close=c))
    return out


class FakeMarket:
    """now-д тулгуурлан яг хаагдсан лаан хүртэлх цуваа буцаана."""

    def __init__(self, n: int = 80, fail: bool = False) -> None:
        self.n = n
        self.now: datetime = T0
        self.fail = fail
        self.calls_5m = 0
        self.calls_15m = 0
        self.calls_quote = 0

    async def get_candles(self, symbol: str, interval: Interval, outputsize: int) -> CandlesResponse:
        if self.fail:
            raise ProviderUnavailableError("Forex API хүрэхгүй байна")
        secs = interval.seconds
        if interval is Interval.M5:
            self.calls_5m += 1
        else:
            self.calls_15m += 1
        closed = last_closed_candle_ts(self.now, secs)
        candles = flat_candles(self.n, secs // 60, closed)
        return CandlesResponse(symbol=symbol, interval=interval, count=len(candles), source="sample", candles=candles)

    async def get_quote(self, symbol: str) -> QuoteResponse:
        self.calls_quote += 1
        return QuoteResponse(
            symbol=symbol, price=1.17, bid=1.16999, ask=1.17001, spread=0.00002,
            timestamp=self.now, source="sample",
        )


class FakeBroadcaster:
    def __init__(self) -> None:
        self.events: list = []

    async def broadcast(self, event) -> None:
        self.events.append(event)

    @property
    def subscriber_count(self) -> int:
        return 0


class FakeTelegram:
    def __init__(self, fail: bool = False) -> None:
        self.configured = True
        self.fail = fail
        self.sent: list[AlertRecord] = []

    async def send_alert(self, alert: AlertRecord) -> None:
        if self.fail:
            raise TelegramSendError("Telegram алдаа")
        self.sent.append(alert)


class FakeExplainer:
    def __init__(self, status: str = "disabled") -> None:
        self.status = status
        self.calls = 0

    async def explain(self, signal: SignalResponse):
        self.calls += 1
        return None, self.status, f"AI {self.status}"


def tf(trend: TrendState) -> TimeframeAnalysis:
    return TimeframeAnalysis(
        trend=trend, rsi=55.0, macd=MacdState.BULLISH, ema20=1.169, ema50=1.168,
        atr=0.0006, support=1.165, resistance=1.175,
    )


def make_signal(direction: SignalDirection) -> SignalResponse:
    if direction is SignalDirection.WAIT:
        return SignalResponse(
            symbol="EUR/USD", signal=direction, buy_score=40, sell_score=40, wait_score=20,
            confidence=40, timeframes={"5m": tf(TrendState.NEUTRAL), "15m": tf(TrendState.NEUTRAL)},
            reasons=[], warnings=[],
        )
    buy = direction is SignalDirection.BUY
    return SignalResponse(
        symbol="EUR/USD", signal=direction,
        buy_score=78 if buy else 12, sell_score=12 if buy else 78, wait_score=10,
        confidence=78, entry=1.17, stop_loss=1.1685, take_profit=1.173, risk_reward=2.0,
        timeframes={"5m": tf(TrendState.BULLISH if buy else TrendState.BEARISH),
                    "15m": tf(TrendState.BULLISH if buy else TrendState.BEARISH)},
        reasons=["15M bullish trend", "MACD bullish"], warnings=[],
    )


def build_monitor(
    market: FakeMarket,
    directions: list[SignalDirection],
    telegram: FakeTelegram | None = None,
    explainer_status: str = "disabled",
) -> tuple[MonitorService, FakeBroadcaster, InMemoryAlertStore, FakeExplainer]:
    store = InMemoryAlertStore()
    broadcaster = FakeBroadcaster()
    explainer = FakeExplainer(explainer_status)
    seq = iter(directions)

    def fake_compute(symbol, s5, s15, pip_decimals):
        return make_signal(next(seq))

    settings = Settings(monitor_pairs="EUR/USD", quote_poll_s=3600, ai_on_signal_change=True)
    monitor = MonitorService(
        market=market, store=store, broadcaster=broadcaster, settings=settings,
        explainer=explainer, telegram=telegram,
    )
    # production engine-ийн дуудлагыг kontrol-дсон чиглэлээр сольно
    object.__setattr__(monitor, "_fake_compute", fake_compute)
    return monitor, broadcaster, store, explainer


# ---------- интеграци тестүүд ----------


@pytest.mark.asyncio
async def test_baseline_no_alert(monkeypatch: pytest.MonkeyPatch) -> None:
    market = FakeMarket()
    monitor, bc, store, _ = build_monitor(market, [SignalDirection.BUY])
    monkeypatch.setattr(monitor_module, "compute_signal", monitor._fake_compute)

    now = T0 + timedelta(minutes=5, seconds=1)
    market.now = now
    await monitor._process_pair("EUR/USD", now)

    signals = [e for e in bc.events if e.type == "signal"]
    alerts = [e for e in bc.events if e.type == "alert"]
    assert len(signals) == 1 and signals[0].payload["changed"] is False
    assert len(alerts) == 0  # baseline alert үүсгэхгүй
    assert store.history() == []


@pytest.mark.asyncio
async def test_no_recompute_within_same_candle(monkeypatch: pytest.MonkeyPatch) -> None:
    market = FakeMarket()
    monitor, bc, _, _ = build_monitor(market, [SignalDirection.BUY])
    monkeypatch.setattr(monitor_module, "compute_signal", monitor._fake_compute)

    now = T0 + timedelta(minutes=5, seconds=1)
    market.now = now
    await monitor._process_pair("EUR/USD", now)
    calls_after_first = market.calls_5m

    # ижил лаан дотор дахин дуудахад шинэ тооцоо үгүй
    await monitor._process_pair("EUR/USD", now + timedelta(seconds=30))
    assert market.calls_5m == calls_after_first


@pytest.mark.asyncio
async def test_duplicate_signal_no_alert(monkeypatch: pytest.MonkeyPatch) -> None:
    market = FakeMarket()
    # BUY (baseline) → BUY (давталт) → alert үгүй
    monitor, bc, store, _ = build_monitor(market, [SignalDirection.BUY, SignalDirection.BUY])
    monkeypatch.setattr(monitor_module, "compute_signal", monitor._fake_compute)

    now1 = T0 + timedelta(minutes=5, seconds=1)
    market.now = now1
    await monitor._process_pair("EUR/USD", now1)

    now2 = T0 + timedelta(minutes=10, seconds=1)  # дараагийн 5M лаан
    market.now = now2
    await monitor._process_pair("EUR/USD", now2)

    assert [e for e in bc.events if e.type == "alert"] == []
    assert store.history() == []
    changed_flags = [e.payload["changed"] for e in bc.events if e.type == "signal"]
    assert changed_flags == [False, False]


@pytest.mark.asyncio
async def test_direction_change_creates_alert_with_telegram(monkeypatch: pytest.MonkeyPatch) -> None:
    market = FakeMarket()
    telegram = FakeTelegram()
    monitor, bc, store, expl = build_monitor(
        market, [SignalDirection.BUY, SignalDirection.SELL], telegram=telegram
    )
    monkeypatch.setattr(monitor_module, "compute_signal", monitor._fake_compute)

    now1 = T0 + timedelta(minutes=5, seconds=1)
    market.now = now1
    await monitor._process_pair("EUR/USD", now1)  # baseline BUY

    now2 = T0 + timedelta(minutes=10, seconds=1)  # BUY → SELL
    market.now = now2
    await monitor._process_pair("EUR/USD", now2)

    alerts = [e for e in bc.events if e.type == "alert"]
    assert len(alerts) == 1
    payload = alerts[0].payload
    assert payload["signal"] == "SELL"
    assert payload["telegram_notification_sent"] is True
    assert len(telegram.sent) == 1
    assert store.history()[0].signal is SignalDirection.SELL
    assert expl.calls == 1  # Qwen зөвхөн өөрчлөлтөд дуудагдана


@pytest.mark.asyncio
async def test_telegram_failure_still_records_alert(monkeypatch: pytest.MonkeyPatch) -> None:
    market = FakeMarket()
    telegram = FakeTelegram(fail=True)
    monitor, bc, store, _ = build_monitor(
        market, [SignalDirection.WAIT, SignalDirection.BUY], telegram=telegram
    )
    monkeypatch.setattr(monitor_module, "compute_signal", monitor._fake_compute)

    now1 = T0 + timedelta(minutes=5, seconds=1)
    market.now = now1
    await monitor._process_pair("EUR/USD", now1)

    now2 = T0 + timedelta(minutes=10, seconds=1)
    market.now = now2
    await monitor._process_pair("EUR/USD", now2)

    record = store.history()[0]
    assert record.signal is SignalDirection.BUY
    assert record.telegram_notification_sent is False  # илгээлт амжилтгүй ч alert хэвээр
    assert len([e for e in bc.events if e.type == "alert"]) == 1


@pytest.mark.asyncio
async def test_qwen_unavailable_monitoring_continues(monkeypatch: pytest.MonkeyPatch) -> None:
    market = FakeMarket()
    monitor, bc, store, expl = build_monitor(
        market, [SignalDirection.BUY, SignalDirection.SELL], explainer_status="unavailable"
    )
    monkeypatch.setattr(monitor_module, "compute_signal", monitor._fake_compute)

    now1 = T0 + timedelta(minutes=5, seconds=1)
    market.now = now1
    await monitor._process_pair("EUR/USD", now1)
    now2 = T0 + timedelta(minutes=10, seconds=1)
    market.now = now2
    await monitor._process_pair("EUR/USD", now2)

    alert = [e for e in bc.events if e.type == "alert"][0]
    assert alert.payload["ai_status"] == "unavailable"
    assert alert.payload["explanation"] is None
    assert store.history()[0].signal is SignalDirection.SELL  # alert үүссэн хэвээр


@pytest.mark.asyncio
async def test_settings_disable_direction_suppresses_alert(monkeypatch: pytest.MonkeyPatch) -> None:
    market = FakeMarket()
    monitor, bc, store, _ = build_monitor(market, [SignalDirection.BUY, SignalDirection.SELL])
    monkeypatch.setattr(monitor_module, "compute_signal", monitor._fake_compute)
    # SELL alert-ийг тохиргоогоор дарангуйлна
    monitor.store.update_settings(store.get_settings().model_copy(update={"sell_enabled": False}))

    now1 = T0 + timedelta(minutes=5, seconds=1)
    market.now = now1
    await monitor._process_pair("EUR/USD", now1)
    now2 = T0 + timedelta(minutes=10, seconds=1)
    market.now = now2
    await monitor._process_pair("EUR/USD", now2)

    assert [e for e in bc.events if e.type == "alert"] == []
    assert store.history() == []


@pytest.mark.asyncio
async def test_forex_api_unavailable_propagates(monkeypatch: pytest.MonkeyPatch) -> None:
    market = FakeMarket(fail=True)
    monitor, _, _, _ = build_monitor(market, [SignalDirection.BUY])
    monkeypatch.setattr(monitor_module, "compute_signal", monitor._fake_compute)

    now = T0 + timedelta(minutes=5, seconds=1)
    market.now = now
    with pytest.raises(MarketDataError):
        await monitor._process_pair("EUR/USD", now)


def test_monitor_uses_production_signal_engine() -> None:
    """Monitor нь scoring-ийн production compute_signal-ийг шууд ашиглана."""
    assert monitor_module.compute_signal is scoring_module.compute_signal


@pytest.mark.asyncio
async def test_broadcaster_subscribe_and_broadcast() -> None:
    bc = Broadcaster()
    from app.schemas.alerts import StreamEvent

    received: list = []

    async def consumer() -> None:
        async for event in bc.subscribe():
            received.append(event)
            break  # эхний event-ийг аваад дуусгана

    import asyncio

    task = asyncio.create_task(consumer())
    await asyncio.sleep(0.01)  # захиалагч бүртгэгдэхийг хүлээнэ
    await bc.broadcast(StreamEvent(type="status", payload={"state": "running"}))
    await asyncio.wait_for(task, timeout=1.0)
    assert received and received[0].type == "status"

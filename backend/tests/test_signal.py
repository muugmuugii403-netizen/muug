"""Step 3 — technical indicators + deterministic scoring engine тестүүд.

Гадна дуудлагагүй, бүгд детерминист:
  • indicator-уудын математик (RSI/EMA/snapshot)
  • BUY / SELL / WAIT / зөрчилтэй timeframe тохиолдлууд
  • дутуу өгөгдөл (insufficient data)
  • SL/TP тооцоо
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

import pandas as pd
import pytest

from app.core.errors import InsufficientDataError
from app.schemas.market import Candle, CandlesResponse, Interval
from app.schemas.signal import (
    MacdState,
    PriceActionState,
    SignalDirection,
    TrendState,
)
from app.services.analysis.indicators import TfSnapshot, compute_snapshot, rsi_series
from app.services.analysis.scoring import compute_signal
from app.services.analysis.service import AnalysisService


# ---------- туслагч ----------


def snap(
    close: float = 1.1700,
    ema20: float = 1.1695,
    ema50: float = 1.1689,
    rsi: float = 62.0,
    macd_hist: float = 0.0002,
    atr: float = 0.0006,
    support: float = 1.1650,
    resistance: float = 1.1750,
    trend: TrendState = TrendState.BULLISH,
    macd: MacdState = MacdState.BULLISH,
    pa: PriceActionState = PriceActionState.NEUTRAL,
) -> TfSnapshot:
    return TfSnapshot(
        close=close, ema20=ema20, ema50=ema50, rsi=rsi, macd_hist=macd_hist,
        atr=atr, support=support, resistance=resistance, trend=trend, macd=macd,
        price_action=pa,
    )


def make_df(n: int = 60, start: float = 1.10, step: float = 0.0001) -> pd.DataFrame:
    closes = [start + step * i + (0.00005 if i % 4 else -0.00003) for i in range(n)]
    return pd.DataFrame(
        {
            "open": closes,
            "high": [c + 0.0001 for c in closes],
            "low": [c - 0.0001 for c in closes],
            "close": closes,
        }
    )


def make_candles(n: int, direction: int = 1) -> list[Candle]:
    base = datetime(2026, 1, 1, tzinfo=timezone.utc)
    candles: list[Candle] = []
    for i in range(n):
        o = 1.10 + direction * 0.0001 * i
        c = o + direction * 0.0001
        candles.append(
            Candle(
                timestamp=base + timedelta(minutes=5 * i),
                open=o,
                high=max(o, c) + 0.0001,
                low=min(o, c) - 0.0001,
                close=c,
            )
        )
    return candles


class FakeMarket:
    """AnalysisService-д зориулсан хуурамч market service."""

    def __init__(self, c5: list[Candle], c15: list[Candle]) -> None:
        self._c5, self._c15 = c5, c15

    async def get_candles(self, symbol: str, interval: Interval, outputsize: int) -> CandlesResponse:
        candles = (self._c5 if interval is Interval.M5 else self._c15)[-outputsize:]
        return CandlesResponse(
            symbol=symbol, interval=interval, count=len(candles), source="sample", candles=candles
        )


# ---------- indicator тест ----------


def test_rsi_uptrend_in_bullish_zone() -> None:
    closes = pd.Series([1.10 + 0.0001 * i + (0.00005 if i % 4 else -0.00003) for i in range(60)])
    rsi = float(rsi_series(closes).iloc[-1])
    assert 50.0 < rsi <= 100.0


def test_compute_snapshot_insufficient_raises() -> None:
    with pytest.raises(ValueError, match="хангалтгүй"):
        compute_snapshot(make_df(n=10))


def test_compute_snapshot_ok() -> None:
    s = compute_snapshot(make_df(n=60))
    assert s.ema20 > 0 and s.ema50 > 0
    assert 0.0 <= s.rsi <= 100.0
    assert s.resistance >= s.support


# ---------- scoring: BUY / SELL / WAIT ----------


def test_scoring_buy_case() -> None:
    s15 = snap(trend=TrendState.BULLISH, rsi=62.0, macd=MacdState.BULLISH, pa=PriceActionState.BULLISH_REACTION)
    s5 = snap(close=1.1700, ema20=1.1695, ema50=1.1689)  # bullish confirm
    res = compute_signal("EUR/USD", s5, s15, 5)
    assert res.signal is SignalDirection.BUY
    assert res.buy_score >= 65
    assert res.buy_score > res.sell_score
    assert res.buy_score + res.sell_score + res.wait_score == 100
    assert res.entry is not None and res.stop_loss is not None and res.take_profit is not None
    assert res.stop_loss < res.entry < res.take_profit
    assert res.risk_reward == 2.0


def test_scoring_sell_case() -> None:
    s15 = snap(
        trend=TrendState.BEARISH, ema20=1.1680, ema50=1.1690, rsi=40.0,
        macd_hist=-0.0002, macd=MacdState.BEARISH, pa=PriceActionState.BEARISH_REACTION,
    )
    s5 = snap(close=1.1670, ema20=1.1680, ema50=1.1690, trend=TrendState.BEARISH, macd=MacdState.BEARISH, rsi=40.0)
    res = compute_signal("EUR/USD", s5, s15, 5)
    assert res.signal is SignalDirection.SELL
    assert res.sell_score >= 65
    assert res.sell_score > res.buy_score
    assert res.entry is not None and res.stop_loss is not None and res.take_profit is not None
    assert res.take_profit < res.entry < res.stop_loss


def test_scoring_wait_case() -> None:
    s15 = snap(trend=TrendState.NEUTRAL, rsi=62.0, macd=MacdState.BEARISH, macd_hist=-0.0001)
    s5 = snap(close=1.1670, ema20=1.1680, ema50=1.1690, trend=TrendState.NEUTRAL, macd=MacdState.BEARISH, rsi=45.0)
    res = compute_signal("EUR/USD", s5, s15, 5)
    assert res.signal is SignalDirection.WAIT
    assert res.buy_score < 65 and res.sell_score < 65
    assert res.entry is None and res.stop_loss is None and res.take_profit is None


def test_scoring_conflicting_timeframes() -> None:
    # 15M bullish, 5M bearish → зөрчил → WAIT + warning
    s15 = snap(trend=TrendState.BULLISH, rsi=62.0, macd=MacdState.BULLISH)
    s5 = snap(close=1.1670, ema20=1.1680, ema50=1.1690, trend=TrendState.BEARISH, macd=MacdState.BEARISH, rsi=45.0)
    res = compute_signal("EUR/USD", s5, s15, 5)
    assert res.signal is SignalDirection.WAIT
    assert any("disagree" in w for w in res.warnings)


def test_signal_always_has_base_warning() -> None:
    res = compute_signal("EUR/USD", snap(), snap(), 5)
    assert any("technical indicators only" in w for w in res.warnings)


# ---------- service: end-to-end + insufficient ----------


@pytest.mark.asyncio
async def test_service_buy_end_to_end() -> None:
    market = FakeMarket(make_candles(100, direction=1), make_candles(100, direction=1))
    service = AnalysisService(market=market)
    res = await service.compute_signal("EUR/USD")
    assert res.signal in {SignalDirection.BUY, SignalDirection.SELL, SignalDirection.WAIT}
    assert res.symbol == "EUR/USD"
    assert res.buy_score + res.sell_score + res.wait_score == 100
    assert "5m" in res.timeframes and "15m" in res.timeframes


@pytest.mark.asyncio
async def test_service_insufficient_data() -> None:
    market = FakeMarket(make_candles(10), make_candles(10))
    service = AnalysisService(market=market)
    with pytest.raises(InsufficientDataError):
        await service.compute_signal("EUR/USD")

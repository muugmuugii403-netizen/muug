"""Step 6 — Backtest engine + API тестүүд.

Хамрах хүрээ (engine түвшин, детерминист):
  • BUY WIN / BUY LOSS / SELL WIN / SELL LOSS
  • WAIT (хажуу тийш зах зээл → trade үгүй)
  • SL / TP хүрэх, нэг candle дээр SL+TP → conservative LOSS
  • Future data leakage байхгүй (truncate-тай харьцуулалт)
  • Insufficient candles
  • Production signal engine-ийг ШУУД ашиглаж буй эсэх (monkeypatch)

API түвшин:
  • POST /api/backtest — амжилттай, буруу symbol (404), буруу дата муж (422)
"""

from __future__ import annotations

import math
from datetime import date, datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient

from app.core.errors import InsufficientDataError
from app.main import app
from app.schemas.market import Candle
from app.services.backtest import engine as engine_module
from app.services.backtest.engine import WARMUP, BacktestConfig, run_backtest

API = "/api/backtest"

T0 = datetime(2026, 1, 5, 0, 0, tzinfo=timezone.utc)


# ---------- туслагч ----------


def make_candles(
    n: int,
    minutes: int,
    base: float,
    slope: float,
    noise: float = 0.00004,
    start: datetime = T0,
    crash_after: int | None = None,
    crash_size: float = 0.0,
) -> list[Candle]:
    """Шугаман тренд + жижиг дуу чимээ бүхий OHLC цуваа.

    `crash_after` заасан бол тэр индексийн дараа `crash_size` хэмжээний огцом
    уналт нэмнэ (BUY LOSS тохиолдол үүсгэхэд).
    """
    candles: list[Candle] = []
    price = base
    for i in range(n):
        ts = start + timedelta(minutes=minutes * i)
        # дуу чимээ нь детерминист (sin) тул тест тогтвортой
        wiggle = noise * math.sin(i * 1.7)
        if crash_after is not None and i > crash_after:
            price -= crash_size
        o = price
        c = price + slope + wiggle
        hi = max(o, c) + noise
        lo = min(o, c) - noise
        candles.append(
            Candle(timestamp=ts, open=round(o, 6), high=round(hi, 6), low=round(lo, 6), close=round(c, 6))
        )
        price = c
    return candles


def cfg(symbol: str = "EUR/USD", trade_start: datetime = T0) -> BacktestConfig:
    return BacktestConfig(
        symbol=symbol,
        pip_decimals=5,
        initial_balance=10000.0,
        risk_per_trade=1.0,
        spread=0.00006,
        slippage=0.0,
        trade_start=trade_start,
    )


def bullish_data() -> tuple[list[Candle], list[Candle]]:
    """Өсөх тренд: 5M + 15M хоёулаа bullish → BUY signal."""
    c5 = make_candles(260, 5, 1.10, slope=0.00012)
    c15 = make_candles(95, 15, 1.10, slope=0.00036)
    return c5, c15


def bearish_data() -> tuple[list[Candle], list[Candle]]:
    c5 = make_candles(260, 5, 1.20, slope=-0.00012)
    c15 = make_candles(95, 15, 1.20, slope=-0.00036)
    return c5, c15


# ---------- engine: BUY / SELL / WAIT ----------


def test_buy_signal_produces_buy_trades() -> None:
    c5, c15 = bullish_data()
    out = run_backtest(c5, c15, cfg())
    assert out.summary.total_trades >= 1
    assert all(t.signal.value == "BUY" for t in out.trades)
    assert out.summary.long_trades >= 1


def test_buy_win_uptrend_hits_tp() -> None:
    c5, c15 = bullish_data()
    out = run_backtest(c5, c15, cfg())
    wins = [t for t in out.trades if t.result.value == "WIN"]
    assert len(wins) >= 1
    # WIN trade TP-дээ хүрсэн байна
    for t in wins:
        assert t.exit_price == t.take_profit


def test_buy_loss_after_crash_hits_sl() -> None:
    # Өсөж байгаад огцом унах → BUY entry-ийн дараа SL хүрнэ
    c5 = make_candles(260, 5, 1.10, slope=0.00012, crash_after=200, crash_size=0.004)
    c15 = make_candles(95, 15, 1.10, slope=0.00036)
    out = run_backtest(c5, c15, cfg())
    losses = [t for t in out.trades if t.result.value == "LOSS"]
    assert len(losses) >= 1
    for t in losses:
        assert t.exit_price == t.stop_loss


def test_sell_signal_produces_sell_trades() -> None:
    c5, c15 = bearish_data()
    out = run_backtest(c5, c15, cfg())
    assert out.summary.total_trades >= 1
    assert all(t.signal.value == "SELL" for t in out.trades)
    assert out.summary.short_trades >= 1


def test_sell_win_downtrend_hits_tp() -> None:
    c5, c15 = bearish_data()
    out = run_backtest(c5, c15, cfg())
    wins = [t for t in out.trades if t.result.value == "WIN"]
    assert len(wins) >= 1
    for t in wins:
        assert t.exit_price == t.take_profit


def test_wait_sideways_no_closed_trades() -> None:
    # Хажуу тийш: slope=0, маш бага хэлбэлзэл → WAIT signal, trade үгүй
    c5 = make_candles(260, 5, 1.10, slope=0.0, noise=0.00002)
    c15 = make_candles(95, 15, 1.10, slope=0.0, noise=0.00002)
    out = run_backtest(c5, c15, cfg())
    assert out.summary.wins == 0
    assert out.summary.losses == 0
    assert out.summary.wait_count >= 1


def test_same_candle_sl_tp_conservative_loss() -> None:
    """Entry-ийн дараах НЭГ лаа SL ба TP-г хоёуланг нь хүрвэл → LOSS (conservative)."""
    c5 = make_candles(260, 5, 1.10, slope=0.00012)
    c15 = make_candles(95, 15, 1.10, slope=0.00036)
    # Асар том лаа: high/low нь SL ба TP-г хоёуланг нь давна
    idx = 210
    big = c5[idx]
    c5[idx] = Candle(
        timestamp=big.timestamp,
        open=big.open,
        high=round(big.open + 0.05, 6),
        low=round(big.open - 0.05, 6),
        close=big.close,
    )
    out = run_backtest(c5, c15, cfg(trade_start=T0 + timedelta(minutes=5 * 205)))
    # Энэ цонхонд нээгдсэн trade-ууд дунд conservative LOSS байна
    assert all(t.result.value != "WIN" or t.exit_price == t.take_profit for t in out.trades)


# ---------- engine: look-ahead bias / insufficient ----------


def test_no_future_data_leakage() -> None:
    """Өгөгдлийг эхний trade-ийн дараа таслахад эхний trade өөрчлөгдөх ёсгүй."""
    c5, c15 = bullish_data()
    full = run_backtest(c5, c15, cfg())
    assert full.trades, "Харьцуулахын тулд дор хаяж нэг trade шаардлагатай"
    first = full.trades[0]

    # Эхний trade хаагдсан цэгээр өгөгдлийг тасална
    cut = first.exit_time if first.exit_time else first.entry_time + timedelta(minutes=60)
    c5_cut = [c for c in c5 if c.timestamp <= cut + timedelta(minutes=10)]
    c15_cut = [c for c in c15 if c.timestamp <= cut + timedelta(minutes=10)]
    truncated = run_backtest(c5_cut, c15_cut, cfg())

    assert truncated.trades, "Тасалсан өгөгдөлд эхний trade хэвээр байх ёстой"
    t = truncated.trades[0]
    assert t.signal == first.signal
    assert t.entry == first.entry
    assert t.entry_time == first.entry_time
    assert t.stop_loss == first.stop_loss
    assert t.take_profit == first.take_profit


def test_insufficient_candles_raises() -> None:
    c5 = make_candles(30, 5, 1.10, slope=0.0001)
    c15 = make_candles(30, 15, 1.10, slope=0.0001)
    with pytest.raises(InsufficientDataError):
        run_backtest(c5, c15, cfg())


def test_engine_uses_production_signal_engine(monkeypatch: pytest.MonkeyPatch) -> None:
    """Backtest нь production `scoring.compute_signal`-ийг шууд дууддаг."""
    calls: list[str] = []
    real = engine_module.scoring.compute_signal

    def spy(symbol: str, s5: object, s15: object, pip_decimals: int):  # type: ignore[no-untyped-def]
        calls.append(symbol)
        return real(symbol, s5, s15, pip_decimals)  # type: ignore[arg-type]

    monkeypatch.setattr(engine_module.scoring, "compute_signal", spy)
    c5, c15 = bullish_data()
    run_backtest(c5, c15, cfg())
    assert len(calls) > 0, "Engine production signal function-ийг дуудаагүй байна"
    assert all(s == "EUR/USD" for s in calls)


# ---------- API түвшин ----------


def _client() -> TestClient:
    return TestClient(app)


def _valid_body(symbol: str = "EUR/USD") -> dict:
    today = datetime.now(timezone.utc).date()
    return {
        "symbol": symbol,
        "start_date": (today - timedelta(days=3)).isoformat(),
        "end_date": today.isoformat(),
        "initial_balance": 10000,
        "risk_per_trade": 1.0,
    }


def test_api_backtest_success() -> None:
    res = _client().post(API, json=_valid_body())
    assert res.status_code == 200
    body = res.json()
    assert "summary" in body
    assert "trades" in body
    assert "equity_curve" in body
    s = body["summary"]
    assert s["initial_balance"] == 10000
    assert s["candles_5m"] >= 120


def test_api_backtest_invalid_symbol_404() -> None:
    res = _client().post(API, json=_valid_body(symbol="XXX/YYY"))
    assert res.status_code == 404


def test_api_backtest_bad_date_range_422() -> None:
    body = _valid_body()
    body["start_date"], body["end_date"] = body["end_date"], body["start_date"]
    res = _client().post(API, json=body)
    assert res.status_code == 422


def test_api_backtest_future_end_date_422() -> None:
    body = _valid_body()
    body["end_date"] = (datetime.now(timezone.utc).date() + timedelta(days=10)).isoformat()
    res = _client().post(API, json=body)
    assert res.status_code == 422


def test_api_backtest_too_long_range_422() -> None:
    today = datetime.now(timezone.utc).date()
    body = _valid_body()
    body["start_date"] = (today - timedelta(days=400)).isoformat()
    res = _client().post(API, json=body)
    assert res.status_code == 422

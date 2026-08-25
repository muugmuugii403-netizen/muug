"""XAU/USD (Gold) дэмжлэг — бүх давхаргын тест (Step: Gold instrument).

Гадна дуудлагагүй, бүгд детерминист. Хамрах хүрээ:
  • Registry: symbol бүртгэгдсэн, pip хэмжээ (0.10)
  • Market data: sample 5min / 15min candles, quote (bid/ask/spread)
  • Indicators: RSI / MACD / EMA20 / EMA50 / ATR — gold масштабад
  • Signal engine: BUY / SELL / WAIT оноо (production логик)
  • Backtest: end-to-end sample өгөгдөл дээр
  • Realtime monitor: pair жагсаалтад багтсан
  • Alert / Telegram: мессеж XAU/USD агуулна
  • Qwen: AI input XAU/USD агуулна
  • API: candles / quote / signal / pairs / backtest endpoint
"""

from __future__ import annotations

from datetime import date, datetime, timezone

import pytest
from fastapi.testclient import TestClient

from app.api.forex import get_market_service
from app.core.config import Settings
from app.main import app
from app.schemas.alerts import AlertRecord
from app.schemas.market import Interval
from app.schemas.signal import (
    MacdState,
    PriceActionState,
    SignalDirection,
    TrendState,
)
from app.services.ai.prompt import build_user_message
from app.services.alerts.telegram import build_message
from app.services.analysis.indicators import TfSnapshot, compute_snapshot
from app.services.analysis.scoring import compute_signal
from app.services.backtest.service import BacktestService
from app.services.market_data.providers import SampleDataProvider
from app.services.market_data.service import MarketDataService
from app.services.market_data.symbols import get_pair, pip_size, supported_symbols
from app.services.monitor.broadcaster import Broadcaster
from app.services.monitor.service import MonitorService
from app.services.alerts.store import InMemoryAlertStore
from app.services.ai.explainer import ExplanationService

from app.schemas.backtest import BacktestRequest

API = "/api/forex"
SYMBOL = "XAU/USD"


def _run(coro):  # type: ignore[no-untyped-def]
    import asyncio

    return asyncio.run(coro)


def _sample_service() -> MarketDataService:
    return MarketDataService(provider=SampleDataProvider(), candles_ttl_s=0, quote_ttl_s=0)


# ---------- 1. Registry ----------


class TestRegistry:
    def test_xau_registered(self) -> None:
        assert SYMBOL in supported_symbols()

    def test_xau_config(self) -> None:
        pair = get_pair(SYMBOL)
        assert pair is not None
        assert pair.pip_decimals == 2  # 2685.45
        assert pair.typical_spread == 0.30

    def test_pip_size(self) -> None:
        assert pip_size(SYMBOL) == 0.1
        assert pip_size("EUR/USD") == 0.0001
        assert pip_size("USD/JPY") == 0.01


# ---------- 2. Market data ----------


class TestMarketData:
    def test_candles_5min(self) -> None:
        service = _sample_service()
        res = _run(service.get_candles(SYMBOL, Interval.M5, 200))
        assert res.count == 200
        assert res.symbol == SYMBOL
        assert all(c.high >= max(c.open, c.close) for c in res.candles)
        assert all(c.low <= min(c.open, c.close) for c in res.candles)
        # gold масштабад (ойролцоо 2685)
        assert 2000 < res.candles[-1].close < 3200

    def test_candles_15min(self) -> None:
        service = _sample_service()
        res = _run(service.get_candles(SYMBOL, Interval.M15, 200))
        assert res.count == 200
        # 15min лаанууд 15 минутын зайтай
        ts = [c.timestamp for c in res.candles]
        assert ts == sorted(ts)
        diff = (ts[1] - ts[0]).total_seconds()
        assert diff == 900

    def test_quote_synthesis(self) -> None:
        service = _sample_service()
        q = _run(service.get_quote(SYMBOL))
        assert q.symbol == SYMBOL
        assert q.bid < q.price < q.ask
        assert q.spread == pytest.approx(q.ask - q.bid, abs=0.01)
        # gold spread ойролцоо 0.30
        assert 0.1 < q.spread < 0.6


# ---------- 3. Indicators (gold масштаб) ----------


def _gold_df(n: int = 80, start: float = 2650.0, step: float = 0.4):
    import pandas as pd

    closes = [start + step * i + (0.2 if i % 4 else -0.15) for i in range(n)]
    return pd.DataFrame(
        {
            "open": closes,
            "high": [c + 0.6 for c in closes],
            "low": [c - 0.6 for c in closes],
            "close": closes,
        }
    )


class TestIndicators:
    def test_snapshot_gold_scale(self) -> None:
        snap = compute_snapshot(_gold_df())
        assert isinstance(snap, TfSnapshot)
        assert 2000 < snap.close < 3200
        assert snap.ema20 > 0 and snap.ema50 > 0
        assert 0 <= snap.rsi <= 100
        assert snap.atr > 0
        assert snap.support <= snap.resistance
        # өгөгдөл өсөх хандлагатай тул trend bullish
        assert snap.trend is TrendState.BULLISH


# ---------- 4. Signal engine (BUY / SELL / WAIT) ----------


def _gold_snap(
    close: float,
    ema20: float,
    ema50: float,
    rsi: float,
    macd_hist: float,
    trend: TrendState,
    macd: MacdState,
    pa: PriceActionState = PriceActionState.NEUTRAL,
) -> TfSnapshot:
    return TfSnapshot(
        close=close, ema20=ema20, ema50=ema50, rsi=rsi, macd_hist=macd_hist,
        atr=1.2, support=2620.0, resistance=2720.0, trend=trend, macd=macd,
        price_action=pa,
    )


class TestSignalEngine:
    def test_buy_signal(self) -> None:
        s5 = _gold_snap(2685, 2683, 2678, 62, 0.8, TrendState.BULLISH, MacdState.BULLISH)
        s15 = _gold_snap(2685, 2680, 2672, 58, 1.2, TrendState.BULLISH, MacdState.BULLISH)
        res = compute_signal(SYMBOL, s5, s15, 2)
        assert res.symbol == SYMBOL
        assert res.signal is SignalDirection.BUY
        assert res.buy_score >= 65
        assert res.buy_score > res.sell_score
        # SL/TP тооцогдсон, 2 оронтой нарийвчлалтай
        assert res.entry is not None and res.stop_loss is not None and res.take_profit is not None
        assert res.entry == round(res.entry, 2)
        assert res.stop_loss < res.entry < res.take_profit  # BUY
        assert res.risk_reward == 2.0

    def test_sell_signal(self) -> None:
        s5 = _gold_snap(2685, 2687, 2692, 38, -0.9, TrendState.BEARISH, MacdState.BEARISH)
        s15 = _gold_snap(2685, 2690, 2698, 42, -1.3, TrendState.BEARISH, MacdState.BEARISH)
        res = compute_signal(SYMBOL, s5, s15, 2)
        assert res.signal is SignalDirection.SELL
        assert res.sell_score >= 65
        assert res.stop_loss > res.entry > res.take_profit  # SELL эсрэг чиглэл

    def test_wait_signal_conflicting(self) -> None:
        # 15M bullish, 5M bearish → зөрчил → WAIT (эсвэл оноо хүрэхгүй)
        s5 = _gold_snap(2685, 2687, 2692, 40, -0.5, TrendState.BEARISH, MacdState.BEARISH)
        s15 = _gold_snap(2685, 2680, 2672, 58, 1.0, TrendState.BULLISH, MacdState.BULLISH)
        res = compute_signal(SYMBOL, s5, s15, 2)
        assert res.signal in (SignalDirection.WAIT, SignalDirection.SELL)
        assert res.buy_score + res.sell_score + res.wait_score == 100


# ---------- 5. Backtest (end-to-end sample) ----------


class TestBacktest:
    def test_backtest_xau(self) -> None:
        service = BacktestService(market=_sample_service())
        req = BacktestRequest(
            symbol=SYMBOL,
            start_date=date(2026, 1, 6),
            end_date=date(2026, 1, 9),
            initial_balance=10000.0,
            risk_per_trade=1.0,
        )
        res = _run(service.run(req))
        assert res.summary.candles_5m >= 120
        assert res.summary.candles_15m >= 60
        # spread gold-ын typical spread-ээр (ойролцоо 0.30)
        assert res.summary.spread_used == pytest.approx(0.30, abs=0.05)
        assert res.summary.initial_balance == 10000.0
        assert len(res.equity_curve) >= 1


# ---------- 6. Realtime monitor ----------


class TestMonitor:
    def test_monitor_includes_xau(self) -> None:
        monitor = MonitorService(
            market=_sample_service(),
            store=InMemoryAlertStore(),
            broadcaster=Broadcaster(),
            settings=Settings(twelve_data_api_key="", sample_fallback_enabled=True),  # type: ignore[call-arg]
            explainer=ExplanationService(client=None),
        )
        assert SYMBOL in monitor.pairs()


# ---------- 7. Alert / Telegram ----------


class TestAlerts:
    def test_telegram_message(self) -> None:
        alert = AlertRecord(
            id=1, symbol=SYMBOL, signal=SignalDirection.BUY, confidence=78,
            buy_score=78, sell_score=12, wait_score=10, entry=2685.0,
            stop_loss=2683.2, take_profit=2688.6, risk_reward=2.0,
            reasons=["15M bullish trend", "5M bullish confirmation"],
        )
        msg = build_message(alert)
        assert SYMBOL in msg
        assert "BUY" in msg
        assert "2685.0" in msg
        assert "Confidence: 78/100" in msg


# ---------- 8. Qwen AI input ----------


class TestQwenInput:
    def test_prompt_includes_xau(self) -> None:
        s5 = _gold_snap(2685, 2683, 2678, 62, 0.8, TrendState.BULLISH, MacdState.BULLISH)
        s15 = _gold_snap(2685, 2680, 2672, 58, 1.2, TrendState.BULLISH, MacdState.BULLISH)
        signal = compute_signal(SYMBOL, s5, s15, 2)
        msg = build_user_message(signal)
        assert SYMBOL in msg
        assert '"signal": "BUY"' in msg


# ---------- 9. API endpoint ----------


@pytest.fixture()
def client():
    app.dependency_overrides[get_market_service] = _sample_service
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


class TestApi:
    def test_candles_5min_endpoint(self, client: TestClient) -> None:
        res = client.get(f"{API}/candles/{SYMBOL.replace('/', '%2F')}", params={"interval": "5min", "outputsize": 200})
        assert res.status_code == 200
        assert res.json()["interval"] == "5min"
        assert res.json()["count"] == 200

    def test_candles_15min_endpoint(self, client: TestClient) -> None:
        res = client.get(f"{API}/candles/{SYMBOL.replace('/', '%2F')}", params={"interval": "15min", "outputsize": 200})
        assert res.status_code == 200
        assert res.json()["interval"] == "15min"

    def test_quote_endpoint(self, client: TestClient) -> None:
        res = client.get(f"{API}/quote/{SYMBOL.replace('/', '%2F')}")
        assert res.status_code == 200
        q = res.json()
        assert q["symbol"] == SYMBOL
        assert q["bid"] < q["price"] < q["ask"]

    def test_signal_endpoint(self, client: TestClient) -> None:
        res = client.get(f"{API}/signal/{SYMBOL.replace('/', '%2F')}")
        assert res.status_code == 200
        body = res.json()
        assert body["symbol"] == SYMBOL
        assert body["signal"] in ("BUY", "SELL", "WAIT")

    def test_pairs_includes_xau(self, client: TestClient) -> None:
        res = client.get("/api/v1/pairs")
        assert res.status_code == 200
        symbols = [p["symbol"] for p in res.json()]
        assert SYMBOL in symbols

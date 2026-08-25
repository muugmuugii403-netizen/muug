"""Step 7 — Stream / alert API endpoint тестүүд.

Хамрах хүрээ:
  • GET  /api/alerts/settings — default утгууд
  • POST /api/alerts/settings — шинэчлэлт + validation (буруу талбар → 422)
  • GET  /api/alerts/history — эрэмбэ, хязгаар
  • GET  /api/monitor/signals — сүүлийн signal-үүд
"""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi.testclient import TestClient

from app.api import stream as stream_module
from app.main import app
from app.schemas.alerts import AlertRecord
from app.schemas.signal import (
    MacdState,
    SignalDirection,
    SignalResponse,
    TimeframeAnalysis,
    TrendState,
)
from app.services.alerts.store import InMemoryAlertStore
from app.services.monitor.service import MonitorService

API = "/api"


class StubMonitor:
    """Зөвхөн endpoint-үүдийн хэрэглэдэг атрибутууд."""

    def __init__(self) -> None:
        self.store = InMemoryAlertStore()
        self._last_signals: dict[str, SignalResponse] = {}

    def snapshot(self) -> dict:
        return {"monitoring": True, "pairs": ["EUR/USD"], "signals": {}, "alerts": []}

    # broadcaster-г stream endpoint ашигладаг ч бид энд дуудахгүй
    broadcaster = None


def tf() -> TimeframeAnalysis:
    return TimeframeAnalysis(
        trend=TrendState.BULLISH, rsi=55.0, macd=MacdState.BULLISH, ema20=1.169,
        ema50=1.168, atr=0.0006, support=1.165, resistance=1.175,
    )


def make_signal(symbol: str = "EUR/USD") -> SignalResponse:
    return SignalResponse(
        symbol=symbol, signal=SignalDirection.BUY, buy_score=78, sell_score=12, wait_score=10,
        confidence=78, entry=1.17, stop_loss=1.1685, take_profit=1.173, risk_reward=2.0,
        timeframes={"5m": tf(), "15m": tf()}, reasons=["15M bullish"], warnings=[],
    )


def client_with_stub() -> tuple[TestClient, StubMonitor]:
    stub = StubMonitor()
    app.dependency_overrides[stream_module.get_monitor] = lambda: stub
    return TestClient(app), stub


def teardown_function() -> None:
    app.dependency_overrides.clear()


def test_get_settings_defaults() -> None:
    client, _ = client_with_stub()
    res = client.get(f"{API}/alerts/settings")
    assert res.status_code == 200
    body = res.json()
    assert body["buy_enabled"] is True
    assert body["telegram_enabled"] is True


def test_update_settings() -> None:
    client, stub = client_with_stub()
    res = client.post(
        f"{API}/alerts/settings",
        json={"buy_enabled": False, "sell_enabled": True, "wait_enabled": True, "telegram_enabled": False},
    )
    assert res.status_code == 200
    assert res.json()["buy_enabled"] is False
    assert stub.store.get_settings().telegram_enabled is False


def test_update_settings_rejects_extra_field() -> None:
    client, _ = client_with_stub()
    res = client.post(f"{API}/alerts/settings", json={"buy_enabled": True, "evil_field": 1})
    assert res.status_code == 422  # extra="forbid"


def test_alert_history_order_and_limit() -> None:
    client, stub = client_with_stub()
    for i in range(1, 4):
        stub.store.add(
            AlertRecord(
                id=i, symbol="EUR/USD", signal=SignalDirection.BUY, confidence=70,
                buy_score=70, sell_score=20, wait_score=10,
            )
        )
    res = client.get(f"{API}/alerts/history?limit=2")
    assert res.status_code == 200
    body = res.json()
    assert len(body) == 2
    assert body[0]["id"] == 3  # шинэ нь эхэндээ
    assert "created_at" in body[0]


def test_alert_history_limit_validation() -> None:
    client, _ = client_with_stub()
    res = client.get(f"{API}/alerts/history?limit=9999")
    assert res.status_code == 422  # le=200


def test_monitor_signals() -> None:
    client, stub = client_with_stub()
    stub._last_signals["EUR/USD"] = make_signal()
    res = client.get(f"{API}/monitor/signals")
    assert res.status_code == 200
    body = res.json()
    assert body["EUR/USD"]["signal"] == "BUY"
    assert body["EUR/USD"]["confidence"] == 78

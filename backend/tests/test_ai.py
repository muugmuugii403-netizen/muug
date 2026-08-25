"""Step 4 — Qwen AI тайлбарын давхаргын тестүүд.

Хамрах хүрээ:
  • Qwen API амжилт / timeout / 5xx / rate limit
  • API key дутуу (disabled)
  • Буруу AI хариу (JSON биш) → unavailable
  • AI signal-ийг өөрчлөх гэж оролдсон (tampering) → устгагдана
  • AI байхгүй үед technical signal хэвийн ажиллана (integration)
"""

from __future__ import annotations

import json

import httpx
import pytest

from app.api import forex as forex_module
from app.core.config import Settings
from app.main import app
from app.schemas.ai import AiExplanation
from app.schemas.signal import MacdState, PriceActionState, SignalDirection, TrendState
from app.services.ai.explainer import ExplanationService, MSG_DISABLED, MSG_UNAVAILABLE
from app.services.ai.qwen_client import QwenClient
from app.services.analysis.indicators import TfSnapshot
from app.services.analysis.scoring import compute_signal

from fastapi.testclient import TestClient

API = "/api/forex"


# ---------- туслагч ----------


def _ai_body(summary: str = "Тайлбар") -> dict:
    explanation = {
        "summary": summary,
        "signal_explanation": "Signal тайлбар",
        "market_context": "Зах зээлийн нөхцөл",
        "technical_reasons": ["Шалтгаан 1", "Шалтгаан 2", "Шалтгаан 3"],
        "risk_analysis": "Эрсдэлийн шинжилгээ",
        "entry_explanation": "Entry тайлбар",
        "stop_loss_explanation": "Stop loss тайлбар",
        "take_profit_explanation": "Take profit тайлбар",
        "warnings": ["Эрсдэлийн сануулга"],
    }
    return {"choices": [{"message": {"content": json.dumps(explanation, ensure_ascii=False)}}]}


def make_transport(status: int = 200, body: dict | None = None, raise_exc: Exception | None = None) -> httpx.MockTransport:
    def handler(request: httpx.Request) -> httpx.Response:
        if raise_exc is not None:
            raise raise_exc
        return httpx.Response(status, json=body or {})

    return httpx.MockTransport(handler)


def buy_signal() -> "object":
    s15 = TfSnapshot(
        close=1.1700, ema20=1.1695, ema50=1.1689, rsi=62.0, macd_hist=0.0002,
        atr=0.0006, support=1.1650, resistance=1.1750, trend=TrendState.BULLISH,
        macd=MacdState.BULLISH, price_action=PriceActionState.NEUTRAL,
    )
    return compute_signal("EUR/USD", s15, s15, 5)


# ---------- Qwen client ----------


@pytest.mark.asyncio
async def test_qwen_success() -> None:
    client = QwenClient(api_key="k", transport=make_transport(200, _ai_body()))
    content = await client.complete_json("sys", "user")
    assert "Тайлбар" in content


@pytest.mark.asyncio
async def test_qwen_timeout() -> None:
    from app.core.errors import AiTimeoutError

    client = QwenClient(api_key="k", transport=make_transport(raise_exc=httpx.ReadTimeout("timeout")))
    with pytest.raises(AiTimeoutError):
        await client.complete_json("sys", "user")


@pytest.mark.asyncio
async def test_qwen_server_error() -> None:
    from app.core.errors import AiUnavailableError

    client = QwenClient(api_key="k", transport=make_transport(500, {"error": "boom"}))
    with pytest.raises(AiUnavailableError):
        await client.complete_json("sys", "user")


@pytest.mark.asyncio
async def test_qwen_rate_limited() -> None:
    from app.core.errors import AiRateLimitedError

    client = QwenClient(api_key="k", transport=make_transport(429, {}))
    with pytest.raises(AiRateLimitedError):
        await client.complete_json("sys", "user")


def test_qwen_missing_api_key() -> None:
    with pytest.raises(ValueError, match="API key"):
        QwenClient(api_key="")


# ---------- Explainer ----------


@pytest.mark.asyncio
async def test_explainer_success_validates() -> None:
    client = QwenClient(api_key="k", transport=make_transport(200, _ai_body()))
    service = ExplanationService(client=client)
    explanation, status, _ = await service.explain(buy_signal())
    assert status == "ok"
    assert isinstance(explanation, AiExplanation)
    assert explanation.summary == "Тайлбар"


@pytest.mark.asyncio
async def test_explainer_disabled_without_key() -> None:
    service = ExplanationService(client=None)
    explanation, status, message = await service.explain(buy_signal())
    assert explanation is None
    assert status == "disabled"
    assert message == MSG_DISABLED


@pytest.mark.asyncio
async def test_explainer_invalid_json_response() -> None:
    client = QwenClient(api_key="k", transport=make_transport(200, {"choices": [{"message": {"content": "энэ JSON биш"}}]}))
    service = ExplanationService(client=client)
    explanation, status, message = await service.explain(buy_signal())
    assert explanation is None
    assert status == "unavailable"
    assert message == MSG_UNAVAILABLE


@pytest.mark.asyncio
async def test_explainer_rejects_signal_tampering() -> None:
    # Signal BUY байхад AI "зарах дохио" гэж тайлбарлахыг оролдвол устгагдана
    client = QwenClient(
        api_key="k", transport=make_transport(200, _ai_body(summary="Энэ бол зарах дохио байна"))
    )
    service = ExplanationService(client=client)
    explanation, status, _ = await service.explain(buy_signal())
    assert explanation is None
    assert status == "unavailable"


@pytest.mark.asyncio
async def test_explainer_caches_same_signal() -> None:
    calls = {"n": 0}

    def counting_handler(request: httpx.Request) -> httpx.Response:
        calls["n"] += 1
        return httpx.Response(200, json=_ai_body())

    client = QwenClient(api_key="k", transport=httpx.MockTransport(counting_handler))
    service = ExplanationService(client=client, cache_ttl_s=60)
    sig = buy_signal()
    await service.explain(sig)
    await service.explain(sig)
    assert calls["n"] == 1  # хоёр дахь дуудлага cache-аас


# ---------- Integration: AI унасан ч signal хэвийн ----------


def test_analysis_endpoint_signal_ok_when_ai_disabled() -> None:
    """AI идэвхгүй үед /analysis endpoint technical signal-ээ хэвээр буцаана."""
    from app.services.analysis.service import AnalysisService
    from tests.test_signal import FakeMarket, make_candles

    market = FakeMarket(make_candles(100, 1), make_candles(100, 1))
    app.dependency_overrides[forex_module.get_analysis_service] = lambda: AnalysisService(market=market)
    app.dependency_overrides[forex_module.get_explainer] = lambda: ExplanationService(client=None)
    try:
        client = TestClient(app)
        res = client.get(f"{API}/analysis/EUR/USD")
        assert res.status_code == 200
        body = res.json()
        assert body["signal"]["signal"] in ("BUY", "SELL", "WAIT")
        assert body["ai_status"] == "disabled"
        assert body["explanation"] is None
        assert body["signal"]["buy_score"] + body["signal"]["sell_score"] + body["signal"]["wait_score"] == 100
    finally:
        app.dependency_overrides.clear()


def test_signal_endpoint_returns_deterministic_signal() -> None:
    from app.services.analysis.service import AnalysisService
    from tests.test_signal import FakeMarket, make_candles

    market = FakeMarket(make_candles(100, 1), make_candles(100, 1))
    app.dependency_overrides[forex_module.get_analysis_service] = lambda: AnalysisService(market=market)
    try:
        client = TestClient(app)
        res = client.get(f"{API}/signal/EUR/USD")
        assert res.status_code == 200
        body = res.json()
        assert body["signal"] in ("BUY", "SELL", "WAIT")
        assert "timeframes" in body and "5m" in body["timeframes"] and "15m" in body["timeframes"]
    finally:
        app.dependency_overrides.clear()

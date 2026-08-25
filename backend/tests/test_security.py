"""Step 8 — Security + production readiness тестүүд.

Хамрах хүрээ:
  • Security headers бүх хариуд байна
  • /health/detailed — аюулгүй бүтэц (нууц илрэхгүй)
  • Rate limiter: sliding window + 429 + Retry-After
  • Secret scrubbing (apikey, Bearer, Telegram token)
  • CORS: зөвшөөрөгдсөн origin / үл зөвшөөрөгдсөн origin
  • SSE heartbeat (Broadcaster timeout → None)
"""

from __future__ import annotations

import asyncio

import pytest
from fastapi.testclient import TestClient

from app.core import rate_limit as rl_module
from app.core.logging_utils import scrub
from app.core.rate_limit import RateLimiter
from app.main import app
from app.services.monitor.broadcaster import Broadcaster

API = "/api/v1"

client = TestClient(app)


# ---------- security headers ----------


def test_security_headers_present() -> None:
    res = client.get(f"{API}/health")
    assert res.status_code == 200
    assert res.headers["X-Content-Type-Options"] == "nosniff"
    assert res.headers["X-Frame-Options"] == "DENY"
    assert res.headers["Referrer-Policy"] == "strict-origin-when-cross-origin"
    assert "camera=()" in res.headers["Permissions-Policy"]


def test_no_powered_by_or_server_leak() -> None:
    res = client.get(f"{API}/health")
    assert "x-powered-by" not in {k.lower() for k in res.headers}


# ---------- detailed health ----------


def test_health_detailed_safe_structure() -> None:
    res = client.get(f"{API}/health/detailed")
    assert res.status_code == 200
    body = res.json()
    assert body["status"] == "ok"
    comp = body["components"]
    assert comp["api"]["status"] == "ok"
    assert comp["market_data"]["mode"] in {"twelvedata", "sample", "none"}
    assert isinstance(comp["monitor"]["enabled"], bool)
    assert isinstance(comp["ai_explanation"]["enabled"], bool)
    assert isinstance(comp["telegram"]["configured"], bool)
    # Нууц утгууд хариунд илрэхгүй (DSN, key, token)
    raw = res.text.lower()
    assert "postgres://" not in raw and "postgresql://" not in raw
    assert "bearer" not in raw
    assert "secret" not in raw.replace("secret_key", "")  # талбарын нэр ч байхгүй


# ---------- CORS ----------


def test_cors_allowed_origin() -> None:
    res = client.get(f"{API}/health", headers={"Origin": "http://localhost:3000"})
    assert res.headers.get("access-control-allow-origin") == "http://localhost:3000"


def test_cors_disallowed_origin() -> None:
    res = client.get(f"{API}/health", headers={"Origin": "http://evil.example.com"})
    assert "access-control-allow-origin" not in res.headers


# ---------- rate limiter (unit) ----------


def test_rate_limiter_window() -> None:
    limiter = RateLimiter(limit=3, window_s=60.0)
    for _ in range(3):
        ok, _, _ = limiter.check("k")
        assert ok
    ok, remaining, retry_after = limiter.check("k")
    assert not ok
    assert remaining == 0
    assert retry_after > 0


def test_rate_limiter_per_key_isolation() -> None:
    limiter = RateLimiter(limit=1, window_s=60.0)
    assert limiter.check("a")[0]
    assert limiter.check("b")[0]  # өөр key — хязгаар тусдаа
    assert not limiter.check("a")[0]


# ---------- rate limiter (endpoint) ----------


def test_endpoint_rate_limit_returns_429(monkeypatch: pytest.MonkeyPatch) -> None:
    """3-р хүсэлтээс 429 + Retry-After header + нэгдсэн алдааны формат."""
    monkeypatch.setattr(rl_module, "get_limiter", lambda group: RateLimiter(limit=2, window_s=60.0))
    try:
        r1 = client.get("/api/forex/quote/EUR%2FUSD")
        r2 = client.get("/api/forex/quote/EUR%2FUSD")
        r3 = client.get("/api/forex/quote/EUR%2FUSD")
        assert r1.status_code == 200
        assert r2.status_code == 200
        assert r3.status_code == 429
        body = r3.json()
        assert body["error"] == "RATE_LIMITED"
        assert int(r3.headers["Retry-After"]) >= 1
    finally:
        rl_module.reset_registry()


def test_rate_limit_disabled_passes(monkeypatch: pytest.MonkeyPatch) -> None:
    """RATE_LIMIT_ENABLED=false үед хязгаарлахгүй."""
    from app.core.config import get_settings

    settings = get_settings()
    monkeypatch.setattr(settings, "rate_limit_enabled", False)
    monkeypatch.setattr(rl_module, "get_limiter", lambda group: RateLimiter(limit=1, window_s=60.0))
    try:
        for _ in range(3):
            assert client.get("/api/forex/quote/EUR%2FUSD").status_code == 200
    finally:
        monkeypatch.setattr(settings, "rate_limit_enabled", True)
        rl_module.reset_registry()


# ---------- secret scrubbing ----------


def test_scrub_apikey_in_url() -> None:
    assert "***" in scrub("GET /time_series?apikey=abcd1234efgh&symbol=EUR/USD")
    assert "abcd1234efgh" not in scrub("GET /time_series?apikey=abcd1234efgh")


def test_scrub_bearer_token() -> None:
    out = scrub("Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.payload.sig")
    assert "eyJhbGciOiJIUzI1NiJ9" not in out
    assert "Bearer ***" in out


def test_scrub_telegram_bot_token() -> None:
    token = "bot123456789:AAE0abcDEFghIJKlmnOPQRstUVWxyz012345678"
    out = scrub(f"Telegram илгээлт: https://api.telegram.org/{token}/sendMessage")
    assert "AAE0abcDEF" not in out


def test_scrub_plain_text_untouched() -> None:
    msg = "signal EUR/USD: BUY (buy=78 sell=12 wait=10)"
    assert scrub(msg) == msg


# ---------- SSE heartbeat ----------


@pytest.mark.asyncio
async def test_broadcaster_heartbeat_yields_none() -> None:
    """Event байхгүй үед heartbeat timeout → None (keepalive илгээх дохио)."""
    broadcaster = Broadcaster()
    gen = broadcaster.subscribe(heartbeat_s=0.05)
    first = await asyncio.wait_for(gen.__anext__(), timeout=2.0)
    assert first is None
    await gen.aclose()


@pytest.mark.asyncio
async def test_broadcaster_cleanup_on_close() -> None:
    """Холболт хаагдахад subscriber хасагдана (memory leak үгүй)."""
    broadcaster = Broadcaster()
    gen = broadcaster.subscribe(heartbeat_s=0.05)
    await gen.__anext__()  # subscribe бүртгэнэ
    assert broadcaster.subscriber_count == 1
    await gen.aclose()
    assert broadcaster.subscriber_count == 0

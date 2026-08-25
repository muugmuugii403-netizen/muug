"""Market data давхаргын тестүүд.

Хоёр түвшин:
  1. Provider тест — httpx.MockTransport-оор Twelve Data-ийн бодит хариуны
     форматыг дуурайлгаж parse / retry / rate-limit / error-code логикийг шалгана.
  2. API тест — FastAPI dependency_overrides-оор fake service залгаж
     endpoint-ийн contract (200/404/422/429/502) болон sample горимыг шалгана.

Ажиллуулах: make test   (эсвэл cd backend && .venv/bin/pytest -q)
Гадаад дуудлага огт байхгүй — бүгд детерминист.
"""

from __future__ import annotations

import asyncio
from datetime import datetime, timedelta, timezone
from typing import Any, Iterator

import httpx
import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from app.api.forex import build_market_service, get_market_service
from app.core.config import Settings
from app.core.errors import (
    ProviderAuthError,
    ProviderRateLimitedError,
    ProviderTimeoutError,
    ProviderUnavailableError,
    SymbolNotFoundUpstreamError,
)
from app.main import app
from app.schemas.market import Candle, Interval
from app.services.market_data.providers import RawBar, RawQuote, TwelveDataProvider
from app.services.market_data.service import MarketDataService

API = "/api/forex"

TD_OK_TIME_SERIES: dict[str, Any] = {
    "meta": {"symbol": "EUR/USD", "interval": "5min", "currency": "USD", "exchange": "FX"},
    "values": [
        {"datetime": "2026-02-14 08:00:00", "open": "1.08500", "high": "1.08560", "low": "1.08470", "close": "1.08540"},
        {"datetime": "2026-02-14 08:05:00", "open": "1.08540", "high": "1.08600", "low": "1.08510", "close": "1.08520"},
        {"datetime": "2026-02-14 08:10:00", "open": "1.08520", "high": "1.08545", "low": "1.08430", "close": "1.08450"},
    ],
    "status": "ok",
}

TD_OK_QUOTE: dict[str, Any] = {
    "open": "1.08500",
    "high": "1.08620",
    "low": "1.08410",
    "close": "1.08575",
    "datetime": "2026-02-14 08:12:01",
}


def _run(coro: Any) -> Any:
    return asyncio.run(coro)


def _make_twelve(handler: Any, retries: int = 0) -> TwelveDataProvider:
    return TwelveDataProvider(
        api_key="test-key",
        base_url="https://api.twelvedata.com",
        timeout_s=2.0,
        retries=retries,
        transport=httpx.MockTransport(handler),
    )


# ================= Provider тестүүд =================


class TestTwelveDataProvider:
    def test_time_series_parse(self) -> None:
        """String OHLC → float, UTC aware timestamp, өсөх эрэмбэ."""

        def handler(request: httpx.Request) -> httpx.Response:
            assert request.url.params["interval"] == "5min"
            assert request.url.params["outputsize"] == "200"
            assert request.url.params["apikey"] == "test-key"  # key зөвхөн энд
            return httpx.Response(200, json=TD_OK_TIME_SERIES)

        bars = _run(_make_twelve(handler).fetch_time_series("EUR/USD", Interval.M5, 200))
        assert len(bars) == 3
        assert bars[0].open == pytest.approx(1.08500)
        assert bars[0].timestamp == datetime(2026, 2, 14, 8, 0, tzinfo=timezone.utc)
        assert [b.timestamp for b in bars] == sorted(b.timestamp for b in bars)

    def test_retries_on_500_then_success(self) -> None:
        calls = {"n": 0}

        def handler(request: httpx.Request) -> httpx.Response:
            calls["n"] += 1
            if calls["n"] <= 2:
                return httpx.Response(500, json={"status": "error", "code": 500, "message": "boom"})
            return httpx.Response(200, json=TD_OK_QUOTE)

        quote = _run(_make_twelve(handler, retries=3).fetch_quote("EUR/USD"))
        assert calls["n"] == 3
        assert quote.price == pytest.approx(1.08575)

    def test_429_rate_limit_with_retry_after(self) -> None:
        def handler(request: httpx.Request) -> httpx.Response:
            return httpx.Response(
                429,
                json={"status": "error", "code": 429, "message": "Maximum number of requests reached"},
                headers={"Retry-After": "42"},
            )

        with pytest.raises(ProviderRateLimitedError) as exc_info:
            _run(_make_twelve(handler).fetch_quote("EUR/USD"))
        assert exc_info.value.retry_after == 42

    def test_invalid_symbol_404(self) -> None:
        def handler(request: httpx.Request) -> httpx.Response:
            return httpx.Response(
                404, json={"status": "error", "code": 404, "message": "Symbol not found"}
            )

        with pytest.raises(SymbolNotFoundUpstreamError):
            _run(_make_twelve(handler).fetch_quote("XXX/YYY"))

    def test_invalid_api_key_rejected(self) -> None:
        """Key-ийн дэлгэрэнгүй мэдээлэл дээш задрахгүй — зөвхөн domain алдаа."""

        def handler(request: httpx.Request) -> httpx.Response:
            return httpx.Response(200, json={"status": "error", "code": 501, "message": "Invalid API key"})

        with pytest.raises(ProviderAuthError):
            _run(_make_twelve(handler).fetch_quote("EUR/USD"))

    def test_timeout_maps_to_provider_timeout(self) -> None:
        def handler(request: httpx.Request) -> httpx.Response:
            raise httpx.ConnectTimeout("connect timed out")

        with pytest.raises(ProviderTimeoutError):
            _run(_make_twelve(handler, retries=0).fetch_quote("EUR/USD"))


# ================= API тестүүд =================


class _FakeProvider:
    """Тогтмол, зөв OHLC буцаадаг fake provider."""

    source = "twelvedata"

    def __init__(self, *, quote_fails: Exception | None = None) -> None:
        self._quote_fails = quote_fails

    async def fetch_time_series(self, symbol: str, interval: Interval, outputsize: int) -> list[RawBar]:
        start = datetime(2026, 2, 14, tzinfo=timezone.utc)
        return [
            RawBar(
                timestamp=start + timedelta(minutes=5 * i),
                open=1.1000,
                high=1.1010,
                low=1.0990,
                close=1.1005,
            )
            for i in range(min(outputsize, 10))
        ]

    async def fetch_quote(self, symbol: str) -> RawQuote:
        if self._quote_fails is not None:
            raise self._quote_fails
        return RawQuote(price=1.1000, timestamp=datetime(2026, 2, 14, 8, 12, tzinfo=timezone.utc))

    async def aclose(self) -> None:
        return None


@pytest.fixture()
def api() -> Iterator[TestClient]:
    service = MarketDataService(provider=_FakeProvider(), candles_ttl_s=0, quote_ttl_s=0)
    app.dependency_overrides[get_market_service] = lambda: service
    yield TestClient(app, raise_server_exceptions=False)
    app.dependency_overrides.clear()


class TestForexApi:
    def test_candles_contract(self, api: TestClient) -> None:
        res = api.get(f"{API}/candles/EUR%2FUSD", params={"interval": "5min", "outputsize": 10})
        assert res.status_code == 200
        body = res.json()
        assert body["symbol"] == "EUR/USD"
        assert body["interval"] == "5min"
        assert body["count"] == len(body["candles"]) == 10
        assert body["source"] == "twelvedata"
        first = body["candles"][0]
        assert set(first) == {"timestamp", "open", "high", "low", "close"}
        stamps = [c["timestamp"] for c in body["candles"]]
        assert stamps == sorted(stamps)  # өсөх эрэмбэ

    def test_candles_15min_interval(self, api: TestClient) -> None:
        res = api.get(f"{API}/candles/GBP%2FUSD", params={"interval": "15min"})
        assert res.status_code == 200
        assert res.json()["interval"] == "15min"

    def test_quote_contract(self, api: TestClient) -> None:
        res = api.get(f"{API}/quote/EUR%2FUSD")
        assert res.status_code == 200
        q = res.json()
        assert q["symbol"] == "EUR/USD"
        assert q["bid"] < q["price"] < q["ask"]
        assert q["spread"] == pytest.approx(q["ask"] - q["bid"])
        assert {"timestamp", "source"} <= set(q)

    def test_invalid_symbol_404(self, api: TestClient) -> None:
        res = api.get(f"{API}/quote/XXX%2FYYY")
        assert res.status_code == 404
        assert res.json()["error"] == "SYMBOL_NOT_SUPPORTED"

    def test_invalid_interval_422(self, api: TestClient) -> None:
        res = api.get(f"{API}/candles/EUR%2FUSD", params={"interval": "1h"})
        assert res.status_code == 422
        assert res.json()["error"] == "validation_error"

    @pytest.mark.parametrize("bad_size", [0, -5, 5001, 999999])
    def test_outputsize_bounds_422(self, api: TestClient, bad_size: int) -> None:
        res = api.get(f"{API}/candles/EUR%2FUSD", params={"outputsize": bad_size})
        assert res.status_code == 422

    def test_rate_limit_429_with_header(self) -> None:
        failing = MarketDataService(
            provider=_FakeProvider(
                quote_fails=ProviderRateLimitedError("хязгаар дууслаа", retry_after=33)
            ),
            candles_ttl_s=0,
            quote_ttl_s=0,
        )
        app.dependency_overrides[get_market_service] = lambda: failing
        try:
            res = TestClient(app, raise_server_exceptions=False).get(f"{API}/quote/EUR%2FUSD")
            assert res.status_code == 429
            assert res.headers["Retry-After"] == "33"
            assert res.json()["error"] == "MARKET_DATA_RATE_LIMITED"
        finally:
            app.dependency_overrides.clear()

    def test_provider_unavailable_502(self) -> None:
        failing = MarketDataService(
            provider=_FakeProvider(quote_fails=ProviderUnavailableError("upstream down")),
            candles_ttl_s=0,
            quote_ttl_s=0,
        )
        app.dependency_overrides[get_market_service] = lambda: failing
        try:
            res = TestClient(app, raise_server_exceptions=False).get(f"{API}/quote/EUR%2FUSD")
            assert res.status_code == 502
            assert res.json()["error"] == "MARKET_DATA_UNAVAILABLE"
        finally:
            app.dependency_overrides.clear()


class TestSampleMode:
    def test_sample_provider_when_no_key(self) -> None:
        """Key хоосон + fallback асаалттай → source='sample', 200 лаан, зөв OHLC."""
        settings = Settings(twelve_data_api_key="", sample_fallback_enabled=True)  # type: ignore[call-arg]
        service = build_market_service(settings)
        assert service.provider.source == "sample"

        res = TestClient(app, raise_server_exceptions=False)
        # service-ийг шууд дуудаж шалгана (DI override хэрэггүй)
        candles = _run(service.get_candles("EUR/USD", Interval.M5, 200))
        assert candles.source == "sample"
        assert candles.count == 200
        assert all(c.high >= max(c.open, c.close) for c in candles.candles)
        assert [c.timestamp for c in candles.candles] == sorted(c.timestamp for c in candles.candles)

        quote = _run(service.get_quote("USD/JPY"))
        assert quote.source == "sample"
        assert quote.bid < quote.price < quote.ask
        assert quote.spread > 0

    def test_candle_model_rejects_bad_ohlc(self) -> None:
        with pytest.raises(ValidationError):
            Candle(
                timestamp=datetime(2026, 2, 14, tzinfo=timezone.utc),
                open=1.10,
                high=1.05,  # high < open — зөрчилтэй
                low=1.04,
                close=1.09,
            )

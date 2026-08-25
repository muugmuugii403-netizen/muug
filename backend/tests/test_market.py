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
import types
from datetime import datetime, timedelta, timezone
from typing import Any, Iterator

import httpx
import pandas as pd
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
from app.services.market_data import providers as providers_module
from app.services.market_data.providers import (
    RawBar,
    RawQuote,
    TwelveDataProvider,
    YFinanceProvider,
)
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


# ---------- YFinance fallback (networkгүй, детерминист) ----------


class _FakeTicker:
    """yf.Ticker-ийн орлуулагч — сүлжээнд гарахгүй."""

    def __init__(
        self,
        df: pd.DataFrame | None = None,
        last_price: float | None = None,
        fail_fast_info: bool = False,
    ) -> None:
        self._df = df if df is not None else pd.DataFrame()
        self._last_price = last_price
        self._fail_fast_info = fail_fast_info
        self.history_calls: list[dict[str, Any]] = []

    @property
    def fast_info(self) -> Any:
        if self._fail_fast_info or self._last_price is None:
            raise RuntimeError("fast_info боломжгүй")
        return types.SimpleNamespace(last_price=self._last_price)

    def history(self, **kwargs: Any) -> pd.DataFrame:
        self.history_calls.append(kwargs)
        return self._df


class _FakeYf:
    """yf модулийн орлуулагч — ашиглагдсан symbol-ийг тэмдэглэнэ."""

    def __init__(self, ticker: _FakeTicker) -> None:
        self._ticker = ticker
        self.last_symbol: str | None = None

    def Ticker(self, symbol: str) -> _FakeTicker:  # noqa: N802 — yfinance API нэр
        self.last_symbol = symbol
        return self._ticker


def _ohlc_df(periods: int = 6, tz: str | None = "America/New_York") -> pd.DataFrame:
    """5 минутын зайтай, тогтмол OHLC утгатай DataFrame."""
    idx = pd.date_range("2026-02-10 09:30", periods=periods, freq="5min", tz=tz)
    base = [2680.0 + i for i in range(periods)]
    return pd.DataFrame(
        {
            "Open": base,
            "High": [b + 1.5 for b in base],
            "Low": [b - 1.5 for b in base],
            "Close": [b + 0.5 for b in base],
        },
        index=idx,
    )


class TestProviderSelection:
    def test_yfinance_selected_when_no_key(self) -> None:
        """Key хоосон → YFinance LIVE provider сонгогдоно (сүлжээнд гарахгүй)."""
        service = build_market_service(Settings(twelve_data_api_key=""))
        assert isinstance(service.provider, YFinanceProvider)
        assert service.provider.source == "yfinance"

    def test_twelvedata_preferred_when_key_present(self) -> None:
        service = build_market_service(Settings(twelve_data_api_key="test-key"))
        assert isinstance(service.provider, TwelveDataProvider)
        assert service.provider.source == "twelvedata"


class TestYFinanceProvider:
    """YFinanceProvider unit тестүүд — yf.Ticker бүрэн орлуулсан, детерминист."""

    def _patch(self, monkeypatch: pytest.MonkeyPatch, ticker: _FakeTicker) -> _FakeYf:
        fake_yf = _FakeYf(ticker)
        monkeypatch.setattr(providers_module, "yf", fake_yf)
        return fake_yf

    def test_fetch_time_series_converts_to_utc(self, monkeypatch: pytest.MonkeyPatch) -> None:
        fake_yf = self._patch(monkeypatch, _FakeTicker(df=_ohlc_df()))
        provider = YFinanceProvider()

        bars = _run(provider.fetch_time_series("XAU/USD", Interval.M5, 200))

        assert fake_yf.last_symbol == "GC=F"  # symbol mapping ажилласан
        assert len(bars) == 6
        assert all(b.timestamp.tzinfo is not None for b in bars)
        assert all(b.timestamp.utcoffset() == timedelta(0) for b in bars)
        # NY 09:30 (EST, UTC-5) → UTC 14:30
        assert bars[0].timestamp == datetime(2026, 2, 10, 14, 30, tzinfo=timezone.utc)
        assert bars[0].open == 2680.0
        assert bars[0].high == 2681.5
        assert bars[0].low == 2678.5
        assert bars[0].close == 2680.5
        assert [b.timestamp for b in bars] == sorted(b.timestamp for b in bars)

    def test_fetch_time_series_outputsize_tail(self, monkeypatch: pytest.MonkeyPatch) -> None:
        self._patch(monkeypatch, _FakeTicker(df=_ohlc_df(periods=6)))
        provider = YFinanceProvider()
        bars = _run(provider.fetch_time_series("EUR/USD", Interval.M15, 3))
        assert len(bars) == 3  # сүүлийн 3 лаа
        assert bars[0].open == 2683.0

    def test_fetch_time_series_naive_index_localized(self, monkeypatch: pytest.MonkeyPatch) -> None:
        self._patch(monkeypatch, _FakeTicker(df=_ohlc_df(periods=2, tz=None)))
        provider = YFinanceProvider()
        bars = _run(provider.fetch_time_series("GBP/USD", Interval.M5, 10))
        assert bars[0].timestamp == datetime(2026, 2, 10, 9, 30, tzinfo=timezone.utc)

    def test_fetch_time_series_empty_raises_unavailable(self, monkeypatch: pytest.MonkeyPatch) -> None:
        self._patch(monkeypatch, _FakeTicker(df=pd.DataFrame()))
        provider = YFinanceProvider()
        with pytest.raises(ProviderUnavailableError):
            _run(provider.fetch_time_series("EUR/USD", Interval.M5, 200))

    def test_fetch_time_series_network_error_wrapped(self, monkeypatch: pytest.MonkeyPatch) -> None:
        class _ExplodingTicker(_FakeTicker):
            def history(self, **kwargs: Any) -> pd.DataFrame:
                raise ConnectionError("network down")

        self._patch(monkeypatch, _ExplodingTicker())
        provider = YFinanceProvider()
        with pytest.raises(ProviderUnavailableError):
            _run(provider.fetch_time_series("EUR/USD", Interval.M5, 200))

    def test_fetch_time_series_range_filters_inclusive_end(self, monkeypatch: pytest.MonkeyPatch) -> None:
        fake = _FakeTicker(df=_ohlc_df(periods=6))
        self._patch(monkeypatch, fake)
        provider = YFinanceProvider()

        start = datetime(2026, 2, 10, 14, 30, tzinfo=timezone.utc)
        end = datetime(2026, 2, 10, 14, 40, tzinfo=timezone.utc)
        bars = _run(provider.fetch_time_series_range("XAU/USD", Interval.M5, start, end))

        # 14:30, 14:35, 14:40 — inclusive; 14:45+ хасагдсан
        assert [b.timestamp for b in bars] == [
            datetime(2026, 2, 10, 14, 30, tzinfo=timezone.utc),
            datetime(2026, 2, 10, 14, 35, tzinfo=timezone.utc),
            datetime(2026, 2, 10, 14, 40, tzinfo=timezone.utc),
        ]
        assert fake.history_calls[0]["interval"] == "5m"
        assert fake.history_calls[0]["start"] == start

    def test_fetch_quote_uses_fast_info(self, monkeypatch: pytest.MonkeyPatch) -> None:
        self._patch(monkeypatch, _FakeTicker(last_price=2685.42))
        provider = YFinanceProvider()
        quote = _run(provider.fetch_quote("XAU/USD"))
        assert quote.price == 2685.42
        assert quote.timestamp.tzinfo is not None

    def test_fetch_quote_falls_back_to_1m_history(self, monkeypatch: pytest.MonkeyPatch) -> None:
        df = pd.DataFrame(
            {"Close": [2684.0, 2685.1]},
            index=pd.date_range("2026-02-10 15:58", periods=2, freq="1min", tz="UTC"),
        )
        fake = _FakeTicker(df=df, fail_fast_info=True)
        self._patch(monkeypatch, fake)
        provider = YFinanceProvider()
        quote = _run(provider.fetch_quote("XAU/USD"))
        assert quote.price == 2685.1
        assert fake.history_calls[0]["interval"] == "1m"

    def test_fetch_quote_all_paths_fail_raises(self, monkeypatch: pytest.MonkeyPatch) -> None:
        self._patch(monkeypatch, _FakeTicker(df=pd.DataFrame(), fail_fast_info=True))
        provider = YFinanceProvider()
        with pytest.raises(ProviderUnavailableError):
            _run(provider.fetch_quote("XAU/USD"))


class TestCandleValidation:
    def test_candle_model_rejects_bad_ohlc(self) -> None:
        with pytest.raises(ValidationError):
            Candle(
                timestamp=datetime(2026, 2, 14, tzinfo=timezone.utc),
                open=1.10,
                high=1.05,  # high < open — зөрчилтэй
                low=1.04,
                close=1.09,
            )

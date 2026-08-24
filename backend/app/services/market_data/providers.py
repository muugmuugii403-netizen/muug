"""Provider давхарга — гадаад market data эх сурвалжууд.

Одоогоор хоёр provider байна:
  • TwelveDataProvider — бодит өгөгдөл (https://api.twelvedata.com/docs дахь
    /time_series ба /quote endpoint-үүд). Timeout, retry (5xx/сүлжээнд),
    rate-limit (429 + Retry-After) болон provider-ийн алдааны код боловсруулалттай.
  • SampleDataProvider — API keyгүй үед локал dev-д зориулсан,
    ДЕТЕРМИНИСТ (seed-тэй) жишээ өгөгдөл. Хариунд source="sample" гэж
    тод тэмдэглэгдэнэ; production-д хэзээ ч бодит өгөгдөл шиг хэрэглэгдэхгүй.

API key зөвхөн TwelveDataProvider._get_json-д параметр болж нэмэгдэнэ,
лог-д хэзээ ч хэвлэгдэхгүй.
"""

from __future__ import annotations

import asyncio
import logging
import random
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Protocol, runtime_checkable

import httpx

from app.core.errors import (
    ProviderAuthError,
    ProviderRateLimitedError,
    ProviderRequestRejectedError,
    ProviderTimeoutError,
    ProviderUnavailableError,
    SymbolNotFoundUpstreamError,
)
from app.schemas.market import Interval

logger = logging.getLogger("forex_analyzer.market")

_DEFAULT_RETRY_AFTER_S = 60


@dataclass(frozen=True)
class RawBar:
    """Provider-аас ирсэн, хараахан validate-аагүй нэг лаан."""

    timestamp: datetime
    open: float
    high: float
    low: float
    close: float


@dataclass(frozen=True)
class RawQuote:
    """Provider-аас ирсэн сүүлийн үнэ."""

    price: float
    timestamp: datetime


@runtime_checkable
class MarketDataProvider(Protocol):
    """Бүх provider-ийн нийтлэг гэрээ."""

    source: str

    async def fetch_time_series(self, symbol: str, interval: Interval, outputsize: int) -> list[RawBar]:
        """`outputsize` ширхэг OHLC лааг цагаар өсөх эрэмбээр буцаана."""

    async def fetch_quote(self, symbol: str) -> RawQuote:
        """Сүүлийн үнэ (mid) буцаана."""

    async def aclose(self) -> None:
        """Нөөц чөлөөлнө."""


def _parse_utc(value: str) -> datetime:
    """'2026-02-14 08:30:00' (Twelve Data, timezone=UTC) → aware datetime."""
    return datetime.strptime(value, "%Y-%m-%d %H:%M:%S").replace(tzinfo=timezone.utc)


def _to_float(raw: Any, field: str) -> float:
    try:
        return float(raw)
    except (TypeError, ValueError) as exc:
        raise ProviderUnavailableError(f"Provider хариуны '{field}' талбар тоо биш байна") from exc


class TwelveDataProvider:
    """https://api.twelvedata.com — /time_series ба /quote.

    Rate limit (free): 8 credit/мин, 800 credit/өдөр. Хязгаар давсан үед
    HTTP 429 + Retry-After header ирдэг тул бид retry хийхгүйгээр тэр хугацааг
    дээш дамжуулна. 5xx болон сүлжээний алдаанд exponential backoff-той retry.
    """

    source: str = "twelvedata"

    def __init__(
        self,
        api_key: str,
        base_url: str = "https://api.twelvedata.com",
        timeout_s: float = 8.0,
        retries: int = 3,
        transport: httpx.AsyncBaseTransport | None = None,  # тестэд MockTransport
    ) -> None:
        if not api_key:
            raise ValueError("TwelveDataProvider-т API key заавал шаардлагатай")
        self._api_key = api_key
        self._retries = max(0, retries)
        self._client = httpx.AsyncClient(
            base_url=base_url,
            timeout=httpx.Timeout(timeout_s),
            transport=transport,
        )

    async def aclose(self) -> None:
        await self._client.aclose()

    # ---------- нийтлэг HTTP逻辑 ----------

    async def _get_json(self, path: str, params: dict[str, str | int]) -> dict[str, Any]:
        """Timeout + retry + rate-limit + error-code боловсруулалттай GET.

        `params`-д apikey-г энд нэмнэ — лог-д params-ийг хэзээ ч хэвлэхгүй.
        """
        full_params: dict[str, str | int] = {**params, "apikey": self._api_key}
        last_error: Exception | None = None

        for attempt in range(self._retries + 1):
            try:
                resp = await self._client.get(path, params=full_params)
            except httpx.TimeoutException as exc:
                last_error = exc
                logger.warning("%s timeout (оролдлого %d/%d)", path, attempt + 1, self._retries + 1)
            except httpx.TransportError as exc:
                last_error = exc
                logger.warning("%s сүлжээний алдаа: %s (оролдлого %d/%d)", path, exc, attempt + 1, self._retries + 1)
            else:
                if resp.status_code == 429:
                    retry_after = _retry_after_from(resp)
                    logger.error("Twelve Data rate limit (429), Retry-After=%ss", retry_after)
                    raise ProviderRateLimitedError(
                        "Market data provider-ийн хүсэлтийн хязгаар дууслаа. Түр хүлээгээд дахин оролдоно уу.",
                        retry_after=retry_after,
                    )
                if resp.status_code >= 500:
                    last_error = ProviderUnavailableError(f"Provider серверийн алдаа (HTTP {resp.status_code})")
                    logger.warning("%s → HTTP %d (оролдлого %d/%d)", path, resp.status_code, attempt + 1, self._retries + 1)
                elif resp.status_code >= 400 or _is_error_body(resp):
                    raise self._map_client_error(resp)
                else:
                    return resp.json()  # type: ignore[no-any-return]

            if attempt < self._retries:
                await asyncio.sleep(0.5 * (2**attempt))  # 0.5s → 1s → 2s

        if isinstance(last_error, ProviderUnavailableError):
            raise last_error
        raise ProviderTimeoutError("Market data provider руу холбогдож чадсангүй (timeout)") from last_error

    @staticmethod
    def _map_client_error(resp: httpx.Response) -> Exception:
        """HTTP 4xx эсвэл body-доо status=error агуулсан хариуг domain алдаа болгоно."""
        body: dict[str, Any] = {}
        try:
            body = resp.json()
        except ValueError:
            pass
        code = _as_int(body.get("code")) or resp.status_code
        message = str(body.get("message", ""))[:200]  # upstream мессеж хязгаартай
        if code == 429:
            return ProviderRateLimitedError(
                "Market data provider-ийн хүсэлтийн хязгаар дууслаа.",
                retry_after=_retry_after_from(resp),
            )
        if code in (401, 501):
            # API key буруу — дэлгэрэнгүйг нь client руу гаргахгүй
            return ProviderAuthError("Market data provider-ийн түлхүүр хүчингүй байна. Админ-д хандана уу.")
        if code == 404:
            return SymbolNotFoundUpstreamError(f"Provider symbol-ийг танихгүй байна: {message or 'N/A'}")
        if code == 422:
            return ProviderRequestRejectedError(f"Provider хүсэлтийг хүлээж авсангүй: {message or 'N/A'}")
        return ProviderUnavailableError(f"Provider алдаа буцаалаа (code={code})")

    # ---------- endpoint-үүд ----------

    async def fetch_time_series(self, symbol: str, interval: Interval, outputsize: int) -> list[RawBar]:
        logger.info("time_series: %s %s ×%d", symbol, interval.value, outputsize)
        data = await self._get_json(
            "/time_series",
            {
                "symbol": symbol,
                "interval": interval.value,
                "outputsize": outputsize,
                "order": "ASC",
                "timezone": "UTC",
                "format": "JSON",
            },
        )
        values = data.get("values")
        if not isinstance(values, list):
            raise ProviderUnavailableError("Provider хариу 'values' жагсаалтгүй байна")
        bars: list[RawBar] = []
        for item in values:
            if not isinstance(item, dict):
                raise ProviderUnavailableError("'values' доторх элемент буруу форматтай")
            bars.append(
                RawBar(
                    timestamp=_parse_utc(str(item["datetime"])),
                    open=_to_float(item.get("open"), "open"),
                    high=_to_float(item.get("high"), "high"),
                    low=_to_float(item.get("low"), "low"),
                    close=_to_float(item.get("close"), "close"),
                )
            )
        bars.sort(key=lambda b: b.timestamp)
        logger.info("time_series: %s → %d лаан", symbol, len(bars))
        return bars

    async def fetch_quote(self, symbol: str) -> RawQuote:
        logger.info("quote: %s", symbol)
        data = await self._get_json("/quote", {"symbol": symbol, "format": "JSON"})
        price = _to_float(data.get("close") or data.get("price"), "close")
        dt_raw = data.get("datetime")
        timestamp = _parse_utc(str(dt_raw)) if dt_raw else datetime.now(timezone.utc)
        return RawQuote(price=price, timestamp=timestamp)


class SampleDataProvider:
    """API keyгүй үеийн локал demo provider — детерминист санамсаргүй алхалт.

    (symbol, interval) хос бүрт ижил seed → ижил үнийн цуваа гарах тул
    frontend-ийг бодит API-гүйгээр бүрэн хөгжүүлж, тестлэх боломжтой.
    """

    source: str = "sample"

    _BASE_PRICES: dict[str, float] = {
        "EUR/USD": 1.0850,
        "GBP/USD": 1.2700,
        "USD/JPY": 149.50,
        "AUD/USD": 0.6550,
        "USD/CAD": 1.3600,
        "USD/CHF": 0.8820,
        "NZD/USD": 0.5950,
    }

    async def aclose(self) -> None:  # pragma: no cover — нөөц байхгүй
        return None

    def _series(self, symbol: str, interval: Interval, size: int) -> list[RawBar]:
        rng = random.Random(f"{symbol}|{interval.value}")
        base = self._BASE_PRICES.get(symbol, 1.0)
        vol = 0.0006 * ((interval.seconds / 300) ** 0.5)  # timeframe-аас хамаарсан хэлбэлзэл

        end = int(datetime.now(timezone.utc).timestamp())
        end -= end % interval.seconds  # interval-ын хилд эгнүүлнэ

        price = base * (1 + rng.uniform(-0.004, 0.004))
        bars: list[RawBar] = []
        for i in range(size):
            ts = datetime.fromtimestamp(end - (size - 1 - i) * interval.seconds, tz=timezone.utc)
            o = price
            c = o * (1 + rng.gauss(0.0, vol))
            hi = max(o, c) * (1 + abs(rng.gauss(0.0, vol / 3)))
            lo = min(o, c) * (1 - abs(rng.gauss(0.0, vol / 3)))
            bars.append(RawBar(timestamp=ts, open=o, high=hi, low=lo, close=c))
            price = c
        return bars

    async def fetch_time_series(self, symbol: str, interval: Interval, outputsize: int) -> list[RawBar]:
        logger.info("sample time_series: %s %s ×%d", symbol, interval.value, outputsize)
        return self._series(symbol, interval, outputsize)

    async def fetch_quote(self, symbol: str) -> RawQuote:
        bars = self._series(symbol, Interval.M5, 50)
        return RawQuote(price=bars[-1].close, timestamp=datetime.now(timezone.utc))


def _retry_after_from(resp: httpx.Response) -> int:
    """Retry-After header-ийг секундээр авна; байхгүй бол 60с."""
    raw = resp.headers.get("Retry-After")
    if raw and raw.isdigit():
        return max(1, int(raw))
    return _DEFAULT_RETRY_AFTER_S


def _as_int(value: Any) -> int | None:
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def _is_error_body(resp: httpx.Response) -> bool:
    """Twelve Data зарим алдааг HTTP 200-д body status=error-ээр илгээдэг."""
    if resp.status_code != 200:
        return False
    try:
        return str(resp.json().get("status")) == "error"
    except ValueError:
        return False

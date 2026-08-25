"""Provider давхарга — гадаад market data эх сурвалжууд.

Гурван provider байна:
  • TwelveDataProvider — бодит өгөгдөл (https://api.twelvedata.com/docs дахь
    /time_series ба /quote endpoint-үүд). Timeout, retry (5xx/сүлжээнд),
    rate-limit (429 + Retry-After) болон provider-ийн алдааны код боловсруулалттай.
  • YFinanceProvider — Twelve Data keyгүй үед автоматаар сонгогдох LIVE
    fallback (Yahoo Finance). source="yfinance". Синхрон yfinance санг
    event loop блоклохгүйгээр asyncio.to_thread-ээр дуудна.
  • SampleDataProvider — ДЕТЕРМИНИСТ (seed-тэй) жишээ өгөгдөл; зөвхөн
    тестэд хэрэглэгдэнэ. Хариунд source="sample" гэж тод тэмдэглэгдэнэ;
    production-д хэзээ ч бодит өгөгдөл шиг хэрэглэгдэхгүй.

API key зөвхөн TwelveDataProvider._get_json-д параметр болж нэмэгдэнэ,
лог-д хэзээ ч хэвлэгдэхгүй.
"""

from __future__ import annotations

import asyncio
import logging
import math
import random
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any, Protocol, runtime_checkable

import httpx
import pandas as pd
import yfinance as yf

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
_MAX_RANGE_PAGES = 8  # backtest range fetch-ийн дээд хуудас
_PAGE_SIZE = 5000  # Twelve Data outputsize дээд хязгаар
_PAGE_DELAY_S = 0.15  # хуудас хоорондын зай (rate limit-д зөөлөн)


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

    async def fetch_time_series_range(
        self, symbol: str, interval: Interval, start: datetime, end: datetime
    ) -> list[RawBar]:
        """[start, end] мужийн OHLC лаануудыг цагаар өсөх эрэмбээр буцаана (backtest)."""

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
        bars = self._parse_values(data)
        bars.sort(key=lambda b: b.timestamp)
        logger.info("time_series: %s → %d лаан", symbol, len(bars))
        return bars

    async def fetch_time_series_range(
        self, symbol: str, interval: Interval, start: datetime, end: datetime
    ) -> list[RawBar]:
        """[start, end] мужийн лаанууд — outputsize=5000 хязгаар тул хуудаслалттай.

        Төвөгтэй байдлаас зайлсхийх үүднээс end_date-ийг аажим ухрааж, давхардлыг
        timestamp-аар няцаана. Rate limit-д хүндэтгэлтэй: хуудас бүрийн хооронд
        богино зай авна.
        """
        logger.info("time_series_range: %s %s [%s → %s]", symbol, interval.value, start, end)
        collected: dict[datetime, RawBar] = {}
        cursor_end = end
        for _ in range(_MAX_RANGE_PAGES):
            data = await self._get_json(
                "/time_series",
                {
                    "symbol": symbol,
                    "interval": interval.value,
                    "outputsize": _PAGE_SIZE,
                    "order": "ASC",
                    "timezone": "UTC",
                    "format": "JSON",
                    "start_date": start.strftime("%Y-%m-%d %H:%M:%S"),
                    "end_date": cursor_end.strftime("%Y-%m-%d %H:%M:%S"),
                },
            )
            bars = self._parse_values(data)
            if not bars:
                break
            for bar in bars:
                collected[bar.timestamp] = bar
            oldest = min(b.timestamp for b in bars)
            if oldest <= start:
                break
            # Дараагийн хуудас: хамгийн эртний лаанаас өмнөх муж
            cursor_end = oldest - timedelta(seconds=1)
            if cursor_end <= start:
                break
            await asyncio.sleep(_PAGE_DELAY_S)  # rate limit-д зөөлөн хандах

        result = sorted(collected.values(), key=lambda b: b.timestamp)
        logger.info("time_series_range: %s → %d лаан", symbol, len(result))
        return result

    @staticmethod
    def _parse_values(data: dict[str, Any]) -> list[RawBar]:
        """'values' жагсаалтыг RawBar болгон хөрвүүлнэ (ерөнхий helper)."""
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
        "XAU/USD": 2685.00,  # Gold Spot — ойролцоо сүүлийн үнэ
    }

    def __init__(self) -> None:
        self._trend_cache: dict[str, list[tuple[float, float, float]]] = {}

    async def aclose(self) -> None:  # pragma: no cover — нөөц байхгүй
        return None

    def _trend_factor(self, symbol: str, t: int) -> float:
        """Детерминист, t-ээс хамаарсан зөлгөө тренд (хэдэн синус долгионы нийлбэр).

        Ижил t → ижил тренд тул давхцсан мужуудад үнэ тогтвортой байна. Тренд нь
        EMA20/50 огтлолцол үүсгэж, backtest-д бодит BUY/SELL гарах нөхцөл бүрдүүлнэ.
        """
        key = f"{symbol}|trend"
        if key not in self._trend_cache:
            rng = random.Random(key)
            periods = [3600 * 4, 3600 * 9, 3600 * 20, 86400 * 2.7, 86400 * 6.3]
            self._trend_cache[key] = [
                (rng.uniform(0.002, 0.0055), rng.choice(periods), rng.uniform(0, 2 * math.pi))
                for _ in range(5)
            ]
        total = 0.0
        for amp, period, phase in self._trend_cache[key]:
            total += amp * math.sin(2 * math.pi * t / period + phase)
        return 1.0 + total

    def _series_range(self, symbol: str, interval: Interval, start: datetime, end: datetime) -> list[RawBar]:
        """[start, end] мужид детерминист лаанууд үүсгэнэ."""
        base = self._BASE_PRICES.get(symbol, 1.0)
        vol = 0.0006 * ((interval.seconds / 300) ** 0.5)
        step = interval.seconds

        t0 = int(start.timestamp())
        t0 -= t0 % step  # interval-ын хилд эгнүүлнэ
        t1 = int(end.timestamp())

        bars: list[RawBar] = []
        t = t0
        while t <= t1:
            rng = random.Random(f"{symbol}|{interval.value}|{t}")
            trend = self._trend_factor(symbol, t)
            o = base * trend * (1 + rng.uniform(-0.0008, 0.0008))
            c = o * (1 + rng.gauss(0.0, vol))
            hi = max(o, c) * (1 + abs(rng.gauss(0.0, vol / 3)))
            lo = min(o, c) * (1 - abs(rng.gauss(0.0, vol / 3)))
            ts = datetime.fromtimestamp(t, tz=timezone.utc)
            bars.append(RawBar(timestamp=ts, open=o, high=hi, low=lo, close=c))
            t += step
        return bars

    def _series(self, symbol: str, interval: Interval, size: int) -> list[RawBar]:
        """Сүүлийн `size` лаа (одоо цагаас ухрааж) — `_series_range` дээр суурилна."""
        now = int(datetime.now(timezone.utc).timestamp())
        now -= now % interval.seconds
        start = datetime.fromtimestamp(now - (size - 1) * interval.seconds, tz=timezone.utc)
        end = datetime.fromtimestamp(now, tz=timezone.utc)
        return self._series_range(symbol, interval, start, end)

    async def fetch_time_series(self, symbol: str, interval: Interval, outputsize: int) -> list[RawBar]:
        logger.info("sample time_series: %s %s ×%d", symbol, interval.value, outputsize)
        return self._series(symbol, interval, outputsize)

    async def fetch_time_series_range(
        self, symbol: str, interval: Interval, start: datetime, end: datetime
    ) -> list[RawBar]:
        logger.info("sample time_series_range: %s %s [%s → %s]", symbol, interval.value, start, end)
        return self._series_range(symbol, interval, start, end)

    async def fetch_quote(self, symbol: str) -> RawQuote:
        bars = self._series(symbol, Interval.M5, 50)
        return RawQuote(price=bars[-1].close, timestamp=datetime.now(timezone.utc))


class YFinanceProvider:
    """Yahoo Finance (yfinance) — Twelve Data keyгүй үеийн LIVE fallback.

    `.env`-д `TWELVE_DATA_API_KEY` хоосон байхад автоматаар сонгогдож,
    бодит зах зээлийн өгөгдөл авахад хэрэглэгдэнэ (source="yfinance").

    Анхаарах зүйлс:
      • XAU/USD нь GC=F (Gold Futures) symbol-аар ирнэ — spot-той ойролцоо
        боловч фьючерсийн ханш тул бага зэрэг зөрүүтэй байж болно.
      • yfinance нь синхрон сан тул event loop-ыг блоклохгүйн тулд бүх
        дуудлага `asyncio.to_thread`-ээр thread pool-д ажиллана.
      • 5m/15m intraday өгөгдөл сүүлийн ~60 өдрөөр хязгаарлагдана
        (backtest-ийн 31 өдрийн хязгаартай нийцнэ).
      • Timestamp бүр UTC болгон normalize хийгдэнэ.
    """

    source: str = "yfinance"

    SYMBOL_MAP: dict[str, str] = {
        "XAU/USD": "GC=F",  # Gold Futures — spot-ийн proxy
        "EUR/USD": "EURUSD=X",
        "GBP/USD": "GBPUSD=X",
        "USD/JPY": "JPY=X",
        "AUD/USD": "AUDUSD=X",
        "USD/CAD": "CAD=X",
        "USD/CHF": "CHF=X",
        "NZD/USD": "NZDUSD=X",
    }

    # Манай Interval enum ("5min"/"15min") → yfinance формат ("5m"/"15m")
    _YF_INTERVALS: dict[Interval, str] = {Interval.M5: "5m", Interval.M15: "15m"}

    async def aclose(self) -> None:  # pragma: no cover — чөлөөлөх нөөцгүй
        return None

    # ---------- туслагч ----------

    def _require_mapped(self, symbol: str) -> str:
        mapped = self.SYMBOL_MAP.get(symbol)
        if mapped is None:
            raise SymbolNotFoundUpstreamError(f"YFinance mapping тодорхойгүй: {symbol}")
        return mapped

    def _history_sync(self, yf_symbol: str, max_ts: datetime | None = None, **kwargs: Any) -> list[RawBar]:
        """Синхрон worker — thread pool-д ажиллана. `kwargs` нь yf history()-д очно."""
        df = yf.Ticker(yf_symbol).history(**kwargs)
        if df is None or df.empty:
            raise ProviderUnavailableError(f"YFinance '{yf_symbol}' өгөгдөл буцаасангүй")
        df = df.dropna(subset=["Open", "High", "Low", "Close"])
        if df.empty:
            raise ProviderUnavailableError(f"YFinance '{yf_symbol}' мөрүүд бүгд NaN байна")
        index = _to_utc_index(df.index)
        bars = [
            RawBar(
                timestamp=ts.to_pydatetime(),
                open=float(row["Open"]),
                high=float(row["High"]),
                low=float(row["Low"]),
                close=float(row["Close"]),
            )
            for ts, row in zip(index, df.to_dict("records"))
        ]
        bars.sort(key=lambda b: b.timestamp)
        if max_ts is not None:
            # yfinance-ийн end параметр EXCLUSIVE тул inclusive-ээр хайчилна
            bars = [b for b in bars if b.timestamp <= max_ts]
        return bars

    def _last_price_sync(self, yf_symbol: str) -> float:
        """fast_info.last_price; амжилтгүй бол сүүлийн 1m лааны close."""
        ticker = yf.Ticker(yf_symbol)
        price: float | None = None
        try:
            price = float(ticker.fast_info.last_price)
        except Exception:  # noqa: BLE001 — fast_info олон янзаар амжилтгүй болдог
            price = None
        if price is not None and math.isfinite(price) and price > 0:
            return price
        df = ticker.history(period="1d", interval="1m")
        if df is None or df.empty or "Close" not in df.columns:
            raise ProviderUnavailableError(f"YFinance '{yf_symbol}' сүүлийн үнэ олж чадсангүй")
        closes = df["Close"].dropna()
        if closes.empty:
            raise ProviderUnavailableError(f"YFinance '{yf_symbol}' close утга хоосон байна")
        return float(closes.iloc[-1])

    # ---------- MarketDataProvider интерфейс ----------

    async def fetch_time_series(self, symbol: str, interval: Interval, outputsize: int) -> list[RawBar]:
        yf_symbol = self._require_mapped(symbol)
        yf_interval = self._YF_INTERVALS[interval]
        logger.info("yfinance time_series: %s (%s) %s ×%d", symbol, yf_symbol, yf_interval, outputsize)
        try:
            bars = await asyncio.to_thread(
                self._history_sync, yf_symbol, None, period="5d", interval=yf_interval
            )
        except ProviderUnavailableError:
            raise
        except Exception as exc:  # noqa: BLE001 — yfinance-ийн дотоод алдааг дээш задлахгүй
            raise ProviderUnavailableError(f"YFinance-аас өгөгдөл авч чадсангүй: {exc}") from exc
        return bars[-outputsize:] if outputsize > 0 else bars

    async def fetch_time_series_range(
        self, symbol: str, interval: Interval, start: datetime, end: datetime
    ) -> list[RawBar]:
        yf_symbol = self._require_mapped(symbol)
        yf_interval = self._YF_INTERVALS[interval]
        logger.info("yfinance range: %s (%s) [%s → %s]", symbol, yf_symbol, start, end)
        try:
            return await asyncio.to_thread(
                self._history_sync,
                yf_symbol,
                end,  # inclusive хайчилт (yfinance end-ээс өмнөх өдрийг оруулж ирдэг)
                start=start,
                end=end + timedelta(days=1),
                interval=yf_interval,
            )
        except ProviderUnavailableError:
            raise
        except Exception as exc:  # noqa: BLE001
            raise ProviderUnavailableError(f"YFinance-аас өгөгдөл авч чадсангүй: {exc}") from exc

    async def fetch_quote(self, symbol: str) -> RawQuote:
        yf_symbol = self._require_mapped(symbol)
        logger.info("yfinance quote: %s (%s)", symbol, yf_symbol)
        try:
            price = await asyncio.to_thread(self._last_price_sync, yf_symbol)
        except ProviderUnavailableError:
            raise
        except Exception as exc:  # noqa: BLE001
            raise ProviderUnavailableError(f"YFinance-аас үнэ авч чадсангүй: {exc}") from exc
        return RawQuote(price=price, timestamp=datetime.now(timezone.utc))


def _to_utc_index(index: pd.DatetimeIndex) -> pd.DatetimeIndex:
    """yfinance-ийн DatetimeIndex-ийг UTC болгож normalize хийнэ."""
    if index.tz is None:
        return index.tz_localize("UTC")
    return index.tz_convert("UTC")


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

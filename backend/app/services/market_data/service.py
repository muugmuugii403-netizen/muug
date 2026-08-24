"""Service давхарга — provider ба API router-ийн хоорондох бизнес логик.

Үүрэг:
  • Symbol / interval / outputsize validation (registry-д суурилна)
  • Богино хугацааны in-memory TTL cache — Twelve Data-ийн 8 credit/мин
    хязгаарыг dev үед хэмнэнэ (candles 30с, quote 15с)
  • Raw өгөгдлийг Pydantic Candle загварт хөрвүүлж эрүүл байдлыг шалгана
  • Quote-д bid/ask/spread тооцох (typical spread, pair бүрт тогтмол)
"""

from __future__ import annotations

import asyncio
import logging
import time
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Awaitable, Callable

from app.core.errors import SymbolNotSupportedError
from app.schemas.market import Candle, CandlesResponse, DataSource, Interval, QuoteResponse
from app.services.market_data.providers import MarketDataProvider, RawBar, RawQuote
from app.services.market_data.symbols import ForexPair, get_pair, supported_symbols

logger = logging.getLogger("forex_analyzer.market")

MAX_OUTPUTSIZE = 5000  # Twelve Data-ийн дээд хязгаар
DEFAULT_OUTPUTSIZE = 200


@dataclass
class _CacheEntry:
    expires_at: float
    value: Any


@dataclass
class MarketDataService:
    """Нэг process-д нэг instance (app factory-д үүснэ)."""

    provider: MarketDataProvider
    candles_ttl_s: float = 30.0
    quote_ttl_s: float = 15.0
    _cache: dict[str, _CacheEntry] = field(default_factory=dict, init=False)
    _lock: asyncio.Lock = field(default_factory=asyncio.Lock, init=False)

    # ---------- публик API ----------

    async def get_candles(self, symbol: str, interval: Interval, outputsize: int) -> CandlesResponse:
        pair = self._require_pair(symbol)
        size = min(max(outputsize, 1), MAX_OUTPUTSIZE)

        bars: list[RawBar] = await self._cached(
            key=f"candles:{symbol}:{interval.value}:{size}",
            ttl_s=self.candles_ttl_s,
            fetch=lambda: self.provider.fetch_time_series(symbol, interval, size),
        )
        candles = self._to_candles(bars)
        return CandlesResponse(
            symbol=pair.symbol,
            interval=interval,
            count=len(candles),
            source=self._source(),
            candles=candles,
        )

    async def get_quote(self, symbol: str) -> QuoteResponse:
        pair = self._require_pair(symbol)
        raw: RawQuote = await self._cached(
            key=f"quote:{symbol}",
            ttl_s=self.quote_ttl_s,
            fetch=lambda: self.provider.fetch_quote(symbol),
        )
        return self._synthesize_quote(pair, raw, self._source())

    async def get_candles_range(
        self, symbol: str, interval: Interval, start: datetime, end: datetime
    ) -> list[Candle]:
        """[start, end] мужийн түүхэн лаанууд (backtest-д зориулав).

        Range нь өөр өөр байх тул cache key-д мужийг оруулна; TTL нь ердийн
        candles-тэй ижил (хуучин өгөгдөл өөрчлөгдөхгүй ч credit хэмнэлт хэвээр).
        """
        self._require_pair(symbol)
        key = f"range:{symbol}:{interval.value}:{start.isoformat()}:{end.isoformat()}"
        bars: list[RawBar] = await self._cached(
            key=key,
            ttl_s=self.candles_ttl_s,
            fetch=lambda: self.provider.fetch_time_series_range(symbol, interval, start, end),
        )
        return self._to_candles(bars)

    async def aclose(self) -> None:
        await self.provider.aclose()

    # ---------- дотоод ----------

    def _source(self) -> DataSource:
        return self.provider.source  # type: ignore[return-value]

    @staticmethod
    def _require_pair(symbol: str) -> ForexPair:
        pair = get_pair(symbol)
        if pair is None:
            raise SymbolNotSupportedError(
                f"'{symbol}' дэмжигдэхгүй. Дэмжигдэх pair-ууд: {', '.join(supported_symbols())}"
            )
        return pair

    async def _cached(
        self,
        key: str,
        ttl_s: float,
        fetch: Callable[[], Awaitable[Any]],
    ) -> Any:
        """TTL cache: hit бол provider руу огт дуудлага явахгүй (credit хэмнэлт)."""
        now = time.monotonic()
        async with self._lock:
            entry = self._cache.get(key)
            if entry is not None and entry.expires_at > now:
                logger.info("cache HIT: %s", key)
                return entry.value
            value = await fetch()
            self._cache[key] = _CacheEntry(expires_at=now + ttl_s, value=value)
            return value

    @staticmethod
    def _to_candles(bars: list[RawBar]) -> list[Candle]:
        """Цагаар эрэмбэлэх + timestamp давхардлыг арилгах + Pydantic validation."""
        unique: dict[Any, RawBar] = {bar.timestamp: bar for bar in bars}
        ordered = [unique[ts] for ts in sorted(unique)]
        return [
            Candle(
                timestamp=bar.timestamp,
                open=round(bar.open, 6),
                high=round(bar.high, 6),
                low=round(bar.low, 6),
                close=round(bar.close, 6),
            )
            for bar in ordered
        ]

    @staticmethod
    def _synthesize_quote(pair: ForexPair, raw: RawQuote, source: DataSource) -> QuoteResponse:
        """Mid price ± typical spread/2 → bid/ask.

        Twelve Data Forex quote-д bid/ask байдаггүй тул pair бүрийн typical
        retail spread-ийг ашиглана (symbols.py). Энэ нь синтез тоо бөгөөд
        хариуны `source` талбар үнэн эхийг нь илтгэнэ.
        """
        dec = pair.pip_decimals
        bid = round(raw.price - pair.typical_spread / 2, dec)
        ask = round(raw.price + pair.typical_spread / 2, dec)
        spread = round(ask - bid, dec)
        return QuoteResponse(
            symbol=pair.symbol,
            price=round(raw.price, dec),
            bid=bid,
            ask=ask,
            spread=spread,
            timestamp=raw.timestamp,
            source=source,
        )

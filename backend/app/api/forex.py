"""Forex market data API router.

Endpoint-үүд:
  GET /api/forex/quote/{symbol}                              → сүүлийн үнэ, bid, ask, spread
  GET /api/forex/candles/{symbol}?interval=5min&outputsize=200
  GET /api/forex/candles/{symbol}?interval=15min&outputsize=200

Symbol нь URL-д "EUR%2FUSD" гэж ирнэ (frontend encodeURIComponent хийнэ);
{symbol:path} converter нь decode-ласан "EUR/USD"-г авна, цааш нь registry
validation явагдана. Аливаа буруу symbol → 404 SYMBOL_NOT_SUPPORTED.
"""

from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, Query

from app.core.config import Settings, get_settings
from app.core.errors import MarketDataNotConfiguredError
from app.schemas.market import CandlesResponse, Interval, QuoteResponse
from app.services.market_data.providers import (
    MarketDataProvider,
    RawBar,
    RawQuote,
    SampleDataProvider,
    TwelveDataProvider,
)
from app.services.market_data.service import DEFAULT_OUTPUTSIZE, MAX_OUTPUTSIZE, MarketDataService

logger = logging.getLogger("forex_analyzer.market")

router = APIRouter(prefix="/forex", tags=["forex"])


class _UnconfiguredProvider:
    """API key байхгүй + sample fallback унтраалттай үед ашиглагдана."""

    source: str = "none"

    async def fetch_time_series(self, symbol: str, interval: Interval, outputsize: int) -> list[RawBar]:
        raise MarketDataNotConfiguredError(
            "Market data тохируулагдаагүй: backend/.env-д TWELVE_DATA_API_KEY оруулна уу "
            "(эсвэл SAMPLE_FALLBACK_ENABLED=true)"
        )

    async def fetch_quote(self, symbol: str) -> RawQuote:
        raise MarketDataNotConfiguredError("Market data тохируулагдаагүй: TWELVE_DATA_API_KEY шаардлагатай")

    async def aclose(self) -> None:  # pragma: no cover
        return None


def build_market_service(settings: Settings) -> MarketDataService:
    """Тохиргооноос хамаарч provider-ийг сонгоно.

    Дараалал: бодит Twelve Data key → sample fallback → алдаа.
    """
    api_key = settings.twelve_data_api_key.get_secret_value()
    provider: MarketDataProvider
    if api_key:
        provider = TwelveDataProvider(
            api_key=api_key,
            base_url=settings.twelve_data_base_url,
            timeout_s=settings.market_data_timeout_s,
            retries=settings.market_data_retries,
        )
        logger.info("Market data provider: TwelveData (бодит өгөгдөл)")
    elif settings.sample_fallback_enabled:
        provider = SampleDataProvider()
        logger.warning(
            "TWELVE_DATA_API_KEY хоосон байна — SAMPLE өгөгдөл горимд ажиллаж байна. "
            "Бодит өгөгдөлд .env-д key оруулна уу."
        )
    else:
        provider = _UnconfiguredProvider()
    return MarketDataService(
        provider=provider,
        candles_ttl_s=settings.market_data_cache_candles_s,
        quote_ttl_s=settings.market_data_cache_quote_s,
    )


_service: MarketDataService | None = None


def get_market_service() -> MarketDataService:
    """DI factory — process-д нэг instance; тестэд dependency_overrides-оор солигдоно."""
    global _service
    if _service is None:
        _service = build_market_service(get_settings())
    return _service


@router.get("/quote/{symbol:path}", response_model=QuoteResponse)
async def get_quote(symbol: str, service: MarketDataService = Depends(get_market_service)) -> QuoteResponse:
    """Сүүлийн үнэ + bid/ask/spread (spread нь pair-ийн typical spread-ээс синтез)."""
    return await service.get_quote(symbol.strip().upper())


@router.get("/candles/{symbol:path}", response_model=CandlesResponse)
async def get_candles(
    symbol: str,
    interval: Interval = Interval.M5,
    outputsize: int = Query(DEFAULT_OUTPUTSIZE, ge=1, le=MAX_OUTPUTSIZE),
    service: MarketDataService = Depends(get_market_service),
) -> CandlesResponse:
    """OHLC лаанууд — цагаар өсөх эрэмбэтэй, `count` ширхэг."""
    return await service.get_candles(symbol.strip().upper(), interval, outputsize)

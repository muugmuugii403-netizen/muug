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
from app.schemas.ai import AnalysisResponse
from app.schemas.market import CandlesResponse, Interval, QuoteResponse
from app.schemas.signal import SignalResponse
from app.services.ai.explainer import ExplanationService
from app.services.ai.qwen_client import QwenClient
from app.services.analysis.service import AnalysisService
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


# ============================================================
# Analysis / Signal (Step 3 + Step 4)
# ============================================================

_analysis_service: AnalysisService | None = None
_explainer: ExplanationService | None = None


def get_analysis_service() -> AnalysisService:
    """DI factory — signal engine. Тестэд dependency_overrides-оор солигдоно."""
    global _analysis_service
    if _analysis_service is None:
        _analysis_service = AnalysisService(market=get_market_service())
    return _analysis_service


def build_explainer(settings: Settings) -> ExplanationService:
    """Qwen key-ээс хамаарч AI client үүсгэнэ; key хоосон бол client=None (disabled)."""
    api_key = settings.qwen_api_key.get_secret_value()
    client: QwenClient | None = None
    if api_key:
        client = QwenClient(
            api_key=api_key,
            base_url=settings.qwen_base_url,
            model=settings.qwen_model,
            timeout_s=settings.qwen_timeout_s,
        )
        logger.info("AI explainer: Qwen (%s) идэвхжлээ", settings.qwen_model)
    else:
        logger.warning("QWEN_API_KEY хоосон — AI тайлбар идэвхжээгүй (signal engine хэвийн)")
    return ExplanationService(client=client, cache_ttl_s=settings.qwen_cache_ttl_s)


def get_explainer() -> ExplanationService:
    """DI factory — AI тайлбар (алдаанд унадаггүй, signal-д нөлөөлөхгүй)."""
    global _explainer
    if _explainer is None:
        _explainer = build_explainer(get_settings())
    return _explainer


@router.get("/signal/{symbol:path}", response_model=SignalResponse)
async def get_signal(
    symbol: str,
    service: AnalysisService = Depends(get_analysis_service),
) -> SignalResponse:
    """Deterministic signal (Step 3): 5M + 15M дээр BUY/SELL/WAIT + оноо + SL/TP."""
    return await service.compute_signal(symbol.strip().upper())


@router.get("/analysis/{symbol:path}", response_model=AnalysisResponse)
async def get_analysis(
    symbol: str,
    service: AnalysisService = Depends(get_analysis_service),
    explainer: ExplanationService = Depends(get_explainer),
) -> AnalysisResponse:
    """Signal (Step 3) + Монгол хэл дээрх AI тайлбар (Step 4).

    Дараалал: market data → indicators → deterministic signal → Qwen тайлбар.
    AI алдаатай байсан ч signal хэвээрээ буцана (ai_status=unavailable).
    """
    signal = await service.compute_signal(symbol.strip().upper())
    explanation, ai_status, ai_message = await explainer.explain(signal)
    return AnalysisResponse(signal=signal, explanation=explanation, ai_status=ai_status, ai_message=ai_message)

"""Backtest API router (Step 6).

POST /api/backtest — түүхэн 5M+15M өгөгдөл дээр production signal engine-ийг
ажиллуулж, trade жагсаалт + гүйцэтгэлийн үзүүлэлт + equity муруй буцаана.
AI (Qwen) энд огт дуудагдахгүй.
"""

from __future__ import annotations

import logging

from fastapi import APIRouter, Depends

from app.api.forex import get_market_service
from app.schemas.backtest import BacktestRequest, BacktestResponse
from app.services.backtest.service import BacktestService
from app.services.market_data.service import MarketDataService

logger = logging.getLogger("forex_analyzer.backtest")

router = APIRouter(prefix="/backtest", tags=["backtest"])

_service: BacktestService | None = None


def get_backtest_service() -> BacktestService:
    """DI factory — process-д нэг instance; тестэд dependency_overrides-оор солигдоно."""
    global _service
    if _service is None:
        _service = BacktestService(market=get_market_service())
    return _service


@router.post("", response_model=BacktestResponse)
async def run_backtest(
    req: BacktestRequest,
    service: BacktestService = Depends(get_backtest_service),
) -> BacktestResponse:
    """Түүхэн backtest ажиллуулна.

    Хариу: summary (нийт trade, win rate, profit factor, max drawdown гэх мэт),
    trades (trade бүрийн entry/SL/TP/үр дүн), equity_curve (balance муруй).
    """
    symbol = req.symbol.strip().upper()
    logger.info("backtest request: %s [%s → %s]", symbol, req.start_date, req.end_date)
    return await service.run(req.model_copy(update={"symbol": symbol}))

"""Analysis service — market data → indicators → deterministic signal.

Урсгал (архитектурын дарааллаар):
    Market Data → Technical Indicators → Scoring Engine → BUY / SELL / WAIT

AI энэ давхаргад огт оролцдоггүй.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass

import pandas as pd

from app.core.errors import InsufficientDataError
from app.schemas.market import Candle, Interval
from app.schemas.signal import SignalResponse
from app.services.analysis.indicators import TfSnapshot, compute_snapshot
from app.services.analysis.scoring import compute_signal
from app.services.market_data.service import MarketDataService
from app.services.market_data.symbols import get_pair

logger = logging.getLogger("forex_analyzer.analysis")

# Лааны доод хэмжээ — үүнээс бага бол шинжилгээ утгагүй
MIN_CANDLES_5M = 60
MIN_CANDLES_15M = 60
FETCH_5M = 200
FETCH_15M = 200


def candles_to_snapshot(candles: list[Candle], tf: str, min_count: int) -> TfSnapshot:
    """Лааны жагсаалтаас indicator snapshot тооцно (module-level, backtest/monitor хуваалцана).

    Raises:
        InsufficientDataError: лаан хүрэлцэхгүй үед.
    """
    if len(candles) < min_count:
        raise InsufficientDataError(
            f"{tf} timeframe-д хангалтгүй лаан байна: {len(candles)} < {min_count}. "
            "Шинжилгээ хийх боломжгүй."
        )
    df = pd.DataFrame([c.model_dump() for c in candles])[["open", "high", "low", "close"]]
    try:
        return compute_snapshot(df)
    except ValueError as exc:
        raise InsufficientDataError(str(exc)) from exc


@dataclass
class AnalysisService:
    """Signal engine-ийн orchestrator. MarketDataService-ээс хамаарна."""

    market: MarketDataService

    async def compute_signal(self, symbol: str) -> SignalResponse:
        """5M + 15M өгөгдөл дээр бүрэн шинжилгээ хийж signal буцаана."""
        pair = get_pair(symbol)  # registry validation — market service давхар шалгана
        pip_decimals = pair.pip_decimals if pair else 5

        resp5 = await self.market.get_candles(symbol, Interval.M5, FETCH_5M)
        resp15 = await self.market.get_candles(symbol, Interval.M15, FETCH_15M)

        s5 = self._snapshot(resp5.candles, "5m", MIN_CANDLES_5M)
        s15 = self._snapshot(resp15.candles, "15m", MIN_CANDLES_15M)

        signal = compute_signal(symbol, s5, s15, pip_decimals)
        logger.info(
            "signal %s: %s (buy=%d sell=%d wait=%d, source=%s)",
            symbol,
            signal.signal.value,
            signal.buy_score,
            signal.sell_score,
            signal.wait_score,
            resp15.source,
        )
        return signal

    @staticmethod
    def _snapshot(candles: list[Candle], tf: str, min_count: int) -> TfSnapshot:
        return candles_to_snapshot(candles, tf, min_count)

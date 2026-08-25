"""Backtest service (Step 6) — request → historical data → engine → response.

Дата мужийг validate хийж, warmup-д шаардлагатай нэмэлт түүхэн өгөгдлийг
авалцана (indicator-ууд хүчинтэй байхын тулд), дараа нь engine-ийг дуудна.
Spread нь request-д заагаагүй бол pair-ийн typical spread байна (symbols.py).
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import datetime, time, timedelta, timezone

from app.core.config import get_settings
from app.core.errors import InsufficientDataError, InvalidDateRangeError
from app.schemas.backtest import BacktestRequest, BacktestResponse
from app.schemas.market import Interval
from app.services.backtest.engine import WARMUP, BacktestConfig, run_backtest
from app.services.market_data.service import MarketDataService
from app.services.market_data.symbols import get_pair

logger = logging.getLogger("forex_analyzer.backtest")

_PIP_SIZE_DEFAULT = 0.0001
_PIP_SIZE_JPY = 0.01


@dataclass
class BacktestService:
    """MarketDataService-ээс хамаарна; нэг process-д нэг instance."""

    market: MarketDataService

    async def run(self, req: BacktestRequest) -> BacktestResponse:
        settings = get_settings()
        pair = get_pair(req.symbol)
        if pair is None:  # pragma: no cover — router үед шалгагдана
            from app.core.errors import SymbolNotSupportedError

            raise SymbolNotSupportedError(f"'{req.symbol}' дэмжигдэхгүй")

        self._validate_range(req, settings.backtest_max_range_days)

        # --- Дата мужийг UTC datetime болгох ---
        start = datetime.combine(req.start_date, time.min, tzinfo=timezone.utc)
        end = datetime.combine(req.end_date, time.max, tzinfo=timezone.utc)

        # --- Indicator warmup-д нэмэлт түүх (look-ahead биш, зөвхөн өмнөх өгөгдөл) ---
        warmup_15m = timedelta(minutes=15 * (WARMUP + 1))  # 15M-ийн доод хэмжээ
        fetch_start = start - warmup_15m

        logger.info("backtest data: %s [%s → %s]", req.symbol, fetch_start, end)
        candles_5m = await self.market.get_candles_range(req.symbol, Interval.M5, fetch_start, end)
        candles_15m = await self.market.get_candles_range(req.symbol, Interval.M15, fetch_start, end)

        if len(candles_5m) < settings.backtest_min_candles_5m:
            raise InsufficientDataError(
                f"5M өгөгдөл хангалтгүй: {len(candles_5m)} < {settings.backtest_min_candles_5m}. "
                "Дата мужаа өргөсгөнө үү."
            )
        if len(candles_15m) < settings.backtest_min_candles_15m:
            raise InsufficientDataError(
                f"15M өгөгдөл хангалтгүй: {len(candles_15m)} < {settings.backtest_min_candles_15m}. "
                "Дата мужаа өргөсгөнө үү."
            )

        # --- Spread / slippage-ийг үнэ болгох ---
        pip = _PIP_SIZE_JPY if req.symbol.endswith("/JPY") else _PIP_SIZE_DEFAULT
        spread = (req.spread_pips if req.spread_pips is not None else pair.typical_spread / pip) * pip
        slippage = req.slippage_pips * pip

        cfg = BacktestConfig(
            symbol=req.symbol,
            pip_decimals=pair.pip_decimals,
            initial_balance=req.initial_balance,
            risk_per_trade=req.risk_per_trade,
            spread=spread,
            slippage=slippage,
            trade_start=start,
        )

        outcome = run_backtest(candles_5m, candles_15m, cfg)
        return BacktestResponse(
            summary=outcome.summary,
            trades=outcome.trades,
            equity_curve=outcome.equity_curve,
        )

    @staticmethod
    def _validate_range(req: BacktestRequest, max_days: int) -> None:
        """start < end, ирээдүй биш, хэт урт биш."""
        if req.start_date >= req.end_date:  # pragma: no cover — Pydantic шалгана
            raise InvalidDateRangeError("start_date нь end_date-ээс өмнө байх ёстой")
        today = datetime.now(timezone.utc).date()
        if req.end_date > today:
            raise InvalidDateRangeError(f"end_date ирээдүй байна (өнөөдөр: {today})")
        days = (req.end_date - req.start_date).days
        if days > max_days:
            raise InvalidDateRangeError(
                f"Дата муж хэт урт: {days} өдөр (дээд хязгаар {max_days} өдөр)"
            )

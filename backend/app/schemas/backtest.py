"""Backtest API-ийн Pydantic загварууд (Step 6).

Чухал: backtest нь production signal engine-тэй (scoring.py) ЯГ ижил
indicator + дүрэм + босго ашиглана — энд ямар ч шинэ signal алгоритм байхгүй.
AI (Qwen) backtest-д огт дуудагдахгүй.
"""

from __future__ import annotations

from datetime import date, datetime
from enum import Enum
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.schemas.signal import SignalDirection


class BacktestRequest(BaseModel):
    """POST /api/backtest хүсэлт."""

    model_config = ConfigDict(extra="forbid")

    symbol: str = Field(..., pattern=r"^[A-Z]{3}/[A-Z]{3}$", examples=["EUR/USD"])
    start_date: date
    end_date: date
    initial_balance: float = Field(default=10000.0, gt=0, le=10_000_000)
    risk_per_trade: float = Field(default=1.0, gt=0, le=10, description="Нэг trade-д эрсдэх хувь (%)")
    slippage_pips: float = Field(default=0.0, ge=0, le=10, description="Гүйцэтгэлийн гулсалт (pip)")
    spread_pips: float | None = Field(
        default=None, ge=0, le=50, description="Spread (pip); None = pair-ийн typical spread"
    )

    @model_validator(mode="after")
    def _check_dates(self) -> BacktestRequest:
        if self.start_date >= self.end_date:
            raise ValueError("start_date нь end_date-ээс өмнө байх ёстой")
        return self


class TradeResultState(str, Enum):
    """Trade-ийн эцсийн төлөв."""

    WIN = "WIN"
    LOSS = "LOSS"
    OPEN = "OPEN"  # backtest дуусахад хараахан хаагдаагүй


class TradeRecord(BaseModel):
    """Нэг backtest trade."""

    model_config = ConfigDict(extra="forbid")

    symbol: str
    signal: Literal[SignalDirection.BUY, SignalDirection.SELL]
    entry: float = Field(..., gt=0)
    stop_loss: float = Field(..., gt=0)
    take_profit: float = Field(..., gt=0)
    risk_reward: float = Field(..., gt=0)
    entry_time: datetime
    exit_time: datetime | None = None  # OPEN үед None
    exit_price: float | None = None  # OPEN үед None
    result: TradeResultState
    pnl: float  # бодит ашиг/алдагдал ($) — OPEN үед unrealized
    pnl_pct: float  # equity-ийн хувиар


class EquityPoint(BaseModel):
    """Equity муруйн нэг цэг."""

    time: datetime
    equity: float


class BacktestSummary(BaseModel):
    """Гүйцэтгэлийн үзүүлэлтүүд."""

    model_config = ConfigDict(extra="forbid")

    total_trades: int = Field(..., ge=0)
    wins: int = Field(..., ge=0)
    losses: int = Field(..., ge=0)
    open_trades: int = Field(..., ge=0)
    win_rate: float = Field(..., ge=0, le=100)
    loss_rate: float = Field(..., ge=0, le=100)
    net_pnl: float
    avg_profit: float
    avg_loss: float
    profit_factor: float | None = Field(None, description="gross_win/gross_loss; алдагдал 0 бол None")
    max_drawdown_pct: float = Field(..., ge=0)
    avg_risk_reward: float = Field(..., ge=0, description="Дундаж бодит R")
    long_trades: int = Field(..., ge=0)
    short_trades: int = Field(..., ge=0)
    buy_win_rate: float = Field(..., ge=0, le=100)
    sell_win_rate: float = Field(..., ge=0, le=100)
    wait_count: int = Field(..., ge=0, description="WAIT signal-ийн тоо")
    initial_balance: float
    final_balance: float
    data_start: datetime
    data_end: datetime
    candles_5m: int
    candles_15m: int
    spread_used: float = Field(..., ge=0, description="Ашиглагдсан spread (үнээр)")
    slippage_used: float = Field(..., ge=0, description="Ашиглагдсан slippage (үнээр)")


class BacktestResponse(BaseModel):
    """POST /api/backtest хариу."""

    model_config = ConfigDict(extra="forbid")

    summary: BacktestSummary
    trades: list[TradeRecord]
    equity_curve: list[EquityPoint]

"""Deterministic signal engine-ийн Pydantic загварууд (Step 3).

Signal нь ЗӨВХӨН market data + indicator-ийн цэвэр тооцооноос гарна —
энэ давхаргад AI оролцдоггүй. AI тайлбар нь Step 4-ийн `schemas/ai.py`-д
тусдаа нэмэгдэнэ (AnalysisResponse).
"""

from __future__ import annotations

from enum import Enum
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class SignalDirection(str, Enum):
    BUY = "BUY"
    SELL = "SELL"
    WAIT = "WAIT"


class TrendState(str, Enum):
    BULLISH = "BULLISH"
    BEARISH = "BEARISH"
    NEUTRAL = "NEUTRAL"


class MacdState(str, Enum):
    BULLISH = "BULLISH"
    BEARISH = "BEARISH"
    NEUTRAL = "NEUTRAL"


class PriceActionState(str, Enum):
    """S/R орчим дахь сүүлийн лааны урвал."""

    BULLISH_REACTION = "BULLISH_REACTION"  # support орчимд өсөх урвал
    BEARISH_REACTION = "BEARISH_REACTION"  # resistance орчимд унах урвал
    NEUTRAL = "NEUTRAL"


class TimeframeAnalysis(BaseModel):
    """Нэг timeframe-ийн indicator snapshot — signal response болон AI input хоёрт хэрэглэгдэнэ."""

    model_config = ConfigDict(extra="forbid")

    trend: TrendState
    rsi: float = Field(..., ge=0, le=100)
    macd: MacdState
    ema20: float = Field(..., gt=0)
    ema50: float = Field(..., gt=0)
    atr: float = Field(..., ge=0)
    support: float = Field(..., gt=0)
    resistance: float = Field(..., gt=0)


class SignalResponse(BaseModel):
    """GET /api/forex/signal/{symbol} хариу — Step 3-ийн contract."""

    model_config = ConfigDict(extra="forbid")

    symbol: str
    signal: SignalDirection
    buy_score: int = Field(..., ge=0, le=100)
    sell_score: int = Field(..., ge=0, le=100)
    wait_score: int = Field(..., ge=0, le=100)
    confidence: int = Field(..., ge=0, le=100, description="max(buy_score, sell_score)")

    # WAIT үед худалдааны төлөвлөгөө байхгүй → null
    entry: float | None = Field(None, gt=0)
    stop_loss: float | None = Field(None, gt=0)
    take_profit: float | None = Field(None, gt=0)
    risk_reward: float | None = Field(None, gt=0)

    timeframes: dict[Literal["5m", "15m"], TimeframeAnalysis]
    reasons: list[str] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)

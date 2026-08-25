"""Market data API-ийн Pydantic загварууд.

Энд хоёр зүйл баталгаажна:
  1. Хүсэлтийн параметрүүд (interval, outputsize) — FastAPI автоматаар 422 буцаана.
  2. Provider-аас ирсэн OHLC утгуудын эрүүл байдал — high ≥ max(o,c), low ≤ min(o,c),
     бүх утга эерэг. Энэ validation-гүйгээр муруй candle chart руу шууд орох байсан.
"""

from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

DataSource = Literal["twelvedata", "sample"]


class Interval(str, Enum):
    """Дэмжигдэх timeframe — одоогоор ЗӨВХӨН 5min ба 15min."""

    M5 = "5min"
    M15 = "15min"

    @property
    def seconds(self) -> int:
        return 300 if self is Interval.M5 else 900


class Candle(BaseModel):
    """Нэг лаан (OHLC)."""

    model_config = ConfigDict(extra="forbid")

    timestamp: datetime = Field(..., description="UTC, ISO-8601")
    open: float = Field(..., gt=0)
    high: float = Field(..., gt=0)
    low: float = Field(..., gt=0)
    close: float = Field(..., gt=0)

    @model_validator(mode="after")
    def _ohlc_sanity(self) -> Candle:
        if self.high < max(self.open, self.close):
            raise ValueError(f"high ({self.high}) < max(open, close) — OHLC зөрчилтэй")
        if self.low > min(self.open, self.close):
            raise ValueError(f"low ({self.low}) > min(open, close) — OHLC зөрчилтэй")
        if self.high < self.low:
            raise ValueError("high < low — OHLC зөрчилтэй")
        return self


class CandlesResponse(BaseModel):
    """GET /api/forex/candles/{symbol} хариу."""

    symbol: str
    interval: Interval
    count: int = Field(..., ge=0)
    source: DataSource = Field(..., description="twelvedata = бодит, sample = локал демо")
    candles: list[Candle] = Field(..., description="Цаг хугацаагаар өсөх эрэмбэтэй")


class QuoteResponse(BaseModel):
    """GET /api/forex/quote/{symbol} хариу.

    Анхаар: Twelve Data Forex quote-д bid/ask байхгүй тул bid/ask нь mid price
    дээр pair бүрийн typical spread-ийг нэмж/хасаж тооцогдоно.
    """

    symbol: str
    price: float = Field(..., gt=0, description="Сүүлийн үнэ (mid)")
    bid: float = Field(..., gt=0)
    ask: float = Field(..., gt=0)
    spread: float = Field(..., ge=0, description="ask − bid")
    timestamp: datetime
    source: DataSource

"""Pydantic schemas — API contract-ийн цорын ганц эх сурвалж.

Бүх request validation энд явагдана; route handler түүхий өгөгдөл хэзээ ч задлахгүй.
Wire format: snake_case (frontend/src/lib/types.ts-тай 1:1 тохирно).
"""

from __future__ import annotations

from datetime import datetime, timezone
from enum import Enum
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

SYMBOL_PATTERN: str = r"^[A-Z]{3}/[A-Z]{3}$"


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


class Timeframe(str, Enum):
    """Multi-timeframe шинжилгээний timeframe-ууд."""

    M5 = "5m"
    M15 = "15m"
    H1 = "1h"
    H4 = "4h"
    D1 = "1d"


class AnalysisRequest(BaseModel):
    """POST /analysis — validate хийгдэх хүсэлт."""

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    symbol: str = Field(
        ...,
        pattern=SYMBOL_PATTERN,
        examples=["EUR/USD"],
        description="Forex pair, жишээ нь EUR/USD",
    )
    timeframe: Timeframe = Field(..., description="Шинжилгээний timeframe")


class PairInfo(BaseModel):
    """Дэмжигдэх pair-ийн мэдээлэл."""

    symbol: str = Field(..., pattern=SYMBOL_PATTERN)
    name: str = Field(..., min_length=1)
    pip_decimals: int = Field(..., ge=0, le=6, description="EUR/USD → 5, USD/JPY → 3")


class HealthResponse(BaseModel):
    """GET /health — liveness шалгалт."""

    status: Literal["ok"] = "ok"
    version: str
    env: str
    utc_now: datetime = Field(default_factory=_utc_now)


class ErrorResponse(BaseModel):
    """Нэгдсэн алдааны формат — бүх endpoint ижил хэлбэрээр буцаана."""

    error: str = Field(..., description="Machine-readable код: validation_error, not_implemented, …")
    detail: str = Field(..., description="Хүнд уншигдахуйц мессеж")
    path: str | None = None
    utc_now: datetime = Field(default_factory=_utc_now)

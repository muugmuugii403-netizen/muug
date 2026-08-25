"""Alert / monitoring-ийн Pydantic загварууд (Step 7).

Alert нь ЗӨВХӨН deterministic signal engine-ийн чиглэл өөрчлөгдөхөд үүснэ
(WAIT→BUY, BUY→SELL г.м.). Онооны жижиг хэлбэлзэл (BUY 78 → 79) alert үүсгэхгүй.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.signal import SignalDirection


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


class AlertRecord(BaseModel):
    """Нэг signal-өөрчлөлтийн alert — түүхэнд хадгалагдана."""

    model_config = ConfigDict(extra="forbid")

    id: int = Field(..., ge=1, description="Өсөх дугаар — клиент duplicate-ээс хамгаална")
    symbol: str
    signal: SignalDirection
    confidence: int = Field(..., ge=0, le=100)
    buy_score: int = Field(..., ge=0, le=100)
    sell_score: int = Field(..., ge=0, le=100)
    wait_score: int = Field(..., ge=0, le=100)
    entry: float | None = Field(None, gt=0)
    stop_loss: float | None = Field(None, gt=0)
    take_profit: float | None = Field(None, gt=0)
    risk_reward: float | None = Field(None, gt=0)
    reasons: list[str] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=_utc_now)
    browser_notification_sent: bool = False
    telegram_notification_sent: bool = False


class AlertSettings(BaseModel):
    """Мониторингийн alert тохиргоо (server-side, нэгдмэл instance).

    buy/sell/wait — аль чиглэлийн өөрчлөлтөд alert үүсгэх вэ.
    telegram_enabled — Telegram bot руу илгээх эсэх (token .env-д байх ёстой).
    """

    model_config = ConfigDict(extra="forbid")

    buy_enabled: bool = True
    sell_enabled: bool = True
    wait_enabled: bool = True
    telegram_enabled: bool = True

    def allows(self, direction: SignalDirection) -> bool:
        """Энэ чиглэлийн alert зөвшөөрөгдөх эсэх."""
        return {
            SignalDirection.BUY: self.buy_enabled,
            SignalDirection.SELL: self.sell_enabled,
            SignalDirection.WAIT: self.wait_enabled,
        }[direction]


class StreamEvent(BaseModel):
    """SSE event envelope: `event: <type>`, `data: <payload json>`."""

    model_config = ConfigDict(extra="forbid")

    type: str = Field(..., description="status | price | signal | alert")
    payload: dict[str, Any]
    ts: datetime = Field(default_factory=_utc_now)

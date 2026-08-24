"""AI тайлбарын загварууд (Step 4).

Чухал: AI нь signal-ийг ӨӨРЧИЛЖ чадахгүй — тэр зөвхөн `AiExplanation` (зөвхөн
текст талбарууд) буцаана. Эцсийн шийдвэр, оноо, үнэ нь `SignalResponse`-оос
шууд хэвээр дамжина. AI хариу нь Pydantic-аар validate хийгдэж, дүрэм зөрчсөн
тайлбар устгагдана (explainer.py → validation).
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.signal import SignalResponse


class AiExplanation(BaseModel):
    """Qwen-ийн буцаах Монгол хэл дээрх тайлбар — зөвхөн текст, үнэ/оноо байхгүй."""

    model_config = ConfigDict(extra="forbid")

    summary: str = Field(..., min_length=1, max_length=1500)
    signal_explanation: str = Field(..., min_length=1, max_length=1500)
    market_context: str = Field(..., min_length=1, max_length=1500)
    technical_reasons: list[str] = Field(..., min_length=1, max_length=8)
    risk_analysis: str = Field(..., min_length=1, max_length=1500)
    entry_explanation: str = Field(..., min_length=1, max_length=1500)
    stop_loss_explanation: str = Field(..., min_length=1, max_length=1500)
    take_profit_explanation: str = Field(..., min_length=1, max_length=1500)
    warnings: list[str] = Field(default_factory=list, max_length=8)


AiStatus = Literal["ok", "unavailable", "disabled"]


class AnalysisResponse(BaseModel):
    """GET /api/forex/analysis/{symbol} — signal + AI тайлбар (нэгтгэсэн)."""

    model_config = ConfigDict(extra="forbid")

    signal: SignalResponse
    explanation: AiExplanation | None = Field(
        None, description="AI амжилттай бол тайлбар; үгүй бол null — signal хэвээрээ"
    )
    ai_status: AiStatus = Field(..., description="ok | unavailable | disabled")
    ai_message: str = Field(..., description="Frontend-д харуулах статус мессеж (монгол)")

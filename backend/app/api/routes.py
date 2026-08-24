"""API routes — Step 1: health + pairs + analysis stub.

/analysis endpoint нь оролтыг бүрэн validate хийх боловч deterministic engine
Step 2-т хэрэгжих хүртэл 501 (Not Implemented) буцаана. Энэ нь API contract
одооноос тогтвортой байх зарчмын хэрэгжилт юм.
"""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Request, status
from fastapi.responses import JSONResponse

from app.core.config import get_settings
from app.schemas.analysis import AnalysisRequest, ErrorResponse, HealthResponse, PairInfo
from app.services.analysis_service import AnalysisService

router = APIRouter(tags=["core"])

# Step 1-д static жагсаалт — Step 2-т PostgreSQL-ын `pairs` хүснэгтээс уншина.
SUPPORTED_PAIRS: tuple[PairInfo, ...] = (
    PairInfo(symbol="EUR/USD", name="Euro / US Dollar", pip_decimals=5),
    PairInfo(symbol="GBP/USD", name="British Pound / US Dollar", pip_decimals=5),
    PairInfo(symbol="USD/JPY", name="US Dollar / Japanese Yen", pip_decimals=3),
    PairInfo(symbol="USD/CHF", name="US Dollar / Swiss Franc", pip_decimals=5),
    PairInfo(symbol="AUD/USD", name="Australian Dollar / US Dollar", pip_decimals=5),
    PairInfo(symbol="USD/CAD", name="US Dollar / Canadian Dollar", pip_decimals=5),
)


@router.get("/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    """Liveness шалгалт — frontend эхлээд үүнийг дуудна."""
    settings = get_settings()
    return HealthResponse(
        version=settings.api_version,
        env=settings.app_env.value,
        utc_now=datetime.now(timezone.utc),
    )


@router.get("/pairs", response_model=list[PairInfo])
async def list_pairs() -> list[PairInfo]:
    """Дэмжигдэх Forex pair-уудын жагсаалт."""
    return list(SUPPORTED_PAIRS)


@router.post(
    "/analysis",
    responses={status.HTTP_501_NOT_IMPLEMENTED: {"model": ErrorResponse}},
)
async def create_analysis(request: Request, payload: AnalysisRequest) -> JSONResponse:
    """Шинжилгээ эхлүүлэх. Step 1: зөвхөн validation, engine — Step 2."""
    service = AnalysisService()
    try:
        await service.analyze(payload.symbol, payload.timeframe)
    except NotImplementedError as exc:
        return JSONResponse(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            content=ErrorResponse(
                error="not_implemented",
                detail=str(exc),
                path=request.url.path,
            ).model_dump(mode="json"),
        )
    # Step 2-т engine хэрэгжсэнээр энд 202 Accepted буцахаар өргөжинө.
    raise RuntimeError("Unreachable: engine хараахан хэрэгжээгүй байна")

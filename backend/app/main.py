"""FastAPI application entrypoint.

Ажиллуулах:  uvicorn app.main:app --reload  (backend/ дотроос)
Эсвэл:       make dev-api
"""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from typing import AsyncIterator

from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.api.forex import router as forex_router
from app.api.routes import router
from app.core.config import get_settings
from app.core.errors import AnalysisError, MarketDataError
from app.schemas.analysis import ErrorResponse

logger = logging.getLogger("forex_analyzer")


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    """Startup/shutdown: logging тохируулж, амьдралын мөчлөгийг log-лож байна."""
    settings = get_settings()
    logging.basicConfig(
        level=logging.DEBUG if settings.debug else logging.INFO,
        format="%(asctime)s %(levelname)-7s %(name)s :: %(message)s",
    )
    logger.info(
        "%s эхэлж байна (env=%s, version=%s)",
        settings.app_name,
        settings.app_env.value,
        settings.api_version,
    )
    yield
    logger.info("%s зогсож байна", settings.app_name)


def _error_response(request: Request, code: str, detail: str, status_code: int) -> JSONResponse:
    """Нэгдсэн алдааны форматаар JSONResponse буцаана."""
    return JSONResponse(
        status_code=status_code,
        content=ErrorResponse(error=code, detail=detail, path=request.url.path).model_dump(mode="json"),
    )


def create_app() -> FastAPI:
    """App factory — тестэд шинэ app үүсгэхэд хялбар."""
    settings = get_settings()

    app = FastAPI(
        title=settings.app_name,
        version=settings.api_version,
        description=(
            "Forex зах зээлийн дүн шинжилгээний API. "
            "Signal = deterministic engine (Step 2+), AI = зөвхөн тайлбар (Step 5)."
        ),
        lifespan=lifespan,
        # Prod-д Swagger-ийг хаана (fingerprinting бууруулах)
        docs_url=None if settings.is_prod else "/docs",
        redoc_url=None,
    )

    # CORS — зөвхөн whitelist origin-оос
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_credentials=True,
        allow_methods=["GET", "POST"],
        allow_headers=["*"],
    )

    app.include_router(router, prefix=f"/api/{settings.api_version}")
    app.include_router(forex_router, prefix="/api")  # /api/forex/quote · /api/forex/candles

    # ---------- Нэгдсэн error handling ----------

    @app.exception_handler(RequestValidationError)
    async def on_validation_error(request: Request, exc: RequestValidationError) -> JSONResponse:
        fields = ", ".join(".".join(str(x) for x in e.get("loc", ())) for e in exc.errors())
        logger.warning("Validation алдаа %s: %s", request.url.path, fields)
        return _error_response(
            request,
            "validation_error",
            f"Буруу оролт: {fields}" if fields else "Хүсэлтийн өгөгдөл буруу байна",
            status.HTTP_422_UNPROCESSABLE_ENTITY,
        )

    @app.exception_handler(StarletteHTTPException)
    async def on_http_error(request: Request, exc: StarletteHTTPException) -> JSONResponse:
        return _error_response(request, "http_error", str(exc.detail), exc.status_code)

    @app.exception_handler(AnalysisError)
    async def on_analysis_error(request: Request, exc: AnalysisError) -> JSONResponse:
        """Signal engine алдаа: insufficient data → 422 гэх мэт."""
        logger.warning("Analysis алдаа [%s] %s: %s", exc.code, request.url.path, exc.message)
        return _error_response(request, exc.code, exc.message, exc.status)

    @app.exception_handler(MarketDataError)
    async def on_market_error(request: Request, exc: MarketDataError) -> JSONResponse:
        """Market data алдаанууд: 404 / 429 (Retry-After) / 502 / 503 / 504."""
        headers = {"Retry-After": str(exc.retry_after)} if exc.retry_after else None
        logger.warning("Market data алдаа [%s] %s: %s", exc.code, request.url.path, exc.message)
        return JSONResponse(
            status_code=exc.status,
            content=ErrorResponse(error=exc.code, detail=exc.message, path=request.url.path).model_dump(mode="json"),
            headers=headers,
        )

    @app.exception_handler(Exception)
    async def on_unexpected(request: Request, exc: Exception) -> JSONResponse:
        # Дотоод алдааны мэдээллийг client руу хэзээ ч задлахгүй
        logger.exception("Боловсруулагдаагүй алдаа %s: %s", request.url.path, exc)
        return _error_response(
            request,
            "internal_error",
            "Серверийн дотоод алдаа гарлаа",
            status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    return app


app = create_app()

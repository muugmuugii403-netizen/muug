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

from app.api.routes import router
from app.core.config import get_settings
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

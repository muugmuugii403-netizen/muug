"""Realtime stream + alert API (Step 7).

  GET  /api/stream/events      — SSE: price / signal / alert / status event-үүд
  GET  /api/alerts/settings    — alert тохиргоо
  POST /api/alerts/settings    — alert тохиргоо шинэчлэх
  GET  /api/alerts/history     — alert түүх (шинэ нь эхэндээ)

SSE сонгосон шалтгаан: server→client нэг чиглэлт, EventSource-ийн төрөлх
auto-reconnect, нэмэлт хамааралгүй — энэ архитектурт хамгийн энгийн бөгөөд
найдвартай шийдэл.
"""

from __future__ import annotations

import json
import logging
from typing import AsyncIterator

from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse

from app.core.rate_limit import Group, rate_limit
from app.schemas.alerts import AlertRecord, AlertSettings, StreamEvent
from app.schemas.signal import SignalResponse
from app.services.monitor.broadcaster import Broadcaster
from app.services.monitor.service import MonitorService

logger = logging.getLogger("forex_analyzer.stream")

router = APIRouter(tags=["stream"])

_KEEPALIVE_S = 15  # клиент proxy/firewall-д холболт амьд гэдгийг сануулна


def _sse(event: StreamEvent) -> str:
    """SSE wire формат: `event: <type>\\ndata: <payload json>\\n\\n`.

    data нь зөвхөн payload байна (event нэр нь төрлийг илтгэнэ) — клиент
    `JSON.parse(e.data)` хийгээд шууд ашиглана.
    """
    return f"event: {event.type}\ndata: {json.dumps(event.payload, default=str)}\n\n"


# ---------- DI ----------

_monitor: MonitorService | None = None


def get_monitor() -> MonitorService:
    """Тестэд dependency_overrides-оор солигдоно."""
    global _monitor
    if _monitor is None:
        from app.api.forex import build_monitor  # циклик import-оос зайлсхийж дотор нь

        _monitor = build_monitor()
    return _monitor


# ---------- endpoints ----------


@router.get("/stream/events")
async def stream_events(monitor: MonitorService = Depends(get_monitor)) -> StreamingResponse:
    """SSE урсгал. Холбогдох үед `snapshot` event ирнэ (давхар REST дуудлага үгүй)."""
    broadcaster = monitor.broadcaster

    async def event_gen() -> AsyncIterator[str]:
        # Холболтын эхний мөчид одоогийн төлөвийг бүхэлд нь илгээнэ —
        # reconnect үед ч гэсэн duplicate alert үүсэхгүй (ID-гаар ялгагдана).
        yield f"event: snapshot\ndata: {json.dumps(monitor.snapshot(), default=str)}\n\n"
        async for event in broadcaster.subscribe(heartbeat_s=_KEEPALIVE_S):
            if event is None:
                # Heartbeat: SSE comment — клиент хүлээж авах боловч event биш.
                # Удаан чимээгүй үед proxy/firewall холболтыг таслахаас хамгаална.
                yield ": keepalive\n\n"
                continue
            yield _sse(event)

    return StreamingResponse(
        event_gen(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",  # nginx proxy buffering-ийг унтраана
        },
    )


@router.get("/alerts/settings", response_model=AlertSettings)
async def get_alert_settings(monitor: MonitorService = Depends(get_monitor)) -> AlertSettings:
    """Одоогийн alert тохиргоо."""
    return monitor.store.get_settings()


@router.post("/alerts/settings", response_model=AlertSettings, dependencies=[Depends(rate_limit(Group.ALERTS))])
async def update_alert_settings(
    patch: AlertSettings, monitor: MonitorService = Depends(get_monitor)
) -> AlertSettings:
    """Alert тохиргоог бүхэлд нь шинэчилнэ (Pydantic-аар validate хийгдэнэ)."""
    return monitor.store.update_settings(patch)


@router.get("/alerts/history", response_model=list[AlertRecord])
async def alert_history(
    limit: int = Query(50, ge=1, le=200),
    monitor: MonitorService = Depends(get_monitor),
) -> list[AlertRecord]:
    """Alert түүх — шинэ нь эхэндээ."""
    return monitor.store.history(limit=limit)


# Тодорхой pair-ийн сүүлийн signal (ticker-ийн анхны дүүргэлтэд)
@router.get("/monitor/signals", response_model=dict[str, SignalResponse])
async def current_signals(monitor: MonitorService = Depends(get_monitor)) -> dict[str, SignalResponse]:
    return dict(monitor._last_signals)  # noqa: SLF001 — snapshot API, дотоод уншилт

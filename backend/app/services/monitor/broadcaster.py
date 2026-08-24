"""SSE broadcaster — server→client pub/sub (Step 7).

Хамгийн найдвартай бөгөөд энгийн сонголт: Server-Sent Events.
  • Нэг чиглэлт (server → client) — бидэнд яг хэрэгтэй нь энэ
  • EventSource нь browser-т ТӨРӨЛХӨӨСӨӨ auto-reconnect хийдэг
  • FastAPI StreamingResponse-оор шууд хэрэгжинэ, нэмэлт хамааралгүй

Залгагч бүр өөрийн asyncio.Queue авах ба хэт дүүрсэн (удаан клиент) үед
хуучин event-үүдийг хаяна — мониторинг хэзээ ч блоктохгүй.
"""

from __future__ import annotations

import asyncio
import logging
from typing import AsyncIterator

from app.schemas.alerts import StreamEvent

logger = logging.getLogger("forex_analyzer.monitor")

_QUEUE_MAX = 100  # клиент бүрийн event буфер


class Broadcaster:
    """Олон SSE клиент рүү event цацах төв."""

    def __init__(self) -> None:
        self._subscribers: set[asyncio.Queue[StreamEvent]] = set()
        self._lock = asyncio.Lock()

    async def subscribe(self) -> AsyncIterator[StreamEvent]:
        """Шинэ захиалагч нэмж, түүний event урсгалыг yield-лана.

        Холболт тасрахад (client disconnect) generator дуусч, queue нь
        автоматаар хасагдана.
        """
        queue: asyncio.Queue[StreamEvent] = asyncio.Queue(maxsize=_QUEUE_MAX)
        async with self._lock:
            self._subscribers.add(queue)
        logger.info("SSE клиент холбогдлоо (нийт %d)", len(self._subscribers))
        try:
            while True:
                yield await queue.get()
        finally:
            async with self._lock:
                self._subscribers.discard(queue)
            logger.info("SSE клиент саллаа (нийт %d)", len(self._subscribers))

    async def broadcast(self, event: StreamEvent) -> None:
        """Бүх захиалагчид event илгээнэ; дүүрсэн queue-наас хуучныг хаяна."""
        async with self._lock:
            targets = list(self._subscribers)
        for queue in targets:
            if queue.full():
                try:
                    queue.get_nowait()  # хамгийн хуучныг нь хаяна
                except asyncio.QueueEmpty:  # pragma: no cover
                    pass
            try:
                queue.put_nowait(event)
            except asyncio.QueueFull:  # pragma: no cover
                pass

    @property
    def subscriber_count(self) -> int:
        return len(self._subscribers)

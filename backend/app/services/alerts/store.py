"""Alert түүх + тохиргооны хадгалалт (Step 7).

Одоогоор `InMemoryAlertStore` — процесс доторх, хязгаартай (alert_history_max)
санах ой. Архитектур нь `AlertStore` protocol дээр суурилсан тул PostgreSQL
хэрэгжилт (schema-ийн `signals_alerts` хүснэгт) нэмэхэд энэ давхаргын API
өөрчлөгдөхгүй. Тодорхой ID дугаарлалт нь клиентийг reconnect үед duplicate
alert-аас хамгаална.
"""

from __future__ import annotations

import itertools
import logging
import threading
from dataclasses import dataclass
from typing import Protocol, runtime_checkable

from app.schemas.alerts import AlertRecord, AlertSettings

logger = logging.getLogger("forex_analyzer.alerts")


@runtime_checkable
class AlertStore(Protocol):
    """Alert түүхийн нийтлэг гэрээ (Postgres хэрэгжилт ирээдүйд нэмэгдэнэ)."""

    def add(self, record: AlertRecord) -> AlertRecord: ...

    def history(self, limit: int = 50) -> list[AlertRecord]: ...

    def get_settings(self) -> AlertSettings: ...

    def update_settings(self, patch: AlertSettings) -> AlertSettings: ...


@dataclass
class InMemoryAlertStore:
    """Thread-safe, хязгаартай in-memory alert түүх + тохиргоо."""

    max_items: int = 200

    def __post_init__(self) -> None:
        self._lock = threading.Lock()
        self._items: list[AlertRecord] = []
        self._ids = itertools.count(1)
        self._settings = AlertSettings()

    def next_id(self) -> int:
        """Дараагийн alert ID (монитор үүнийг ашиглан record үүсгэнэ)."""
        return next(self._ids)

    def add(self, record: AlertRecord) -> AlertRecord:
        with self._lock:
            self._items.append(record)
            if len(self._items) > self.max_items:
                # Хуучныг нь хаяж хязгаарт барина
                self._items = self._items[-self.max_items :]
        logger.info("alert #%d: %s %s (conf=%d)", record.id, record.symbol, record.signal.value, record.confidence)
        return record

    def history(self, limit: int = 50) -> list[AlertRecord]:
        with self._lock:
            # Шинэ нь эхэндээ
            return list(reversed(self._items[-limit:]))

    def get_settings(self) -> AlertSettings:
        with self._lock:
            return self._settings.model_copy()

    def update_settings(self, patch: AlertSettings) -> AlertSettings:
        with self._lock:
            self._settings = patch.model_copy()
        logger.info(
            "alert тохиргоо шинэчлэгдлээ: buy=%s sell=%s wait=%s telegram=%s",
            patch.buy_enabled, patch.sell_enabled, patch.wait_enabled, patch.telegram_enabled,
        )
        return self._settings.model_copy()

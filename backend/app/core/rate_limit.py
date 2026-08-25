"""In-memory sliding-window rate limiter (Step 8).

Зорилго: үнэтэй endpoint-үүдийг (market data, AI, backtest) санамсаргүй
spam-аас хамгаалах. Realtime SSE урсгал rate limit-д ОРОХГҮЙ (урт холболт).

Төвийн зарчим:
  • IP + группээр хязгаарлана (нэг process; олон instance-д Redis-рүү
    өргөжүүлэхэд бэлэн бүтэц)
  • Хэтэрсэн үед `RateLimitedError` → 429 + Retry-After header
  • `RATE_LIMIT_ENABLED=false` бол бүх шалгалт алгасана (dev/test)
"""

from __future__ import annotations

import time
from collections import deque
from threading import Lock

from fastapi import Request

from app.core.config import get_settings
from app.core.errors import RateLimitedError


class RateLimiter:
    """Sliding window: сүүлийн `window_s` секундэд `limit` хүсэлт зөвшөөрнө."""

    def __init__(self, limit: int, window_s: float = 60.0) -> None:
        self.limit = max(1, limit)
        self.window_s = window_s
        self._hits: dict[str, deque[float]] = {}
        self._lock = Lock()

    def check(self, key: str) -> tuple[bool, int, float]:
        """(зөвшөөрсөн эсэх, үлдсэн квот, хориотой үед хүлээх секунд)."""
        now = time.monotonic()
        with self._lock:
            hits = self._hits.setdefault(key, deque())
            # Хуучирсан цохилтуудыг цэвэрлэнэ (memory leak хаалт)
            while hits and now - hits[0] > self.window_s:
                hits.popleft()
            if len(hits) >= self.limit:
                retry_after = max(1.0, self.window_s - (now - hits[0]))
                return False, 0, retry_after
            hits.append(now)
            return True, self.limit - len(hits), 0.0

    def reset(self) -> None:
        """Тестэд зориулж бүх тоолуурыг цэвэрлэнэ."""
        with self._lock:
            self._hits.clear()


# Группийн тохируулга (утгыг Settings-ээс авна)
class Group:
    FOREX = "forex"  # quote/candles — provider credit хамгаална
    ANALYSIS = "analysis"  # signal + AI — хамгийн үнэтэй
    BACKTEST = "backtest"  # CPU-интенсив
    ALERTS = "alerts"  # тохиргоо бичилт


_registry: dict[str, RateLimiter] = {}


def get_limiter(group: str) -> RateLimiter:
    """Групп бүрт нэг limiter (Settings-ийн утгаар үүснэ)."""
    if group not in _registry:
        s = get_settings()
        limits = {
            Group.FOREX: s.rate_limit_forex_per_min,
            Group.ANALYSIS: s.rate_limit_analysis_per_min,
            Group.BACKTEST: s.rate_limit_backtest_per_min,
            Group.ALERTS: s.rate_limit_alerts_per_min,
        }
        _registry[group] = RateLimiter(limits.get(group, 60), window_s=60.0)
    return _registry[group]


def reset_registry() -> None:
    """Тест: limiter-үүдийг дахин үүсгэхэд."""
    for limiter in _registry.values():
        limiter.reset()
    _registry.clear()


def _client_key(request: Request, group: str) -> str:
    """Reverse proxy ард X-Forwarded-For-ийн эхний IP-г авна."""
    forwarded = request.headers.get("X-Forwarded-For", "")
    ip = forwarded.split(",")[0].strip() if forwarded else (request.client.host if request.client else "unknown")
    return f"{ip}:{group}"


def rate_limit(group: str):
    """FastAPI dependency factory: `Depends(rate_limit(Group.FOREX))`."""

    def dependency(request: Request) -> None:
        settings = get_settings()
        if not settings.rate_limit_enabled:
            return
        limiter = get_limiter(group)
        allowed, _, retry_after = limiter.check(_client_key(request, group))
        if not allowed:
            raise RateLimitedError(
                "Хэт олон хүсэлт илрүүллээ. Түр хүлээгээд дахин оролдоно уу.",
                retry_after=int(retry_after) + 1,
            )

    return dependency

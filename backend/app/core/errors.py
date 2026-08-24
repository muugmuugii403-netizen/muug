"""Market data давхаргын domain алдаанууд.

Алдаа бүр HTTP статус + machine-readable код + хүнд уншигдахуйц монгол мессеж
агуулна. main.py-д бүртгэгдсэн handler эдгээрийг нэгдсэн ErrorResponse болгож,
дотоод мэдээллийг (API key, upstream trace) client руу хэзээ ч задлахгүй.
"""

from __future__ import annotations


class MarketDataError(Exception):
    """Бүх market data алдааны суурь класс."""

    status: int = 502
    code: str = "MARKET_DATA_ERROR"

    def __init__(self, message: str, *, retry_after: int | None = None) -> None:
        super().__init__(message)
        self.message = message
        self.retry_after = retry_after


class SymbolNotSupportedError(MarketDataError):
    """Хэрэглэгчийн илгээсэн symbol дэмжигдэхгүй (registry-д байхгүй)."""

    status = 404
    code = "SYMBOL_NOT_SUPPORTED"


class MarketDataNotConfiguredError(MarketDataError):
    """API key байхгүй, sample fallback унтраалттай үед."""

    status = 503
    code = "MARKET_DATA_NOT_CONFIGURED"


class ProviderAuthError(MarketDataError):
    """Twelve Data API key буруу эсвэл хүчингүй (401/501)."""

    status = 502
    code = "MARKET_DATA_AUTH_ERROR"


class ProviderRateLimitedError(MarketDataError):
    """Twelve Data-ийн credit хязгаар дууссан (8/min, 800/өдөр)."""

    status = 429
    code = "MARKET_DATA_RATE_LIMITED"


class SymbolNotFoundUpstreamError(MarketDataError):
    """Provider тухайн symbol-ийг танихгүй байна (404)."""

    status = 502
    code = "UPSTREAM_SYMBOL_NOT_FOUND"


class ProviderRequestRejectedError(MarketDataError):
    """Provider хүсэлтийн параметрийг хүлээж аваагүй (422 гэх мэт)."""

    status = 502
    code = "UPSTREAM_REQUEST_REJECTED"


class ProviderUnavailableError(MarketDataError):
    """Provider 5xx буцаасан эсвэл сүлжээний алдаа (retry-ийн дараа)."""

    status = 502
    code = "MARKET_DATA_UNAVAILABLE"


class ProviderTimeoutError(MarketDataError):
    """Хүсэлт тохируулсан timeout-д багтаж чадсангүй."""

    status = 504
    code = "MARKET_DATA_TIMEOUT"

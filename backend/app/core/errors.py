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


class RateLimitedError(MarketDataError):
    """Дотоод rate limiter хэт олон хүсэлтийг түр хаасан (429 + Retry-After)."""

    status = 429
    code = "RATE_LIMITED"


# ============================================================
# Analysis (signal engine) алдаанууд — Step 3
# ============================================================


class AnalysisError(Exception):
    """Signal engine-ийн алдааны суурь класс."""

    status: int = 500
    code: str = "ANALYSIS_ERROR"

    def __init__(self, message: str) -> None:
        super().__init__(message)
        self.message = message


class InsufficientDataError(AnalysisError):
    """Шинжилгээ хийхэд хангалтгүй лаан / өгөгдөл байна."""

    status = 422
    code = "INSUFFICIENT_DATA"


class InvalidDateRangeError(AnalysisError):
    """Backtest-ийн огнооны муж буруу (эсрэг, хэт урт, ирээдүй)."""

    status = 422
    code = "INVALID_DATE_RANGE"


# ============================================================
# AI (Qwen) алдаанууд — Step 4
# ============================================================


class AiProviderError(Exception):
    """AI provider-ийн алдааны суурь класс.

    Эдгээр нь client руу 5xx болж задрах БОЛОвч explainer давхарга нь
    ихэнхдээ эдгээрийг барьж аваад "AI тайлбар боломжгүй" гэж зөөлөн
    буцаадаг тул signal engine хэвийн ажиллаж үргэлжилнэ.
    """

    status: int = 502
    code: str = "AI_PROVIDER_ERROR"

    def __init__(self, message: str) -> None:
        super().__init__(message)
        self.message = message


class AiAuthError(AiProviderError):
    """Qwen API key хүчингүй (401/403)."""

    status = 502
    code = "AI_AUTH_ERROR"


class AiRateLimitedError(AiProviderError):
    """Qwen API rate limit."""

    status = 502
    code = "AI_RATE_LIMITED"


class AiUnavailableError(AiProviderError):
    """Qwen 5xx эсвэл сүлжээний алдаа."""

    status = 502
    code = "AI_UNAVAILABLE"


class AiTimeoutError(AiProviderError):
    """Qwen timeout."""

    status = 504
    code = "AI_TIMEOUT"


# ============================================================
# Telegram notification алдаанууд — Step 7
# ============================================================


class TelegramError(Exception):
    """Telegram Bot API-ийн алдааны суурь класс.

    Эдгээр нь ХЭЗЭЭ Ч API хариу руу задардаггүй — зөвхөн сервер талд
    лог-логдож, alert түүхэнд `telegram_notification_sent=false` гэж
    тэмдэглэгдэнэ. Monitoring үргэлжилнэ.
    """

    code: str = "TELEGRAM_ERROR"

    def __init__(self, message: str) -> None:
        super().__init__(message)
        self.message = message


class TelegramNotConfiguredError(TelegramError):
    """Bot token / chat id тохируулагдаагүй."""

    code = "TELEGRAM_NOT_CONFIGURED"


class TelegramSendError(TelegramError):
    """Илгээлт амжилтгүй (timeout, 4xx, 5xx)."""

    code = "TELEGRAM_SEND_ERROR"

"""Structured logging + secret scrubbing (Step 8).

Лог-д API key, token, нууц үг ХЭЗЭЭ Ч бичигдэх ёсгүй. Энэ formatter нь
эцсийлэн форматлагдсан мессежээс түлхүүр хэв маягуудыг устгана:
  • apikey=abc123...  →  apikey=***
  • Authorization: Bearer eyJ...  →  Bearer ***
  • password/secret/token утгууд
"""

from __future__ import annotations

import logging
import re

_SCRUB_RULES: list[tuple[re.Pattern[str], str]] = [
    # URL query дахь apikey/token (Twelve Data-ийн ?apikey=... гэх мэт)
    (re.compile(r"((?:api[_-]?key|apikey|token|secret|password|pwd)\s*[=:]\s*)([^&\s\"']{4,})", re.IGNORECASE), r"\1***"),
    # HTTP header хэлбэр
    (re.compile(r"(Bearer\s+)[A-Za-z0-9._\-+/=]{8,}", re.IGNORECASE), r"\1***"),
    # Түлхүүр төст урт санамсаргүй мөр (hamгаалалт: зөвхөн key-тэй хосолсон үед)
    (re.compile(r"(bot)[0-9]{6,}:[A-Za-z0-9_\-]{20,}", re.IGNORECASE), r"\1***:***"),  # Telegram bot token
]


def scrub(text: str) -> str:
    """Мессежээс нууц утгуудыг халхална (цэвэр функц — unit-тесттэй)."""
    for pattern, repl in _SCRUB_RULES:
        text = pattern.sub(repl, text)
    return text


class ScrubbingFormatter(logging.Formatter):
    """Форматласны ДАРАА scrub хийнэ — args-тай message ч хамрагдана."""

    def format(self, record: logging.LogRecord) -> str:
        return scrub(super().format(record))


def configure_logging(debug: bool) -> None:
    """Нэгдсэн structured формат + scrubbing-тай root logger."""
    handler = logging.StreamHandler()
    handler.setFormatter(
        ScrubbingFormatter(
            fmt="%(asctime)s %(levelname)-7s %(name)s :: %(message)s",
            datefmt="%Y-%m-%dT%H:%M:%S%z",
        )
    )
    root = logging.getLogger()
    root.handlers.clear()
    root.addHandler(handler)
    root.setLevel(logging.DEBUG if debug else logging.INFO)
    # Гадаад сангуудын шуугианыг багасгана
    logging.getLogger("httpx").setLevel(logging.WARNING)
    logging.getLogger("httpcore").setLevel(logging.WARNING)
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)

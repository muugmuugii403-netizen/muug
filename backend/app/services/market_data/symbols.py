"""Дэмжигдэх Forex pair-ийн цорын ганц registry.

Шинэ pair нэмэхэд зөвхөн энд нэмнэ — API, frontend mirror, тестүүд бүгд
энэ жагсаалтаас уншина. `typical_spread` нь quote endpoint-эд bid/ask
тооцоход хэрэглэгдэнэ (Twelve Data Forex quote-д bid/ask буцаадаггүй).
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class ForexPair:
    """Нэг Forex pair-ийн тогтмол мэдээлэл."""

    symbol: str  # "EUR/USD" — Twelve Data-д яг энэ форматтай
    name: str
    pip_decimals: int  # үнийн нарийвчлал: JPY pair → 3, бусад → 5
    typical_spread: float  # үнээр илэрхийлэгдсэн ердийн retail spread


FOREX_PAIRS: tuple[ForexPair, ...] = (
    ForexPair("EUR/USD", "Euro / US Dollar", 5, 0.00006),
    ForexPair("GBP/USD", "British Pound / US Dollar", 5, 0.00009),
    ForexPair("USD/JPY", "US Dollar / Japanese Yen", 3, 0.009),
    ForexPair("AUD/USD", "Australian Dollar / US Dollar", 5, 0.00008),
    ForexPair("USD/CAD", "US Dollar / Canadian Dollar", 5, 0.00010),
    ForexPair("USD/CHF", "US Dollar / Swiss Franc", 5, 0.00011),
    ForexPair("NZD/USD", "New Zealand Dollar / US Dollar", 5, 0.00012),
    # Gold Spot — Twelve Data symbol нь мөн "XAU/USD" (Commodity aggregate).
    # 2 оронтой нарийвчлал (2685.45), 1 pip = 0.10, ердийн retail spread ~0.30.
    ForexPair("XAU/USD", "Gold / US Dollar", 2, 0.30),
)

_REGISTRY: dict[str, ForexPair] = {p.symbol: p for p in FOREX_PAIRS}


def is_supported(symbol: str) -> bool:
    return symbol in _REGISTRY


def get_pair(symbol: str) -> ForexPair | None:
    return _REGISTRY.get(symbol)


def supported_symbols() -> list[str]:
    return [p.symbol for p in FOREX_PAIRS]


# Pip хэмжээ — instrument-ээс хамаарна (цорын ганц эх сурвалж):
#   JPY pair → 0.01 · Gold → 0.10 · бусад → 0.0001
_PIP_OVERRIDES: dict[str, float] = {"XAU/USD": 0.1}


def pip_size(symbol: str) -> float:
    """Нэг pip-ийн үнэ. Тодорхойгүй symbol-д 0.0001 (standard pip)."""
    if symbol in _PIP_OVERRIDES:
        return _PIP_OVERRIDES[symbol]
    return 0.01 if symbol.endswith("/JPY") else 0.0001

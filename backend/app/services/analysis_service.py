"""Deterministic analysis engine — Step 1-д зөвхөн бүтэц (placeholder).

Архитектурын хатуу дүрэм:
  • Signal ЗӨВХӨН энэ давхаргаас гарна — цэвэр тооцоо (market data + indicator math).
  • AI (Qwen) шийдвэрт хэзээ ч оролцохгүй, зөвхөн бэлэн үр дүнг тайлбарлана (Step 5).

Хэрэгжилтийн дараалал:
  Step 2: market data adapter (TwelveDataClient: timeout, retry, fallback, cache)
  Step 3: pandas + pandas-ta indicator-ууд (EMA 20/50/200, RSI, MACD, ATR, S/R)
  Step 4: 100 онооны жинтэй scoring engine → BUY/SELL/WAIT + Entry/SL/TP/RR
"""

from __future__ import annotations

from app.schemas.analysis import Timeframe


class AnalysisService:
    """Symbol + timeframe аваад тооцоолсон signal буцаана."""

    async def analyze(self, symbol: str, timeframe: Timeframe) -> None:
        """Одоогоор хэрэгжээгүй — Step 2-т дүүргэгдэнэ.

        Args:
            symbol: Forex pair, жишээ нь "EUR/USD".
            timeframe: Шинжилгээний timeframe.

        Raises:
            NotImplementedError: Engine Step 2-т хэрэгжинэ.
        """
        raise NotImplementedError(
            f"Deterministic scoring engine нь Step 2-т хэрэгжинэ "
            f"(symbol={symbol}, timeframe={timeframe.value})"
        )

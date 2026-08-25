"""AI тайлбарын service — cache + validation + зөөлөн fallback (Step 4).

Гол зарчим: AI алдаа гарсан ч signal engine ХЭЗЭЭ Ч зогсохгүй.
  • Ижил signal + indicator утгад дахин AI дуудлага хийхгүй (TTL fingerprint cache)
  • Хариуг Pydantic-аар validate хийнэ
  • AI signal-ийг өөрчлөх гэж оролдвол (direction tampering) тайлбарыг устгана
  • Аливаа алдаанд (None, "unavailable") буцаана — endpoint signal-ээ хэвээр илгээнэ
"""

from __future__ import annotations

import hashlib
import json
import logging
import re
import time
from dataclasses import dataclass, field
from typing import Any

from app.core.errors import AiProviderError
from app.schemas.ai import AiExplanation, AiStatus
from app.schemas.signal import SignalDirection, SignalResponse
from app.services.ai.prompt import SYSTEM_PROMPT, build_user_message
from app.services.ai.qwen_client import QwenClient

logger = logging.getLogger("forex_analyzer.ai")

MSG_OK = "AI тайлбар бэлэн"
MSG_DISABLED = "AI тайлбар идэвхжээгүй (QWEN_API_KEY оруулаагүй)"
MSG_UNAVAILABLE = "AI тайлбар одоогоор боломжгүй байна."

# AI signal-ийг эсрэг чиглэлд тайлбарлахыг оролдвол эдгээр хээгээр илрүүлнэ.
_TAMPER_PATTERNS: dict[SignalDirection, list[str]] = {
    SignalDirection.BUY: ["зарах дохио", "sell дохио", "sell signal", "зарахыг зөвлөж байна", "зар"],
    SignalDirection.SELL: ["худалдан авах дохио", "buy дохио", "buy signal", "худалдан авахыг зөвлөж байна"],
    SignalDirection.WAIT: ["заавал худалдаж авах", "заавал зарах", "must buy", "must sell"],
}


@dataclass
class _CacheEntry:
    expires_at: float
    explanation: AiExplanation


@dataclass
class ExplanationService:
    """Signal аваад Монгол хэл дээрх тайлбар буцаана (алдаанд унадаггүй)."""

    client: QwenClient | None
    cache_ttl_s: float = 900.0
    _cache: dict[str, _CacheEntry] = field(default_factory=dict, init=False)

    async def explain(self, signal: SignalResponse) -> tuple[AiExplanation | None, AiStatus, str]:
        """(explanation, status, frontend мессеж) — гурвал буцаана, exception үгүй."""
        if self.client is None:
            return None, "disabled", MSG_DISABLED

        key = self._fingerprint(signal)
        cached = self._cache.get(key)
        if cached is not None and cached.expires_at > time.monotonic():
            logger.info("AI тайлбар cache-аас (%s)", signal.symbol)
            return cached.explanation, "ok", MSG_OK

        try:
            raw = await self.client.complete_json(SYSTEM_PROMPT, build_user_message(signal))
            explanation = self._validate(raw, signal)
        except (AiProviderError, ValueError, KeyError) as exc:
            logger.warning("AI тайлбар боломжгүй (%s): %s", signal.symbol, exc)
            return None, "unavailable", MSG_UNAVAILABLE

        self._cache[key] = _CacheEntry(expires_at=time.monotonic() + self.cache_ttl_s, explanation=explanation)
        return explanation, "ok", MSG_OK

    # ---------- дотоод ----------

    @staticmethod
    def _fingerprint(signal: SignalResponse) -> str:
        """Ижил signal + indicator утга → ижил key (AI дахин дуудагдахгүй)."""
        tf = signal.timeframes
        material: dict[str, Any] = {
            "symbol": signal.symbol,
            "signal": signal.signal.value,
            "buy": signal.buy_score,
            "sell": signal.sell_score,
            "entry": signal.entry,
            "sl": signal.stop_loss,
            "tp": signal.take_profit,
            "5m": {"trend": tf["5m"].trend.value, "rsi": tf["5m"].rsi, "macd": tf["5m"].macd.value},
            "15m": {"trend": tf["15m"].trend.value, "rsi": tf["15m"].rsi, "macd": tf["15m"].macd.value},
        }
        digest = hashlib.sha256(json.dumps(material, sort_keys=True).encode()).hexdigest()
        return f"{signal.symbol}:{digest[:16]}"

    @staticmethod
    def _validate(raw: str, signal: SignalResponse) -> AiExplanation:
        """JSON → Pydantic → direction tampering шалгалт."""
        text = raw.strip()
        # Markdown fence (```json ... ```) арилгана
        fence = re.match(r"^```(?:json)?\s*(.*?)\s*```$", text, re.DOTALL)
        if fence:
            text = fence.group(1)
        try:
            data = json.loads(text)
        except json.JSONDecodeError as exc:
            raise ValueError(f"AI хариу JSON биш байна: {exc}") from exc

        explanation = AiExplanation.model_validate(data)  # бүтэц + урт шалгалт

        # Direction tampering: signal BUY атал "зарах дохио" гэх мэт эсрэг тайлбар
        haystack = " ".join(
            [explanation.summary, explanation.signal_explanation, explanation.market_context]
            + explanation.technical_reasons
        ).lower()
        for pattern in _TAMPER_PATTERNS[signal.signal]:
            if pattern.lower() in haystack:
                raise ValueError(f"AI signal-ийг өөрчлөх гэж оролдлоо ('{pattern}') — тайлбар устгагдлаа")

        return explanation

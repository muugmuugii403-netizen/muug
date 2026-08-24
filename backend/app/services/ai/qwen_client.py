"""Qwen AI client — DashScope OpenAI-compatible endpoint (Step 4).

Зөвхөн backend-ээс дуудагдана; API key нь .env-ийн SecretStr бөгөөд
frontend руу хэзээ ч гарахгүй. Хариуг JSON горимд (response_format=json_object)
авч, дотоод алдааг `AiProviderError` болгон хувиргана.
"""

from __future__ import annotations

import asyncio
import logging
from typing import Any

import httpx

from app.core.errors import (
    AiAuthError,
    AiProviderError,
    AiRateLimitedError,
    AiTimeoutError,
    AiUnavailableError,
)

logger = logging.getLogger("forex_analyzer.ai")


class QwenClient:
    """DashScope-ийн OpenAI-тэй зохицолдох /chat/completions endpoint."""

    def __init__(
        self,
        api_key: str,
        base_url: str = "https://dashscope-intl.aliyuncs.com/compatible-mode/v1",
        model: str = "qwen-plus",
        timeout_s: float = 20.0,
        max_tokens: int = 900,
        temperature: float = 0.3,
        transport: httpx.AsyncBaseTransport | None = None,  # тестэд MockTransport
    ) -> None:
        if not api_key:
            raise ValueError("QwenClient-д API key заавал шаардлагатай")
        self._model = model
        self._max_tokens = max_tokens
        self._temperature = temperature
        self._client = httpx.AsyncClient(
            base_url=base_url.rstrip("/"),
            timeout=httpx.Timeout(timeout_s),
            transport=transport,
            headers={
                "Authorization": f"Bearer {api_key}",  # key зөвхөн энд, лог-д гарахгүй
                "Content-Type": "application/json",
            },
        )

    async def aclose(self) -> None:
        await self._client.aclose()

    async def complete_json(self, system_prompt: str, user_message: str) -> str:
        """Chat completion — JSON text буцаана. Нэг удаа retry (5xx/timeout)."""
        payload: dict[str, Any] = {
            "model": self._model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_message},
            ],
            "temperature": self._temperature,
            "max_tokens": self._max_tokens,
            "response_format": {"type": "json_object"},
        }

        last_error: Exception | None = None
        for attempt in range(2):  # анхны оролдлого + нэг retry
            try:
                resp = await self._client.post("/chat/completions", json=payload)
            except httpx.TimeoutException as exc:
                last_error = exc
                logger.warning("Qwen timeout (оролдлого %d/2)", attempt + 1)
            except httpx.TransportError as exc:
                last_error = exc
                logger.warning("Qwen сүлжээний алдаа: %s (оролдлого %d/2)", exc, attempt + 1)
            else:
                if resp.status_code == 429:
                    raise AiRateLimitedError("Qwen API-ийн хүсэлтийн хязгаар дууслаа.")
                if resp.status_code in (401, 403):
                    raise AiAuthError("Qwen API key хүчингүй байна.")
                if resp.status_code >= 500:
                    last_error = AiUnavailableError(f"Qwen серверийн алдаа (HTTP {resp.status_code})")
                    logger.warning("Qwen HTTP %d (оролдлого %d/2)", resp.status_code, attempt + 1)
                elif resp.status_code >= 400:
                    raise AiProviderError(f"Qwen хүсэлтийг хүлээж авсангүй (HTTP {resp.status_code})")
                else:
                    return self._extract_content(resp.json())
            if attempt == 0:
                await asyncio.sleep(0.5)

        if isinstance(last_error, AiUnavailableError):
            raise last_error
        raise AiTimeoutError("Qwen API хариу өгсөнгүй (timeout)") from last_error

    @staticmethod
    def _extract_content(body: dict[str, Any]) -> str:
        try:
            content = body["choices"][0]["message"]["content"]
        except (KeyError, IndexError, TypeError) as exc:
            raise AiProviderError("Qwen хариуны бүтэц буруу байна") from exc
        if not isinstance(content, str) or not content.strip():
            raise AiProviderError("Qwen хариуны content хоосон байна")
        return content

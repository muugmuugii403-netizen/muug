"""Telegram Bot notification (Step 7) — SERVER-SIDE ONLY.

Bot token ба chat ID зөвхөн backend-ийн .env-д байна; frontend руу хэзээ ч
гарахгүй. Илгээлтийн алдаа нь мониторингийг ЗОГСООХГҮЙ — зөвхөн лог-логдож,
alert record-д `telegram_notification_sent=false` тэмдэглэгдэнэ.
"""

from __future__ import annotations

import logging

import httpx

from app.core.errors import TelegramNotConfiguredError, TelegramSendError
from app.schemas.alerts import AlertRecord
from app.schemas.signal import SignalDirection

logger = logging.getLogger("forex_analyzer.alerts")

TELEGRAM_API = "https://api.telegram.org"

_SIGNAL_EMOJI: dict[SignalDirection, str] = {
    SignalDirection.BUY: "\U0001f7e2",  # 🟢
    SignalDirection.SELL: "\U0001f534",  # 🔴
    SignalDirection.WAIT: "\U0001f7e1",  # 🟡
}


def build_message(alert: AlertRecord) -> str:
    """Alert-аас Telegram мессеж бүтээнэ (цэвэр функц — unit тестэд шууд шалгагдана)."""
    emoji = _SIGNAL_EMOJI[alert.signal]
    lines = [
        alert.symbol,
        "",
        f"{emoji} {alert.signal.value}",
        "",
        f"Confidence: {alert.confidence}/100",
        "",
    ]
    if alert.entry is not None:
        lines.append(f"Entry: {alert.entry}")
    if alert.stop_loss is not None:
        lines.append(f"SL: {alert.stop_loss}")
    if alert.take_profit is not None:
        lines.append(f"TP: {alert.take_profit}")
    if alert.risk_reward is not None:
        lines.append(f"Risk/Reward: 1:{alert.risk_reward:g}")
    if alert.reasons:
        lines.append("")
        lines.append("Reasons:")
        lines.extend(f"- {r}" for r in alert.reasons[:6])
    return "\n".join(lines)


class TelegramNotifier:
    """Bot Token API-аар мессеж илгээнэ: POST /bot<token>/sendMessage."""

    def __init__(
        self,
        bot_token: str,
        chat_id: str,
        timeout_s: float = 8.0,
        transport: httpx.AsyncBaseTransport | None = None,  # тестэд MockTransport
    ) -> None:
        self._configured = bool(bot_token and chat_id)
        self._chat_id = chat_id
        self._endpoint = f"{TELEGRAM_API}/bot{bot_token}/sendMessage" if bot_token else ""
        self._client = httpx.AsyncClient(timeout=httpx.Timeout(timeout_s), transport=transport)

    @property
    def configured(self) -> bool:
        return self._configured

    async def aclose(self) -> None:
        await self._client.aclose()

    async def send_alert(self, alert: AlertRecord) -> None:
        """Alert илгээнэ. Амжилтгүй бол TelegramSendError — дээд давхарга барьж авна."""
        if not self._configured:
            raise TelegramNotConfiguredError("Telegram bot тохируулагдаагүй (.env: TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID)")

        text = build_message(alert)
        try:
            resp = await self._client.post(
                self._endpoint,
                json={"chat_id": self._chat_id, "text": text, "disable_web_page_preview": True},
            )
        except (httpx.TimeoutException, httpx.TransportError) as exc:
            raise TelegramSendError(f"Telegram руу илгээж чадсангүй: {exc}") from exc

        if resp.status_code != 200:
            raise TelegramSendError(f"Telegram API буруу хариу: HTTP {resp.status_code}")
        body = resp.json()
        if not body.get("ok"):
            raise TelegramSendError(f"Telegram API: {str(body.get('description', 'алдаа'))[:150]}")
        logger.info("Telegram alert илгээгдлээ: #%d %s %s", alert.id, alert.symbol, alert.signal.value)

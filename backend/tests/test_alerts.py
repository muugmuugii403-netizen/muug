"""Step 7 — Telegram notifier + alert store + settings тестүүд.

Хамрах хүрээ:
  • Telegram мессеж бүтээгч (BUY/SELL/WAIT, reasons, RR)
  • Telegram илгээлт: амжилт / HTTP алдаа / тохируулагдаагүй
  • InMemoryAlertStore: нэмэх, хязгаар, түүх эрэмбэ
  • AlertSettings: allows() чиглэл шүүлт
"""

from __future__ import annotations

import httpx
import pytest

from app.core.errors import TelegramNotConfiguredError, TelegramSendError
from app.schemas.alerts import AlertRecord, AlertSettings
from app.schemas.signal import SignalDirection
from app.services.alerts.store import InMemoryAlertStore
from app.services.alerts.telegram import TelegramNotifier, build_message


def make_alert(
    signal: SignalDirection = SignalDirection.BUY,
    id_: int = 1,
    entry: float | None = 1.17000,
    sl: float | None = 1.16850,
    tp: float | None = 1.17300,
    reasons: list[str] | None = None,
) -> AlertRecord:
    return AlertRecord(
        id=id_,
        symbol="EUR/USD",
        signal=signal,
        confidence=78,
        buy_score=78,
        sell_score=12,
        wait_score=10,
        entry=entry,
        stop_loss=sl,
        take_profit=tp,
        risk_reward=2.0 if entry else None,
        reasons=reasons if reasons is not None else ["15M bullish trend", "MACD bullish"],
    )


# ---------- build_message ----------


def test_message_buy_contains_all_fields() -> None:
    msg = build_message(make_alert(SignalDirection.BUY))
    assert "EUR/USD" in msg
    assert "BUY" in msg
    assert "🟢" in msg
    assert "Confidence: 78/100" in msg
    assert "Entry: 1.17" in msg
    assert "SL: 1.1685" in msg
    assert "TP: 1.173" in msg
    assert "Risk/Reward: 1:2" in msg
    assert "- 15M bullish trend" in msg


def test_message_sell_and_wait_emojis() -> None:
    assert "🔴" in build_message(make_alert(SignalDirection.SELL))
    assert "🟡" in build_message(make_alert(SignalDirection.WAIT, entry=None, sl=None, tp=None))


def test_message_wait_without_trade_plan() -> None:
    msg = build_message(make_alert(SignalDirection.WAIT, entry=None, sl=None, tp=None))
    assert "Entry" not in msg  # WAIT-д төлөвлөгөө байхгүй


# ---------- TelegramNotifier ----------


@pytest.mark.asyncio
async def test_telegram_send_success() -> None:
    captured: dict = {}

    def handler(request: httpx.Request) -> httpx.Response:
        captured["body"] = request.read()
        return httpx.Response(200, json={"ok": True, "result": {"message_id": 42}})

    notifier = TelegramNotifier("tok", "123", transport=httpx.MockTransport(handler))
    assert notifier.configured
    await notifier.send_alert(make_alert())
    assert b"BUY" in captured["body"]
    await notifier.aclose()


@pytest.mark.asyncio
async def test_telegram_send_http_error() -> None:
    notifier = TelegramNotifier(
        "tok", "123", transport=httpx.MockTransport(lambda r: httpx.Response(400, json={"ok": False}))
    )
    with pytest.raises(TelegramSendError):
        await notifier.send_alert(make_alert())
    await notifier.aclose()


@pytest.mark.asyncio
async def test_telegram_send_api_not_ok() -> None:
    notifier = TelegramNotifier(
        "tok", "123", transport=httpx.MockTransport(lambda r: httpx.Response(200, json={"ok": False, "description": "chat not found"}))
    )
    with pytest.raises(TelegramSendError):
        await notifier.send_alert(make_alert())
    await notifier.aclose()


@pytest.mark.asyncio
async def test_telegram_send_timeout() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectTimeout("timeout")

    notifier = TelegramNotifier("tok", "123", transport=httpx.MockTransport(handler))
    with pytest.raises(TelegramSendError):
        await notifier.send_alert(make_alert())
    await notifier.aclose()


@pytest.mark.asyncio
async def test_telegram_not_configured() -> None:
    notifier = TelegramNotifier("", "")
    assert not notifier.configured
    with pytest.raises(TelegramNotConfiguredError):
        await notifier.send_alert(make_alert())
    await notifier.aclose()


# ---------- InMemoryAlertStore ----------


def test_store_add_and_order() -> None:
    store = InMemoryAlertStore(max_items=10)
    a1 = store.add(make_alert(id_=1))
    a2 = store.add(make_alert(id_=2, signal=SignalDirection.SELL))
    history = store.history(limit=10)
    assert history[0].id == 2  # шинэ нь эхэндээ
    assert history[1].id == 1
    assert a1.id == 1 and a2.id == 2


def test_store_respects_cap() -> None:
    store = InMemoryAlertStore(max_items=3)
    for i in range(1, 6):
        store.add(make_alert(id_=i))
    history = store.history(limit=10)
    assert len(history) == 3
    assert [a.id for a in history] == [5, 4, 3]  # хуучин нь хаягдсан


def test_store_next_id_increments() -> None:
    store = InMemoryAlertStore()
    assert store.next_id() == 1
    assert store.next_id() == 2


# ---------- AlertSettings ----------


def test_settings_allows_direction() -> None:
    s = AlertSettings(buy_enabled=True, sell_enabled=False, wait_enabled=True)
    assert s.allows(SignalDirection.BUY)
    assert not s.allows(SignalDirection.SELL)
    assert s.allows(SignalDirection.WAIT)


def test_store_settings_roundtrip() -> None:
    store = InMemoryAlertStore()
    assert store.get_settings().buy_enabled is True  # default
    updated = store.update_settings(AlertSettings(buy_enabled=False, telegram_enabled=False))
    assert updated.buy_enabled is False
    assert updated.telegram_enabled is False
    assert store.get_settings().buy_enabled is False

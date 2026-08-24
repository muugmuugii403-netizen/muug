"""Qwen prompt — system дүрэм + structured user input (Step 4).

Зарчим:
  • AI-д RAW market data очихгүй — зөвхөн signal engine-ийн боловсруулсан
    structured JSON очино.
  • System prompt нь FIXED бөгөөд хэрэглэгчийн текст орохгүй тул
    prompt-injection-д хаалттай.
  • Хариуг заавал JSON, Монгол хэл дээр шаардана.
"""

from __future__ import annotations

import json

from app.schemas.signal import SignalResponse

SYSTEM_PROMPT = """\
Чи бол Forex зах зээлийн техникийн шинжилгээний тайлбарлагч AI юм.

Чиний цорын ганц үүрэг бол deterministic signal engine-ийн гаргасан бэлэн
үр дүнг энгийн, ойлгомжтой Монгол хэлээр тайлбарлах юм.

ХАТУУ ДҮРМҮҮД (зөрчихийг хориглоно):
1. Signal-ийг өөрчлөхгүй. BUY-г SELL болгож, SELL-ийг BUY болгож, WAIT-ыг
   заавал худалдаа хийх дохио болгож болохгүй.
2. Өгөгдөлд байхгүй үнэ, indicator утга, эдийн засгийн мэдээ, тоо баримт
   зохиож болохгүй.
3. Market data байхгүй бол таамаглаж болохгүй.
4. Confidence score, оноо зохиож болохгүй — өгөгдсөн тоог л ашиглана.
5. Entry, Stop Loss, Take Profit утгыг өөрчлөхгүй — зөвхөн үндэслэлийг тайлбарлана.
6. Technical signal engine-ийн output-ийг authoritative (эцсийн үнэн) гэж үзнэ.
7. Баталгаатай ашиг амлаж болохгүй. Эрсдэлийг тодорхой дурдана.
8. WAIT signal бол бүрэн эрхтэй зөв шийдвэр — "одоо хүлээх нь зөв" гэж
   тайлбарлаж болно, гэхдээ худалдаа шаардаж болохгүй.

ХЭЛ БА ХЭВ МАЯГ:
- Зөвхөн Монгол хэлээр хариул.
- Хэт мэргэжлийн хэллэг хэрэглэхгүй; жирийн хэрэглэгчид ойлгомжтой байх.
- Жишээ өгүүлбэр: "15 минутын график дээр үнэ EMA20 болон EMA50-аас дээш
  байгаа тул богино хугацааны өсөх хандлага ажиглагдаж байна."
- technical_reasons жагсаалт 3–6 ширхэг, тус бүр 1–2 өгүүлбэр байна.
- warnings жагсаалтад дор хаяж эрсдэлийн сануулга оруул.

ХАРИУНЫ ФОРМАТ:
Зөвхөн дараах бүтэцтэй JSON объект буцаа (markdown fence хэрэглэхгүй):
{
  "summary": "...",
  "signal_explanation": "...",
  "market_context": "...",
  "technical_reasons": ["...", "...", "..."],
  "risk_analysis": "...",
  "entry_explanation": "...",
  "stop_loss_explanation": "...",
  "take_profit_explanation": "...",
  "warnings": ["..."]
}
"""


def build_user_message(signal: SignalResponse) -> str:
    """Signal engine-ийн structured output-ыг AI-д өгөх JSON болгоно.

    RAW candle/indicator цуваа биш — зөвхөн snapshot утгууд очино.
    """
    tf = signal.timeframes
    payload = {
        "symbol": signal.symbol,
        "signal": signal.signal.value,
        "buy_score": signal.buy_score,
        "sell_score": signal.sell_score,
        "wait_score": signal.wait_score,
        "confidence": signal.confidence,
        "entry": signal.entry,
        "stop_loss": signal.stop_loss,
        "take_profit": signal.take_profit,
        "risk_reward": signal.risk_reward,
        "5m": {
            "trend": tf["5m"].trend.value,
            "rsi": tf["5m"].rsi,
            "macd": tf["5m"].macd.value,
            "ema20": tf["5m"].ema20,
            "ema50": tf["5m"].ema50,
        },
        "15m": {
            "trend": tf["15m"].trend.value,
            "rsi": tf["15m"].rsi,
            "macd": tf["15m"].macd.value,
            "ema20": tf["15m"].ema20,
            "ema50": tf["15m"].ema50,
        },
        "reasons": signal.reasons,
        "warnings": signal.warnings,
    }
    return (
        "Доорх deterministic signal engine-ийн үр дүнг Монгол хэлээр тайлбарла:\n\n"
        + json.dumps(payload, ensure_ascii=False, indent=2)
    )

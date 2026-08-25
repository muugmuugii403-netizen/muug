"""Deterministic scoring engine (Step 3).

Зарчим:
  • Дүрэм бүр өөрийн жинг яг НЭГ талд (buy/sell/wait) бичнэ — учир нь
    buy + sell ≤ 90 байх ба wait_score = 100 − buy − sell гэж тодорхойлогдоно.
  • Дүрэм бүр тусдаа evaluation функцтэй; `compute_signal` зөвхөн нэгтгэнэ.
  • Шийдвэр: BUY ⇔ buy ≥ 65 ба buy > sell; SELL ⇔ sell ≥ 65 ба sell > buy;
    бусад тохиолдолд WAIT (зөрчилтэй дохиог оруулаад). WAIT бол бүрэн эрхт signal.
  • Entry/SL/TP нь зөвхөн сүүлийн үнэ + ATR + RR харьцаанаас тооцогдоно —
    hardcoded үнэ байхгүй.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Final, Literal

from app.schemas.signal import (
    MacdState,
    PriceActionState,
    SignalDirection,
    SignalResponse,
    TimeframeAnalysis,
    TrendState,
)
from app.services.analysis.indicators import TfSnapshot

Side = Literal["buy", "sell", "wait"]

# ---------- тогтмол жин ба босго (архитектурын нэг цэгт) ----------

W_TREND_15M: Final[int] = 25  # 15M үндсэн trend
W_EMA: Final[int] = 10  # EMA20 vs EMA50 (15M)
W_RSI: Final[int] = 10  # RSI бүс (15M)
W_MACD: Final[int] = 15  # MACD чиглэл (15M)
W_SUPPORT_RESISTANCE: Final[int] = 10  # S/R орчим дахь урвал (15M)
W_CONFIRM_5M: Final[int] = 20  # 5M баталгаажуулалт (entry timing)

SIGNAL_THRESHOLD: Final[int] = 65  # buy/sell аль нэг нь ≥ 65 байж signal болно
DEFAULT_RISK_REWARD: Final[float] = 2.0  # 1:2
ATR_SL_MULTIPLIER: Final[float] = 1.5  # SL = ATR14(5m) × 1.5

RSI_BULL_MIN: Final[float] = 50.0
RSI_BULL_MAX: Final[float] = 70.0
RSI_BEAR_MIN: Final[float] = 30.0
RSI_BEAR_MAX: Final[float] = 50.0

BASE_WARNING: Final[str] = "Signal is based on technical indicators only"


@dataclass(frozen=True)
class RuleResult:
    """Нэг дүрмийн үр дүн: жин яг нэг талд бичигдэнэ."""

    key: str
    weight: int
    side: Side
    reason: str | None = None  # buy/sell үед reasons-д орно
    warning: str | None = None


# ---------- дүрэм бүрийн evaluation функцууд (цэвэр, тестлэгдэхүйц) ----------


def evaluate_trend_15m(s15: TfSnapshot) -> RuleResult:
    """15M үндсэн trend: bullish → BUY, bearish → SELL, саармаг → WAIT."""
    if s15.trend is TrendState.BULLISH:
        return RuleResult("trend_15m", W_TREND_15M, "buy", "15M trend bullish")
    if s15.trend is TrendState.BEARISH:
        return RuleResult("trend_15m", W_TREND_15M, "sell", "15M trend bearish")
    return RuleResult("trend_15m", W_TREND_15M, "wait", warning="15M trend is neutral — no clear direction")


def evaluate_ema(s15: TfSnapshot) -> RuleResult:
    """EMA20 vs EMA50 (15M)."""
    if s15.ema20 > s15.ema50:
        return RuleResult("ema", W_EMA, "buy", "EMA20 is above EMA50")
    if s15.ema20 < s15.ema50:
        return RuleResult("ema", W_EMA, "sell", "EMA20 is below EMA50")
    return RuleResult("ema", W_EMA, "wait")


def evaluate_rsi(s15: TfSnapshot) -> RuleResult:
    """RSI бүс: 50–70 → BUY, 30–50 → SELL, 70+/30− → оноогүй (зөвхөн warning)."""
    rsi = s15.rsi
    if RSI_BULL_MIN < rsi <= RSI_BULL_MAX:
        return RuleResult("rsi", W_RSI, "buy", f"RSI {rsi:.1f} is in the bullish zone (50–70)")
    if RSI_BEAR_MIN <= rsi < RSI_BEAR_MAX:
        return RuleResult("rsi", W_RSI, "sell", f"RSI {rsi:.1f} is in the bearish zone (30–50)")
    warning = None
    if rsi > RSI_BULL_MAX:
        warning = f"RSI {rsi:.1f} above 70 — overbought, no extra BUY score"
    elif rsi < RSI_BEAR_MIN:
        warning = f"RSI {rsi:.1f} below 30 — oversold, no extra SELL score"
    return RuleResult("rsi", W_RSI, "wait", warning=warning)


def evaluate_macd(s15: TfSnapshot) -> RuleResult:
    """MACD(12,26,9) histogram-ийн чиглэл (15M)."""
    if s15.macd is MacdState.BULLISH:
        return RuleResult("macd", W_MACD, "buy", "MACD bullish")
    if s15.macd is MacdState.BEARISH:
        return RuleResult("macd", W_MACD, "sell", "MACD bearish")
    return RuleResult("macd", W_MACD, "wait")


def evaluate_support_resistance(s15: TfSnapshot) -> RuleResult:
    """Support орчимд bullish урвал → BUY; resistance орчимд bearish урвал → SELL."""
    if s15.price_action is PriceActionState.BULLISH_REACTION:
        return RuleResult(
            "support_resistance",
            W_SUPPORT_RESISTANCE,
            "buy",
            f"Price reacted bullishly near support {s15.support:.5f}",
        )
    if s15.price_action is PriceActionState.BEARISH_REACTION:
        return RuleResult(
            "support_resistance",
            W_SUPPORT_RESISTANCE,
            "sell",
            f"Price reacted bearishly near resistance {s15.resistance:.5f}",
        )
    return RuleResult("support_resistance", W_SUPPORT_RESISTANCE, "wait")


def evaluate_confirm_5m(s5: TfSnapshot, s15: TfSnapshot) -> RuleResult:
    """5M баталгаажуулалт (entry timing). 15M-тэй зөрчилдвөл WAIT + warning."""
    bullish = s5.ema20 > s5.ema50 and s5.close > s5.ema20
    bearish = s5.ema20 < s5.ema50 and s5.close < s5.ema20

    if bullish and s15.trend is not TrendState.BEARISH:
        return RuleResult("confirm_5m", W_CONFIRM_5M, "buy", "5M confirms bullish momentum")
    if bearish and s15.trend is not TrendState.BULLISH:
        return RuleResult("confirm_5m", W_CONFIRM_5M, "sell", "5M confirms bearish momentum")

    conflict = (bullish and s15.trend is TrendState.BEARISH) or (
        bearish and s15.trend is TrendState.BULLISH
    )
    warning = "5M and 15M timeframes disagree — uncertainty increased" if conflict else None
    return RuleResult("confirm_5m", W_CONFIRM_5M, "wait", warning=warning)


# ---------- нэгтгэх функц ----------


@dataclass(frozen=True)
class _Scores:
    buy: int
    sell: int
    wait: int


def _aggregate(results: list[RuleResult]) -> tuple[_Scores, list[str], list[str]]:
    buy = sum(r.weight for r in results if r.side == "buy")
    sell = sum(r.weight for r in results if r.side == "sell")
    wait = 100 - buy - sell  # үлдсэн жин бүгд WAIT талд
    reasons = [r.reason for r in results if r.reason]
    warnings = [r.warning for r in results if r.warning]
    return _Scores(buy=buy, sell=sell, wait=wait), reasons, warnings


def _decide(scores: _Scores) -> SignalDirection:
    """BUY ⇔ buy ≥ 65 ∧ buy > sell; SELL ⇔ sell ≥ 65 ∧ sell > buy; бусад → WAIT."""
    if scores.buy >= SIGNAL_THRESHOLD and scores.buy > scores.sell:
        return SignalDirection.BUY
    if scores.sell >= SIGNAL_THRESHOLD and scores.sell > scores.buy:
        return SignalDirection.SELL
    return SignalDirection.WAIT


def _trade_plan(
    direction: SignalDirection, s5: TfSnapshot, pip_decimals: int
) -> tuple[float | None, float | None, float | None, float | None, str | None]:
    """Entry = сүүлийн 5M үнэ; SL = ATR14(5m) × 1.5; TP = risk × RR(1:2)."""
    if direction is SignalDirection.WAIT:
        return None, None, None, None, None

    entry = s5.close
    risk = s5.atr * ATR_SL_MULTIPLIER
    if risk <= 0:
        # ATR тооцох боломжгүй (хэт бага өгөгдлийн хэлбэлзэл) — төлөвлөгөөгүй WAIT
        return None, None, None, None, "ATR is too small to compute a reliable stop loss"

    if direction is SignalDirection.BUY:
        stop_loss, take_profit = entry - risk, entry + risk * DEFAULT_RISK_REWARD
    else:
        stop_loss, take_profit = entry + risk, entry - risk * DEFAULT_RISK_REWARD

    r = lambda v: round(v, pip_decimals)  # noqa: E731
    return r(entry), r(stop_loss), r(take_profit), DEFAULT_RISK_REWARD, None


def compute_signal(symbol: str, s5: TfSnapshot, s15: TfSnapshot, pip_decimals: int) -> SignalResponse:
    """Snapshot-уудаас бүрэн signal бүтэц гаргана (цэвэр функц)."""
    results: list[RuleResult] = [
        evaluate_trend_15m(s15),
        evaluate_ema(s15),
        evaluate_rsi(s15),
        evaluate_macd(s15),
        evaluate_support_resistance(s15),
        evaluate_confirm_5m(s5, s15),
    ]
    scores, reasons, warnings = _aggregate(results)
    direction = _decide(scores)
    entry, stop_loss, take_profit, risk_reward, plan_warning = _trade_plan(direction, s5, pip_decimals)

    if plan_warning:
        warnings.append(plan_warning)
        direction = SignalDirection.WAIT
        entry = stop_loss = take_profit = risk_reward = None

    warnings.append(BASE_WARNING)

    return SignalResponse(
        symbol=symbol,
        signal=direction,
        buy_score=scores.buy,
        sell_score=scores.sell,
        wait_score=scores.wait,
        confidence=max(scores.buy, scores.sell),
        entry=entry,
        stop_loss=stop_loss,
        take_profit=take_profit,
        risk_reward=risk_reward,
        timeframes={
            "5m": _to_analysis(s5),
            "15m": _to_analysis(s15),
        },
        reasons=reasons,
        warnings=warnings,
    )


def _to_analysis(s: TfSnapshot) -> TimeframeAnalysis:
    return TimeframeAnalysis(
        trend=s.trend,
        rsi=round(s.rsi, 1),
        macd=s.macd,
        ema20=round(s.ema20, 5),
        ema50=round(s.ema50, 5),
        atr=round(s.atr, 6),
        support=round(s.support, 5),
        resistance=round(s.resistance, 5),
    )

"""Technical indicator-ууд — цэвэр pandas функцууд (Step 3).

pandas-ta-ийн стандарт томьёонуудтай ижил (Wilder RSI/ATR, EMA, MACD 12/26/9),
гэхдээ гадаад хамааралгүйгээр бичигдсэн: pandas-ta нь numpy>=2 орчинд эвдрэлддэг
тул ижил математикийг pandas-аар шууд хэрэгжүүлэв. Функций бүр цэвэр бөгөөд
unit-тестэд шууд шалгагдана.

Багана: DataFrame нь open/high/low/close (float) багана, цагаар өсөх эрэмбэтэй.
"""

from __future__ import annotations

from dataclasses import dataclass

import pandas as pd

from app.schemas.signal import MacdState, PriceActionState, TrendState

# ---------- тогтмолууд ----------

EMA_FAST = 20
EMA_SLOW = 50
RSI_PERIOD = 14
MACD_FAST = 12
MACD_SLOW = 26
MACD_SIGNAL = 9
ATR_PERIOD = 14
SR_LOOKBACK = 50  # support/resistance хайх сүүлийн лааны тоо
REACTION_BAND = 0.25  # S/R range-ийн 25%-д "орчим" гэж үзнэ


def ema_series(close: pd.Series, period: int) -> pd.Series:
    """Exponential Moving Average (adjust=False — pandas-ta-тай ижил)."""
    return close.ewm(span=period, adjust=False).mean()


def rsi_series(close: pd.Series, period: int = RSI_PERIOD) -> pd.Series:
    """Wilder-ийн RSI. Эхний `period` утга NaN байна."""
    delta = close.diff()
    gain = delta.clip(lower=0.0)
    loss = -delta.clip(upper=0.0)
    avg_gain = gain.ewm(alpha=1.0 / period, adjust=False).mean()
    avg_loss = loss.ewm(alpha=1.0 / period, adjust=False).mean()
    rs = avg_gain / avg_loss.replace(0.0, pd.NA)
    rsi = 100.0 - (100.0 / (1.0 + rs))
    # алдагдал огт байхгүй үед RSI = 100
    return rsi.fillna(100.0).clip(0.0, 100.0)


def macd_series(close: pd.Series) -> tuple[pd.Series, pd.Series, pd.Series]:
    """MACD(12, 26, 9) → (macd, signal, histogram)."""
    macd = ema_series(close, MACD_FAST) - ema_series(close, MACD_SLOW)
    signal = macd.ewm(span=MACD_SIGNAL, adjust=False).mean()
    return macd, signal, macd - signal


def atr_series(df: pd.DataFrame, period: int = ATR_PERIOD) -> pd.Series:
    """Wilder-ийн ATR."""
    prev_close = df["close"].shift(1)
    tr = pd.concat(
        [
            df["high"] - df["low"],
            (df["high"] - prev_close).abs(),
            (df["low"] - prev_close).abs(),
        ],
        axis=1,
    ).max(axis=1)
    return tr.ewm(alpha=1.0 / period, adjust=False).mean()


def support_resistance(df: pd.DataFrame, lookback: int = SR_LOOKBACK) -> tuple[float, float]:
    """Сүүлийн `lookback` лааны low-ийн минимум / high-ийн максимум."""
    window = df.tail(max(lookback, 2))
    return float(window["low"].min()), float(window["high"].max())


def price_action(df: pd.DataFrame, support: float, resistance: float) -> PriceActionState:
    """Сүүлийн лааны S/R орчим дахь урвал.

    Support орчимд (range-ийн доод 25%) bullish лаан + урт доод сүүдэл →
    BULLISH_REACTION; эсрэг тохиолдолд BEARISH_REACTION.
    """
    last = df.iloc[-1]
    rng = resistance - support
    if rng <= 0:
        return PriceActionState.NEUTRAL
    position = (float(last["close"]) - support) / rng

    o, h, l, c = float(last["open"]), float(last["high"]), float(last["low"]), float(last["close"])
    body = abs(c - o)
    lower_wick = min(o, c) - l
    upper_wick = h - max(o, c)

    if position <= REACTION_BAND and c > o and lower_wick >= body:
        return PriceActionState.BULLISH_REACTION
    if position >= 1.0 - REACTION_BAND and c < o and upper_wick >= body:
        return PriceActionState.BEARISH_REACTION
    return PriceActionState.NEUTRAL


def trend_state(ema20: float, ema50: float, close: float) -> TrendState:
    """EMA20 > EMA50 ба үнэ EMA50-аас дээш → BULLISH (эсрэгээр BEARISH)."""
    if ema20 > ema50 and close > ema50:
        return TrendState.BULLISH
    if ema20 < ema50 and close < ema50:
        return TrendState.BEARISH
    return TrendState.NEUTRAL


def macd_state(histogram: float) -> MacdState:
    if histogram > 0:
        return MacdState.BULLISH
    if histogram < 0:
        return MacdState.BEARISH
    return MacdState.NEUTRAL


@dataclass(frozen=True)
class TfSnapshot:
    """Нэг timeframe-ийн бүх indicator-ийн сүүлийн утгууд."""

    close: float
    ema20: float
    ema50: float
    rsi: float
    macd_hist: float
    atr: float
    support: float
    resistance: float
    trend: TrendState
    macd: MacdState
    price_action: PriceActionState


def compute_snapshot(df: pd.DataFrame) -> TfSnapshot:
    """DataFrame (open/high/low/close, өсөх эрэмбэ) → TfSnapshot.

    Хамгийн багадаа `EMA_SLOW + 5` лаан шаардлагатай — үгүй бол ValueError.
    """
    min_rows = EMA_SLOW + 5
    if len(df) < min_rows:
        raise ValueError(f"Indicator тооцоход хангалтгүй лаан: {len(df)} < {min_rows}")

    close: pd.Series = df["close"]
    ema20 = float(ema_series(close, EMA_FAST).iloc[-1])
    ema50 = float(ema_series(close, EMA_SLOW).iloc[-1])
    rsi = float(rsi_series(close, RSI_PERIOD).iloc[-1])
    _, _, hist = macd_series(close)
    macd_hist = float(hist.iloc[-1])
    atr = float(atr_series(df, ATR_PERIOD).iloc[-1])
    support, resistance = support_resistance(df)
    last_close = float(close.iloc[-1])

    return TfSnapshot(
        close=last_close,
        ema20=ema20,
        ema50=ema50,
        rsi=rsi,
        macd_hist=macd_hist,
        atr=atr,
        support=support,
        resistance=resistance,
        trend=trend_state(ema20, ema50, last_close),
        macd=macd_state(macd_hist),
        price_action=price_action(df, support, resistance),
    )

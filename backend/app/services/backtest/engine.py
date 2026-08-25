"""Deterministic backtest engine (Step 6).

Гол зарчим:
  • Signal logic нь production `scoring.compute_signal`-ийг ШУУД дуудна — ямар ч
    тусдаа алгоритм байхгүй. Indicator-ууд нь `indicators` модулийн цэвэр функцууд.
  • LOOK-AHEAD BIAS-гүй: i-р 5M лааны signal нь зөвхөн ≤ i өгөгдөл ашиглана;
    15M snapshot нь тухайн 5M лаа хаагдах мөчид БҮРЭН хаагдсан 15M лаануудаас бүрдэнэ;
    trade нь signal-ийн ДАРААГИЙН лааны нээлтээс эхэлнэ.
  • Нэг candle дээр SL ба TP хоёулаа хүрсэн бол CONSERVATIVE → SL (LOSS).
  • Spread / slippage / risk% нь тохируулагдах config; hardcoded үнэ байхгүй.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import datetime, timedelta

import numpy as np
import pandas as pd

from app.schemas.backtest import (
    BacktestSummary,
    EquityPoint,
    TradeRecord,
    TradeResultState,
)
from app.schemas.signal import SignalDirection
from app.services.analysis import indicators as ind
from app.services.analysis.indicators import TfSnapshot
from app.services.analysis import scoring
from app.services.analysis.scoring import ATR_SL_MULTIPLIER, DEFAULT_RISK_REWARD

logger = logging.getLogger("forex_analyzer.backtest")

WARMUP: int = ind.EMA_SLOW + 5  # = 55 — production compute_snapshot-ийн доод хэмжээ


@dataclass(frozen=True)
class BacktestConfig:
    """Backtest-ийн тохируулга (hardcoded биш, request-ээс ирнэ)."""

    symbol: str
    pip_decimals: int
    initial_balance: float
    risk_per_trade: float  # хувиар (1.0 = 1%)
    spread: float  # үнээр (price units)
    slippage: float  # үнээр (price units)
    trade_start: datetime  # энэ мөчөөс өмнөх signal trade нээхгүй


@dataclass
class BacktestOutcome:
    """Engine-ийн гаралт (service нь Pydantic response болгоно)."""

    trades: list[TradeRecord]
    equity_curve: list[EquityPoint]
    summary: BacktestSummary


def _to_df(candles: list) -> pd.DataFrame:
    """Candle жагсаалтыг DataFrame болгоно (цагаар эрэмбэлэгдсэн гэж үзнэ)."""
    df = pd.DataFrame(
        [
            {
                "ts": c.timestamp,
                "open": c.open,
                "high": c.high,
                "low": c.low,
                "close": c.close,
            }
            for c in candles
        ]
    )
    return df.sort_values("ts").reset_index(drop=True)


def _snapshot_at(
    df: pd.DataFrame,
    i: int,
    ema20: np.ndarray,
    ema50: np.ndarray,
    rsi: np.ndarray,
    macd_hist: np.ndarray,
    atr: np.ndarray,
    support: np.ndarray,
    resistance: np.ndarray,
) -> TfSnapshot:
    """i-р лааны indicator snapshot — production функцуудыг давтан ашиглана."""
    close = float(df["close"].iloc[i])
    row = df.iloc[[i]]  # price_action нь сүүлийн лааг ашигладаг тул 1-мөр df
    return TfSnapshot(
        close=close,
        ema20=float(ema20[i]),
        ema50=float(ema50[i]),
        rsi=float(rsi[i]),
        macd_hist=float(macd_hist[i]),
        atr=float(atr[i]),
        support=float(support[i]),
        resistance=float(resistance[i]),
        trend=ind.trend_state(float(ema20[i]), float(ema50[i]), close),
        macd=ind.macd_state(float(macd_hist[i])),
        price_action=ind.price_action(row, float(support[i]), float(resistance[i])),
    )


def _precompute(df: pd.DataFrame) -> dict[str, np.ndarray]:
    """Indicator цуваануудыг НЭГ удаа бодно (бүгд causal — ирээдүй ашиглахгүй)."""
    close = df["close"]
    _, _, hist = ind.macd_series(close)
    return {
        "ema20": ind.ema_series(close, ind.EMA_FAST).to_numpy(),
        "ema50": ind.ema_series(close, ind.EMA_SLOW).to_numpy(),
        "rsi": ind.rsi_series(close, ind.RSI_PERIOD).to_numpy(),
        "macd_hist": hist.to_numpy(),
        "atr": ind.atr_series(df, ind.ATR_PERIOD).to_numpy(),
        "support": df["low"].rolling(ind.SR_LOOKBACK, min_periods=2).min().to_numpy(),
        "resistance": df["high"].rolling(ind.SR_LOOKBACK, min_periods=2).max().to_numpy(),
    }


def run_backtest(candles_5m: list, candles_15m: list, cfg: BacktestConfig) -> BacktestOutcome:
    """Walk-forward backtest. Trade логик нь production signal engine дээр суурилна."""
    df5 = _to_df(candles_5m)
    df15 = _to_df(candles_15m)

    if len(df5) < WARMUP + 2 or len(df15) < WARMUP + 1:
        from app.core.errors import InsufficientDataError

        raise InsufficientDataError(
            f"Backtest-д хангалтгүй лаан: 5m={len(df5)}, 15m={len(df15)} (доод хэмжээ {WARMUP})"
        )

    ind5 = _precompute(df5)
    ind15 = _precompute(df15)

    # 15M лааны хаагдах мөч (ts + 15мин) — look-ahead-гүй харгалзааг хайхад
    interval5 = int((df5["ts"].iloc[1] - df5["ts"].iloc[0]).total_seconds())
    interval15 = int((df15["ts"].iloc[1] - df15["ts"].iloc[0]).total_seconds())
    ts5 = pd.to_datetime(df5["ts"])
    ts15_close = (pd.to_datetime(df15["ts"]) + pd.Timedelta(seconds=interval15)).to_numpy()
    ts5_close = (ts5 + pd.Timedelta(seconds=interval5)).to_numpy()
    ts15_close_sorted = np.sort(ts15_close)

    risk_pct = cfg.risk_per_trade / 100.0
    equity = cfg.initial_balance
    trades: list[TradeRecord] = []
    equity_curve: list[EquityPoint] = [
        EquityPoint(time=ts5.iloc[0].to_pydatetime(), equity=round(equity, 2))
    ]

    wait_count = 0
    i = WARMUP  # 5M индекс (warmup-аас эхэлнэ)
    n5 = len(df5)

    while i < n5 - 1:  # -1: entry нь дараагийн лааны нээлт тул сүүлийн лаанд signal боломжгүй
        close_time = pd.Timestamp(ts5_close[i])

        # 15M snapshot: i-р 5M лаа хаагдах мөчид БҮРЭН хаагдсан сүүлийн 15M лаа
        j = int(np.searchsorted(ts15_close_sorted, ts5_close[i], side="right")) - 1
        if j < WARMUP:
            i += 1
            continue

        s5 = _snapshot_at(df5, i, ind5["ema20"], ind5["ema50"], ind5["rsi"], ind5["macd_hist"], ind5["atr"], ind5["support"], ind5["resistance"])
        s15 = _snapshot_at(df15, j, ind15["ema20"], ind15["ema50"], ind15["rsi"], ind15["macd_hist"], ind15["atr"], ind15["support"], ind15["resistance"])

        # PRODUCTION signal engine — яг ижил логик
        signal = scoring.compute_signal(cfg.symbol, s5, s15, cfg.pip_decimals)

        # Худалдааны цонх: зөвхөн trade_start-аас хойшхи signal trade нээнэ
        in_window = close_time.to_pydatetime() >= cfg.trade_start  # pd.Timestamp → datetime

        if signal.signal is SignalDirection.WAIT:
            if in_window:
                wait_count += 1
            i += 1
            continue

        if not in_window:
            i += 1
            continue

        # --- Trade нээх: ДАРААГИЙН лааны нээлт (look-ahead-гүй) ---
        entry_idx = i + 1
        mid_open = float(df5["open"].iloc[entry_idx])
        is_buy = signal.signal is SignalDirection.BUY
        if is_buy:
            entry_price = mid_open + cfg.spread / 2 + cfg.slippage
        else:
            entry_price = mid_open - cfg.spread / 2 - cfg.slippage

        # Production ATR-based risk sizing (SL = ATR × 1.5) ба 1:2 RR
        risk_dist = s5.atr * ATR_SL_MULTIPLIER
        if risk_dist <= 0 or equity <= 0:
            i += 1
            continue
        if is_buy:
            sl = entry_price - risk_dist
            tp = entry_price + risk_dist * DEFAULT_RISK_REWARD
        else:
            sl = entry_price + risk_dist
            tp = entry_price - risk_dist * DEFAULT_RISK_REWARD

        risk_amount = equity * risk_pct
        units = risk_amount / risk_dist
        entry_time = ts5.iloc[entry_idx].to_pydatetime()

        # --- Trade-ийг цааш нь симуляци (SL/TP хүртэл) ---
        result: TradeResultState = TradeResultState.OPEN
        exit_price: float | None = None
        exit_time: datetime | None = None
        exit_k = n5 - 1  # хаагдсан лааны индекс (OPEN үед сүүлийн лаа)

        for k in range(entry_idx, n5):
            high = float(df5["high"].iloc[k])
            low = float(df5["low"].iloc[k])
            if is_buy:
                hit_sl = low <= sl
                hit_tp = high >= tp
            else:
                hit_sl = high >= sl
                hit_tp = low <= tp

            if hit_sl and hit_tp:
                # Нэг candle дээр хоёулаа → CONSERVATIVE: SL (LOSS)
                hit_tp = False

            if hit_sl:
                result = TradeResultState.LOSS
                exit_price = sl
                exit_time = (ts5.iloc[k] + pd.Timedelta(seconds=interval5)).to_pydatetime()
                exit_k = k
                break
            if hit_tp:
                result = TradeResultState.WIN
                exit_price = tp
                exit_time = (ts5.iloc[k] + pd.Timedelta(seconds=interval5)).to_pydatetime()
                exit_k = k
                break

        # P/L тооцоо
        if result is TradeResultState.OPEN:
            last_close = float(df5["close"].iloc[n5 - 1])
            pnl = (last_close - entry_price) * units if is_buy else (entry_price - last_close) * units
        else:
            pnl = (exit_price - entry_price) * units if is_buy else (entry_price - exit_price) * units
        pnl = round(pnl, 2)

        trades.append(
            TradeRecord(
                symbol=cfg.symbol,
                signal=SignalDirection.BUY if is_buy else SignalDirection.SELL,
                entry=round(entry_price, cfg.pip_decimals),
                stop_loss=round(sl, cfg.pip_decimals),
                take_profit=round(tp, cfg.pip_decimals),
                risk_reward=DEFAULT_RISK_REWARD,
                entry_time=entry_time,
                exit_time=exit_time,
                exit_price=round(exit_price, cfg.pip_decimals) if exit_price is not None else None,
                result=result,
                pnl=pnl,
                pnl_pct=round(pnl / cfg.initial_balance * 100, 3),
            )
        )

        if result is not TradeResultState.OPEN:
            equity = round(equity + pnl, 2)
            equity_curve.append(EquityPoint(time=exit_time, equity=equity))  # type: ignore[arg-type]
            i = exit_k + 1  # trade хаагдсан лааны дараагаас үргэлжилнэ (давхар trade үгүй)
        else:
            i = n5  # OPEN trade — өгөгдөл дуустал нээлттэй, цааш signal үгүй

    summary = _build_summary(cfg, trades, equity_curve, wait_count, equity, df5, df15)
    logger.info(
        "backtest %s: %d trades (%d W / %d L / %d open), net %.2f",
        cfg.symbol, len(trades), summary.wins, summary.losses, summary.open_trades, summary.net_pnl,
    )
    return BacktestOutcome(trades=trades, equity_curve=equity_curve, summary=summary)


def _build_summary(
    cfg: BacktestConfig,
    trades: list[TradeRecord],
    equity_curve: list[EquityPoint],
    wait_count: int,
    final_equity: float,
    df5: pd.DataFrame,
    df15: pd.DataFrame,
) -> BacktestSummary:
    """Гүйцэтгэлийн үзүүлэлтүүдийг тооцоолно."""
    closed = [t for t in trades if t.result is not TradeResultState.OPEN]
    wins = [t for t in closed if t.result is TradeResultState.WIN]
    losses = [t for t in closed if t.result is TradeResultState.LOSS]
    open_trades = [t for t in trades if t.result is TradeResultState.OPEN]

    n_closed = len(closed)
    win_rate = len(wins) / n_closed * 100 if n_closed else 0.0
    loss_rate = len(losses) / n_closed * 100 if n_closed else 0.0

    gross_profit = sum(t.pnl for t in wins)
    gross_loss = abs(sum(t.pnl for t in losses))
    net_pnl = round(final_equity - cfg.initial_balance, 2)

    profit_factor: float | None = round(gross_profit / gross_loss, 2) if gross_loss > 0 else None

    avg_profit = round(gross_profit / len(wins), 2) if wins else 0.0
    avg_loss = round(-gross_loss / len(losses), 2) if losses else 0.0

    # Дундаж бодит R (pnl / risk_amount)
    risk_pct = cfg.risk_per_trade / 100.0
    r_values = [t.pnl / (cfg.initial_balance * risk_pct) for t in closed] if closed else []
    avg_rr = round(sum(r_values) / len(r_values), 2) if r_values else 0.0

    # Maximum drawdown (equity муруйгаас)
    max_dd = 0.0
    peak = cfg.initial_balance
    for pt in equity_curve:
        peak = max(peak, pt.equity)
        if peak > 0:
            dd = (peak - pt.equity) / peak * 100
            max_dd = max(max_dd, dd)

    buy_trades = [t for t in closed if t.signal is SignalDirection.BUY]
    sell_trades = [t for t in closed if t.signal is SignalDirection.SELL]
    buy_wins = sum(1 for t in buy_trades if t.result is TradeResultState.WIN)
    sell_wins = sum(1 for t in sell_trades if t.result is TradeResultState.WIN)

    return BacktestSummary(
        total_trades=len(trades),
        wins=len(wins),
        losses=len(losses),
        open_trades=len(open_trades),
        win_rate=round(win_rate, 1),
        loss_rate=round(loss_rate, 1),
        net_pnl=net_pnl,
        avg_profit=avg_profit,
        avg_loss=avg_loss,
        profit_factor=profit_factor,
        max_drawdown_pct=round(max_dd, 2),
        avg_risk_reward=avg_rr,
        long_trades=len(buy_trades) + sum(1 for t in open_trades if t.signal is SignalDirection.BUY),
        short_trades=len(sell_trades) + sum(1 for t in open_trades if t.signal is SignalDirection.SELL),
        buy_win_rate=round(buy_wins / len(buy_trades) * 100, 1) if buy_trades else 0.0,
        sell_win_rate=round(sell_wins / len(sell_trades) * 100, 1) if sell_trades else 0.0,
        wait_count=wait_count,
        initial_balance=cfg.initial_balance,
        final_balance=final_equity,
        data_start=df5["ts"].iloc[0].to_pydatetime(),
        data_end=df5["ts"].iloc[-1].to_pydatetime(),
        candles_5m=len(df5),
        candles_15m=len(df15),
        spread_used=round(cfg.spread, cfg.pip_decimals),
        slippage_used=round(cfg.slippage, cfg.pip_decimals),
    )

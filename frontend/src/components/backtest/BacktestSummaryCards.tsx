"use client";

/**
 * Backtest-ийн гол үзүүлэлтүүдийн картууд (Step 6).
 * Бүх тоо backend-ийн summary-аас ирнэ — frontend тооцоолохгүй.
 */
import type { ReactNode } from "react";
import type { BacktestSummary } from "@/lib/backtest";
import { formatMoney } from "@/lib/backtest";

function Stat({
  label,
  value,
  cls = "text-mist",
  sub,
}: {
  label: string;
  value: string;
  cls?: string;
  sub?: string;
}): ReactNode {
  return (
    <div className="rounded-md border border-line bg-panel/60 p-4">
      <p className="font-mono text-[10.5px] uppercase tracking-wider text-dim">{label}</p>
      <p className={`mt-1.5 font-display text-xl font-bold ${cls}`}>{value}</p>
      {sub && <p className="mt-0.5 font-mono text-[11px] text-dim">{sub}</p>}
    </div>
  );
}

export function BacktestSummaryCards({ s }: { s: BacktestSummary }): ReactNode {
  const pnlCls = s.net_pnl >= 0 ? "text-buy" : "text-sell";
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      <Stat label="Total Trades" value={String(s.total_trades)} sub={`${s.wins} W / ${s.losses} L / ${s.open_trades} open`} />
      <Stat
        label="Win Rate"
        value={`${s.win_rate}%`}
        cls={s.win_rate >= 50 ? "text-buy" : "text-wait"}
        sub={`loss ${s.loss_rate}%`}
      />
      <Stat
        label="Profit Factor"
        value={s.profit_factor === null ? "∞" : s.profit_factor.toFixed(2)}
        cls={s.profit_factor === null || s.profit_factor >= 1 ? "text-buy" : "text-sell"}
      />
      <Stat label="Max Drawdown" value={`${s.max_drawdown_pct}%`} cls="text-sell" />
      <Stat
        label="Net P/L"
        value={formatMoney(s.net_pnl)}
        cls={pnlCls}
        sub={`${formatMoney(s.initial_balance)} → ${formatMoney(s.final_balance)}`}
      />
      <Stat label="Avg Profit" value={formatMoney(s.avg_profit)} cls="text-buy" />
      <Stat label="Avg Loss" value={formatMoney(s.avg_loss)} cls="text-sell" />
      <Stat label="Avg R:R" value={`1:${s.avg_risk_reward.toFixed(2)}`} cls="text-cy" />
      <Stat label="Long / Short" value={`${s.long_trades} / ${s.short_trades}`} sub={`BUY WR ${s.buy_win_rate}% · SELL WR ${s.sell_win_rate}%`} />
      <Stat label="WAIT signals" value={String(s.wait_count)} cls="text-wait" sub={`${s.candles_5m}×5m · ${s.candles_15m}×15m`} />
    </div>
  );
}

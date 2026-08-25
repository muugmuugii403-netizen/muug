/**
 * Backtest client — POST /api/backtest (backend/app/schemas/backtest.py-тай 1:1).
 *
 * Чухал: backtest нь зөвхөн түүхэн өгөгдөл + technical indicator + deterministic
 * signal engine ашиглана. Qwen AI энд огт дуудагдахгүй.
 */
import { apiFetch, API_BASE_URL } from "./api";

/** /api/v1 → /api (backtest нь forex/v1 доор биш, /api доор) */
const API_ROOT: string = API_BASE_URL.replace(/\/v1\/?$/, "");

export type TradeResultState = "WIN" | "LOSS" | "OPEN";
export type BacktestSignal = "BUY" | "SELL";

export interface BacktestRequest {
  symbol: string;
  start_date: string; // YYYY-MM-DD
  end_date: string; // YYYY-MM-DD
  initial_balance: number;
  risk_per_trade: number; // хувиар
  slippage_pips: number;
  spread_pips: number | null; // null = pair-ийн typical spread
}

export interface TradeRecord {
  symbol: string;
  signal: BacktestSignal;
  entry: number;
  stop_loss: number;
  take_profit: number;
  risk_reward: number;
  entry_time: string;
  exit_time: string | null;
  exit_price: number | null;
  result: TradeResultState;
  pnl: number;
  pnl_pct: number;
}

export interface EquityPoint {
  time: string;
  equity: number;
}

export interface BacktestSummary {
  total_trades: number;
  wins: number;
  losses: number;
  open_trades: number;
  win_rate: number;
  loss_rate: number;
  net_pnl: number;
  avg_profit: number;
  avg_loss: number;
  profit_factor: number | null;
  max_drawdown_pct: number;
  avg_risk_reward: number;
  long_trades: number;
  short_trades: number;
  buy_win_rate: number;
  sell_win_rate: number;
  wait_count: number;
  initial_balance: number;
  final_balance: number;
  data_start: string;
  data_end: string;
  candles_5m: number;
  candles_15m: number;
  spread_used: number;
  slippage_used: number;
}

export interface BacktestResponse {
  summary: BacktestSummary;
  trades: TradeRecord[];
  equity_curve: EquityPoint[];
}

/** POST /api/backtest — backtest нь удаж магадгүй тул timeout урт, retry үгүй. */
export function runBacktest(req: BacktestRequest): Promise<BacktestResponse> {
  return apiFetch<BacktestResponse>("/backtest", {
    method: "POST",
    body: req,
    base: API_ROOT,
    timeoutMs: 60000,
    retries: 0,
  });
}

export function formatMoney(v: number): string {
  const sign = v > 0 ? "+" : v < 0 ? "−" : "";
  return `${sign}$${Math.abs(v).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

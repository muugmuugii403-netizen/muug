/**
 * Signal + AI analysis client — backend/app/schemas/signal.py · ai.py-тай 1:1.
 *
 * Чухал: signal нь backend-ийн deterministic engine-ээс ирнэ. AI (Qwen) зөвхөн
 * `explanation` (текст) талбарыг дүүргэдэг бөгөөд signal/оноо/үнэд хэзээ ч
 * нөлөөлөхгүй. ai_status: ok | unavailable | disabled.
 */
import { apiFetch, FOREX_BASE_URL } from "./api";

export type SignalDirection = "BUY" | "SELL" | "WAIT";
export type TrendState = "BULLISH" | "BEARISH" | "NEUTRAL";
export type AiStatus = "ok" | "unavailable" | "disabled";

export interface TimeframeAnalysis {
  trend: TrendState;
  rsi: number;
  macd: TrendState;
  ema20: number;
  ema50: number;
  atr: number;
  support: number;
  resistance: number;
}

export interface SignalResponse {
  symbol: string;
  signal: SignalDirection;
  buy_score: number;
  sell_score: number;
  wait_score: number;
  confidence: number;
  entry: number | null;
  stop_loss: number | null;
  take_profit: number | null;
  risk_reward: number | null;
  timeframes: { "5m": TimeframeAnalysis; "15m": TimeframeAnalysis };
  reasons: string[];
  warnings: string[];
}

export interface AiExplanation {
  summary: string;
  signal_explanation: string;
  market_context: string;
  technical_reasons: string[];
  risk_analysis: string;
  entry_explanation: string;
  stop_loss_explanation: string;
  take_profit_explanation: string;
  warnings: string[];
}

export interface AnalysisResponse {
  signal: SignalResponse;
  explanation: AiExplanation | null;
  ai_status: AiStatus;
  ai_message: string;
}

/** GET /api/forex/signal/{symbol} — зөвхөн deterministic signal */
export function getSignal(symbol: string): Promise<SignalResponse> {
  return apiFetch<SignalResponse>(`/signal/${encodeURIComponent(symbol)}`, {
    base: FOREX_BASE_URL,
    timeoutMs: 12000,
    retries: 1,
  });
}

/** GET /api/forex/analysis/{symbol} — signal + Монгол AI тайлбар */
export function getAnalysis(symbol: string): Promise<AnalysisResponse> {
  return apiFetch<AnalysisResponse>(`/analysis/${encodeURIComponent(symbol)}`, {
    base: FOREX_BASE_URL,
    timeoutMs: 30000, // AI дуудлага удаж болзох тул
    retries: 0,
  });
}

/** Төрөл бүрийн signal-д тохирох өнгө/тэмдэг (UI consistency). */
export const SIGNAL_META: Record<SignalDirection, { emoji: string; label: string; cls: string; border: string }> = {
  BUY: { emoji: "🟢", label: "BUY", cls: "text-buy", border: "border-buy/50 bg-buy/10" },
  SELL: { emoji: "🔴", label: "SELL", cls: "text-sell", border: "border-sell/50 bg-sell/10" },
  WAIT: { emoji: "🟡", label: "WAIT", cls: "text-wait", border: "border-wait/50 bg-wait/10" },
};

export function formatPrice(value: number | null, decimals = 5): string {
  return value === null ? "—" : value.toFixed(decimals);
}

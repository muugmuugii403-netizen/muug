/**
 * Market data client — GET /api/forex/quote · /api/forex/candles.
 *
 * Төрлүүд нь backend/app/schemas/market.py-тай 1:1 тохирно.
 * Pair жагсаалт нь backend/app/services/market_data/symbols.py-ийн mirror —
 * шинэ pair нэмэхэд ТУС БҮРД нь шинэчилнэ (server үргэлж эцсийн шалгуур).
 */
import { apiFetch, FOREX_BASE_URL } from "./api";

export type Interval = "5min" | "15min";
export type DataSource = "twelvedata" | "sample";

export interface ForexPairInfo {
  symbol: string;
  name: string;
  pipDecimals: number;
}

/**
 * Дэмжигдэх 8 instrument — backend registry-ийн mirror
 * (backend/app/services/market_data/symbols.py — цорын ганц эх сурвалж;
 * шинэ instrument нэмэхэд ТУС БҮРД нь шинэчилнэ).
 */
export const FOREX_PAIRS: ForexPairInfo[] = [
  { symbol: "EUR/USD", name: "Euro / US Dollar", pipDecimals: 5 },
  { symbol: "GBP/USD", name: "British Pound / US Dollar", pipDecimals: 5 },
  { symbol: "USD/JPY", name: "US Dollar / Japanese Yen", pipDecimals: 3 },
  { symbol: "AUD/USD", name: "Australian Dollar / US Dollar", pipDecimals: 5 },
  { symbol: "USD/CAD", name: "US Dollar / Canadian Dollar", pipDecimals: 5 },
  { symbol: "USD/CHF", name: "US Dollar / Swiss Franc", pipDecimals: 5 },
  { symbol: "NZD/USD", name: "New Zealand Dollar / US Dollar", pipDecimals: 5 },
  { symbol: "XAU/USD", name: "Gold / US Dollar", pipDecimals: 2 },
];

export interface Candle {
  timestamp: string; // ISO-8601 UTC
  open: number;
  high: number;
  low: number;
  close: number;
}

export interface CandlesResponse {
  symbol: string;
  interval: Interval;
  count: number;
  source: DataSource;
  candles: Candle[]; // цагаар өсөх эрэмбэтэй
}

export interface QuoteResponse {
  symbol: string;
  price: number;
  bid: number;
  ask: number;
  spread: number;
  timestamp: string;
  source: DataSource;
}

/** GET /api/forex/quote/{symbol} */
export function getQuote(symbol: string): Promise<QuoteResponse> {
  return apiFetch<QuoteResponse>(`/quote/${encodeURIComponent(symbol)}`, {
    base: FOREX_BASE_URL,
    timeoutMs: 6000,
    retries: 1,
  });
}

/** GET /api/forex/candles/{symbol}?interval=5min|15min&outputsize=N */
export function getCandles(symbol: string, interval: Interval, outputsize = 200): Promise<CandlesResponse> {
  return apiFetch<CandlesResponse>(
    `/candles/${encodeURIComponent(symbol)}?interval=${interval}&outputsize=${outputsize}`,
    { base: FOREX_BASE_URL, timeoutMs: 12000, retries: 1 },
  );
}

/**
 * Нэг pip-ийн үнэ — backend `pip_size()`-тай ижил дүрэм:
 * Gold → 0.10 · JPY pair → 0.01 · бусад → 0.0001.
 */
export function pipSize(symbol: string): number {
  if (symbol === "XAU/USD") return 0.1;
  return symbol.endsWith("/JPY") ? 0.01 : 0.0001;
}

/** Spread-ийг pip-ээр илэрхийлнэ. */
export function spreadInPips(symbol: string, spread: number): number {
  return spread / pipSize(symbol);
}

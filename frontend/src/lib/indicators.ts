/**
 * Display-only indicator helper — ЗӨВХӨН chart визуализацид.
 *
 * Чухал: BUY/SELL/WAIT шийдвэр, оноо, entry/SL/TP нь backend-ийн deterministic
 * engine-ээс ирдэг (AnalysisResponse.signal). Энд байгаа функцууд нь зөвхөн
 * график дээр EMA шугам зурах, market summary самбарт momentum/volatility
 * ангилал гаргахад хэрэглэгдэнэ — ямар ч худалдааны шийдвэр гаргахгүй.
 */
import type { Candle } from "./market";
import type { TimeframeAnalysis } from "./analysis";

/** Стандарт EMA цуваа (chart overlay). `values` цагаар өссөн эрэмбэтэй байна. */
export function emaSeries(values: number[], period: number): number[] {
  if (values.length === 0) return [];
  const k = 2 / (period + 1);
  const out: number[] = new Array(values.length).fill(Number.NaN);
  // Эхний `period` цэгийн дунджаар үүсгэнэ (SMA seed)
  let sum = 0;
  for (let i = 0; i < values.length; i += 1) {
    const v = values[i];
    if (i < period) {
      sum += v;
      if (i === period - 1) out[i] = sum / period;
    } else {
      const prev = out[i - 1];
      out[i] = v * k + prev * (1 - k);
    }
  }
  return out;
}

export type Momentum = "Хүчтэй" | "Дунд зэрэг" | "Сул";
export type Volatility = "Бага" | "Дунд" | "Өндөр";

/** Momentum ангилал — RSI дээр суурилна (backend-ийн тооцсон утга). */
export function classifyMomentum(rsi: number): Momentum {
  const dist = Math.abs(rsi - 50);
  if (dist >= 15) return "Хүчтэй";
  if (dist >= 7) return "Дунд зэрэг";
  return "Сул";
}

/** Volatility ангилал — ATR-ийг үнэтэй харьцуулсан хувиар (backend-ийн тооцсон ATR). */
export function classifyVolatility(atr: number, price: number): Volatility {
  if (price <= 0) return "Дунд";
  const pct = (atr / price) * 100;
  if (pct < 0.06) return "Бага";
  if (pct < 0.15) return "Дунд";
  return "Өндөр";
}

/** Trend-ийн монгол шошго. */
export function trendLabel(trend: TimeframeAnalysis["trend"]): string {
  if (trend === "BULLISH") return "Өсөх";
  if (trend === "BEARISH") return "Уруудах";
  return "Хэвтээ";
}

export function macdLabel(macd: TimeframeAnalysis["macd"]): string {
  if (macd === "BULLISH") return "Өсөх";
  if (macd === "BEARISH") return "Уруудах";
  return "Төвийг сахисан";
}

/** Лааны close-уудыг тусгаарлана. */
export function closesOf(candles: Candle[]): number[] {
  return candles.map((c) => c.close);
}

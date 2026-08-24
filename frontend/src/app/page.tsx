"use client";

/**
 * Market Data хуудас (Step 2).
 *
 * Зөвхөн өгөгдлийн давхарга: pair сонгох → 5M/15M сонгох → candles + quote
 * авах → chart + үнийн самбар. RSI/MACD/EMA/Signal/AI — дараагийн алхамууд.
 */
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { CandleChart } from "@/components/CandleChart";
import { QuotePanel } from "@/components/QuotePanel";
import { ApiError } from "@/lib/api";
import {
  FOREX_PAIRS,
  getCandles,
  getQuote,
  type CandlesResponse,
  type Interval,
  type QuoteResponse,
} from "@/lib/market";

type Loadable<T> =
  | { status: "loading" }
  | { status: "ok"; data: T }
  | { status: "error"; message: string };

const msgOf = (e: unknown): string => (e instanceof ApiError ? e.message : "Тодорхойгүй алдаа гарлаа");

export default function MarketDataPage(): ReactNode {
  const [symbol, setSymbol] = useState("EUR/USD");
  const [interval, setInterval] = useState<Interval>("5min");
  const [candles, setCandles] = useState<Loadable<CandlesResponse>>({ status: "loading" });
  const [quote, setQuote] = useState<Loadable<QuoteResponse>>({ status: "loading" });
  const [autoRefresh, setAutoRefresh] = useState(true);

  const pair = FOREX_PAIRS.find((p) => p.symbol === symbol) ?? FOREX_PAIRS[0];
  const candleReq = useRef(0);
  const quoteReq = useRef(0);

  const loadCandles = useCallback(
    async (sym: string, tf: Interval): Promise<void> => {
      const id = ++candleReq.current;
      setCandles({ status: "loading" });
      try {
        const data = await getCandles(sym, tf, 200);
        if (id === candleReq.current) setCandles({ status: "ok", data });
      } catch (e) {
        if (id === candleReq.current) setCandles({ status: "error", message: msgOf(e) });
      }
    },
    [],
  );

  const loadQuote = useCallback(async (sym: string): Promise<void> => {
    const id = ++quoteReq.current;
    setQuote((prev) => (prev.status === "ok" ? prev : { status: "loading" }));
    try {
      const data = await getQuote(sym);
      if (id === quoteReq.current) setQuote({ status: "ok", data });
    } catch (e) {
      if (id === quoteReq.current) setQuote({ status: "error", message: msgOf(e) });
    }
  }, []);

  // pair / interval солигдох бүр candles + quote шинэчилнэ
  useEffect(() => {
    void loadCandles(symbol, interval);
    void loadQuote(symbol);
  }, [symbol, interval, loadCandles, loadQuote]);

  // auto-refresh: 20с тутам quote (backend TTL cache credit-ийг хамгаална)
  useEffect(() => {
    if (!autoRefresh) return;
    const id = window.setInterval(() => void loadQuote(symbol), 20_000);
    return () => window.clearInterval(id);
  }, [autoRefresh, symbol, loadQuote]);

  return (
    <main className="mx-auto w-full max-w-6xl px-5 py-10 sm:px-8">
      {/* header */}
      <header className="flex flex-wrap items-end justify-between gap-3 border-b border-line pb-6">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-cy">Forex Analyzer</p>
          <h1 className="font-display mt-1 text-2xl font-bold text-mist sm:text-[28px]">Market Data</h1>
        </div>
        <div className="flex items-center gap-2 font-mono text-[11.5px] text-dim">
          <span className="rounded-sm border border-line px-2.5 py-1">
            GET <span className="text-fog">/api/forex/quote</span>
          </span>
          <span className="rounded-sm border border-line px-2.5 py-1">
            GET <span className="text-fog">/api/forex/candles</span>
          </span>
        </div>
      </header>

      {/* selector */}
      <div className="mt-6 flex flex-wrap items-center gap-x-8 gap-y-4">
        <div className="flex flex-wrap gap-2">
          {FOREX_PAIRS.map((p) => (
            <button
              key={p.symbol}
              type="button"
              onClick={() => setSymbol(p.symbol)}
              title={p.name}
              className={`rounded-sm border px-3.5 py-2 font-mono text-[13px] transition-all duration-150 ${
                p.symbol === symbol
                  ? "border-cy/60 bg-cy/10 text-mist shadow-[0_0_18px_-6px_rgba(69,214,228,0.55)]"
                  : "border-line text-fog hover:border-edge hover:text-mist"
              }`}
            >
              {p.symbol}
            </button>
          ))}
        </div>
        <div className="flex overflow-hidden rounded-sm border border-line">
          {(["5min", "15min"] as const).map((tf) => (
            <button
              key={tf}
              type="button"
              onClick={() => setInterval(tf)}
              className={`px-4 py-2 font-mono text-[13px] transition-colors ${
                interval === tf ? "bg-buy/15 text-buy" : "bg-panel text-dim hover:text-fog"
              }`}
            >
              {tf === "5min" ? "5M" : "15M"}
            </button>
          ))}
        </div>
      </div>

      {/* content */}
      <div className="mt-6 grid gap-6 lg:grid-cols-[320px_1fr]">
        <div className="space-y-4">
          <QuotePanel
            quote={quote.status === "ok" ? quote.data : null}
            pipDecimals={pair?.pipDecimals ?? 5}
            loading={quote.status === "loading"}
            error={quote.status === "error" ? quote.message : null}
            autoRefresh={autoRefresh}
            onToggleAuto={() => setAutoRefresh((v) => !v)}
            onRefresh={() => void loadQuote(symbol)}
          />

          <section className="rounded-md border border-line bg-panel/40 p-4 text-[12.5px] leading-relaxed text-dim">
            <p className="font-mono text-[10.5px] uppercase tracking-wider text-dim">Эх сурвалж</p>
            <ul className="mt-2 space-y-1.5">
              <li>
                <span className="text-buy">LIVE</span> — Twelve Data API (backend .env-ийн key, frontend-д хэзээ ч
                харагдахгүй)
              </li>
              <li>
                <span className="text-wait">SAMPLE</span> — key хоосон үеийн детерминист локал өгөгдөл
              </li>
              <li>Bid/ask нь mid price + pair-ийн typical spread-ээс тооцогдоно (Twelve Data quote bid/ask буцаадаггүй)</li>
              <li>Rate limit: 8 credit/мин — frontend 20с auto-refresh, backend TTL cache</li>
            </ul>
          </section>
        </div>

        {/* chart */}
        <section className="flex min-w-0 flex-col rounded-md border border-line bg-panel/60">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
            <p className="font-mono text-[12.5px] text-fog">
              <span className="text-mist">{symbol}</span> · {interval} ·{" "}
              {candles.status === "ok" ? `${candles.data.count} лаан` : "…"}
            </p>
            {candles.status === "ok" && (
              <span
                className={`rounded-sm border px-2 py-0.5 font-mono text-[10px] tracking-wider ${
                  candles.data.source === "sample" ? "border-wait/50 text-wait" : "border-buy/50 text-buy"
                }`}
              >
                {candles.data.source === "sample" ? "SAMPLE DATA" : "TWELVE DATA"}
              </span>
            )}
          </div>
          <div className="relative h-[440px] p-2">
            {candles.status === "loading" && (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-panel/40">
                <p className="animate-pulse font-mono text-[13px] text-fog">Лаануудыг ачаалж байна…</p>
              </div>
            )}
            {candles.status === "error" && (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-panel/60">
                <p className="max-w-sm px-6 text-center font-mono text-[12.5px] text-sell">✕ {candles.message}</p>
                <button
                  type="button"
                  onClick={() => void loadCandles(symbol, interval)}
                  className="rounded-sm border border-line px-4 py-2 font-mono text-[12px] text-fog transition-colors hover:border-edge hover:text-mist"
                >
                  ↻ Дахин оролдох
                </button>
              </div>
            )}
            {candles.status === "ok" ? (
              <CandleChart candles={candles.data.candles} />
            ) : (
              <div className="h-full w-full animate-pulse rounded-sm bg-panel2/50" />
            )}
          </div>
          <p className="border-t border-line px-4 py-2.5 font-mono text-[11px] text-dim">
            RSI · MACD · EMA · Support/Resistance · BUY/SELL signal — дараагийн алхамд нэмэгдэнэ
          </p>
        </section>
      </div>
    </main>
  );
}

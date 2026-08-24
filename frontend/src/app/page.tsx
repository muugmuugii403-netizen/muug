"use client";

/**
 * Forex AI Analyzer — нэг дэлгэцийн dashboard (Step 5).
 *
 * Бүтэц: Header → Pair/Timeframe → Market summary → Chart | Signal →
 * 5M/15M техникийн шинжилгээ → AI тайлбар.
 *
 * Архитектурын дараалал хэвээр: Forex API → FastAPI → Indicator → Signal
 * Engine → Qwen AI → Frontend. Frontend ямар ч BUY/SELL шийдвэр гаргахгүй,
 * зөвхөн backend-ийн хариуг харуулна.
 */
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { CandleChart } from "@/components/CandleChart";
import { DashboardHeader } from "@/components/DashboardHeader";
import { PairTimeframeSelector } from "@/components/PairTimeframeSelector";
import { MarketSummaryCard } from "@/components/MarketSummaryCard";
import { SignalPanel } from "@/components/SignalPanel";
import { TfAnalysisCard } from "@/components/TfAnalysisCard";
import { AnalysisPanel } from "@/components/AnalysisPanel";
import { ChartSkeleton, SignalSkeleton, TfCardSkeleton } from "@/components/Skeletons";
import { ApiError } from "@/lib/api";
import {
  FOREX_PAIRS,
  getCandles,
  getQuote,
  spreadInPips,
  type CandlesResponse,
  type Interval,
  type QuoteResponse,
} from "@/lib/market";
import { getAnalysis, type AnalysisResponse } from "@/lib/analysis";

type Loaded<T> = { status: "ok"; payload: T };
type Loading = { status: "loading" };
type Failed = { status: "error"; message: string };
type Loadable<T> = Loaded<T> | Loading | Failed;

const msgOf = (e: unknown): string => (e instanceof ApiError ? e.message : "Тодорхойгүй алдаа гарлаа");

const REFRESH_MS = 20_000; // market data auto-refresh (backend TTL cache credit-ийг хамгаална)

export default function DashboardPage(): ReactNode {
  const [symbol, setSymbol] = useState("EUR/USD");
  const [interval, setInterval] = useState<Interval>("5min");
  const [candles, setCandles] = useState<Loadable<CandlesResponse>>({ status: "loading" });
  const [quote, setQuote] = useState<Loadable<QuoteResponse>>({ status: "loading" });
  const [analysis, setAnalysis] = useState<Loadable<AnalysisResponse>>({ status: "loading" });
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [spin, setSpin] = useState(false);

  const pair = FOREX_PAIRS.find((p) => p.symbol === symbol) ?? FOREX_PAIRS[0];
  const decimals = pair?.pipDecimals ?? 5;

  // Хүсэлтийн дугаар: хуучирсан хариуг state-д бичихээс сэргийлнэ (race condition)
  const candleReq = useRef(0);
  const quoteReq = useRef(0);
  const analysisReq = useRef(0);
  const prevPrice = useRef<number | null>(null);
  const [priceDir, setPriceDir] = useState<"up" | "down" | null>(null);

  /* ---------- ачаалагч функцууд ---------- */

  const loadCandles = useCallback(async (sym: string, tf: Interval): Promise<void> => {
    const id = ++candleReq.current;
    setCandles({ status: "loading" });
    try {
      const data = await getCandles(sym, tf, 200);
      if (id !== candleReq.current) return;
      setCandles({ status: "ok", payload: data });
      setLastUpdate(new Date());
    } catch (e) {
      if (id === candleReq.current) setCandles({ status: "error", message: msgOf(e) });
    }
  }, []);

  const loadQuote = useCallback(async (sym: string): Promise<void> => {
    const id = ++quoteReq.current;
    setQuote((prev) => (prev.status === "ok" ? prev : { status: "loading" }));
    try {
      const data = await getQuote(sym);
      if (id !== quoteReq.current) return;
      const prev = prevPrice.current;
      if (prev !== null && data.price !== prev) setPriceDir(data.price > prev ? "up" : "down");
      prevPrice.current = data.price;
      setQuote({ status: "ok", payload: data });
      setLastUpdate(new Date());
    } catch (e) {
      if (id === quoteReq.current) setQuote({ status: "error", message: msgOf(e) });
    }
  }, []);

  // AI-г зөвхөн symbol солигдох үед дуудна (refresh бүр биш) — backend cache-тай
  const loadAnalysis = useCallback(async (sym: string): Promise<void> => {
    const id = ++analysisReq.current;
    setAnalysis({ status: "loading" });
    try {
      const data = await getAnalysis(sym);
      if (id === analysisReq.current) setAnalysis({ status: "ok", payload: data });
    } catch (e) {
      if (id === analysisReq.current) setAnalysis({ status: "error", message: msgOf(e) });
    }
  }, []);

  /* ---------- эффектүүд ---------- */

  // Pair / interval солигдох бүр chart + quote; pair солигдох бүр шинжилгээ
  useEffect(() => {
    void loadCandles(symbol, interval);
    void loadQuote(symbol);
  }, [symbol, interval, loadCandles, loadQuote]);

  useEffect(() => {
    prevPrice.current = null;
    void loadAnalysis(symbol);
  }, [symbol, loadAnalysis]);

  // Auto-refresh: зөвхөн market data (chart + quote). AI дахин дуудагдахгүй.
  useEffect(() => {
    const id = window.setInterval(() => {
      void loadCandles(symbol, interval);
      void loadQuote(symbol);
    }, REFRESH_MS);
    return () => window.clearInterval(id);
  }, [symbol, interval, loadCandles, loadQuote]);

  // Бүх мөрийг шинэчлэх (товчоор) — AI-г backend cache-аар дамжуулан дуудна
  const refreshAll = useCallback(async (): Promise<void> => {
    setSpin(true);
    await Promise.all([loadCandles(symbol, interval), loadQuote(symbol), loadAnalysis(symbol)]);
    setSpin(false);
  }, [symbol, interval, loadCandles, loadQuote, loadAnalysis]);

  /* ---------- утгууд ---------- */

  const price = quote.status === "ok" ? quote.payload.price : null;
  const spreadPips = quote.status === "ok" ? spreadInPips(symbol, quote.payload.spread) : null;

  return (
    <div className="min-h-screen bg-ink">
      <DashboardHeader lastUpdate={lastUpdate} onRefresh={() => void refreshAll()} refreshing={spin} />

      <main className="mx-auto w-full max-w-7xl px-5 py-6 sm:px-8">
        {/* Pair + timeframe */}
        <PairTimeframeSelector
          symbol={symbol}
          interval={interval}
          onSymbol={setSymbol}
          onInterval={setInterval}
        />

        {/* Market summary */}
        <div className="mt-5">
          {analysis.status === "ok" ? (
            <MarketSummaryCard signal={analysis.payload.signal} decimals={decimals} />
          ) : analysis.status === "loading" ? (
            <div className="h-[86px] animate-pulse rounded-md bg-panel2/50" />
          ) : null}
        </div>

        {/* Chart | Signal */}
        <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
          {/* Chart */}
          <section className="flex min-w-0 flex-col rounded-md border border-line bg-panel/60">
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-line px-4 py-3">
              <div className="flex items-baseline gap-3">
                <h2 className="font-mono text-[15px] font-bold text-mist">{symbol}</h2>
                <span className="font-mono text-[11px] uppercase tracking-wider text-dim">
                  {interval === "5min" ? "5 минут" : "15 минут"}
                </span>
                {candles.status === "ok" && (
                  <span
                    className={`rounded-sm border px-1.5 py-px font-mono text-[9.5px] tracking-wider ${
                      candles.payload.source === "sample" ? "border-wait/50 text-wait" : "border-buy/50 text-buy"
                    }`}
                  >
                    {candles.payload.source === "sample" ? "SAMPLE" : "LIVE"}
                  </span>
                )}
              </div>
              <div className="flex items-baseline gap-3">
                <span
                  className={`font-mono text-[22px] font-extrabold tabular-nums transition-colors duration-500 ${
                    priceDir === "up" ? "text-buy" : priceDir === "down" ? "text-sell" : "text-mist"
                  }`}
                >
                  {price !== null ? price.toFixed(decimals) : "—"}
                </span>
                {spreadPips !== null && (
                  <span className="font-mono text-[11px] text-dim">spread {spreadPips.toFixed(1)} pips</span>
                )}
              </div>
            </div>

            <div className="relative h-[420px] p-2">
              {candles.status === "loading" && (
                <div className="absolute inset-0 z-10">
                  <ChartSkeleton />
                </div>
              )}
              {candles.status === "error" && (
                <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-panel/70">
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
                <CandleChart candles={candles.payload.candles} />
              ) : (
                <div className="h-full w-full" />
              )}
            </div>

            <div className="flex flex-wrap items-center gap-x-5 gap-y-1 border-t border-line px-4 py-2.5 font-mono text-[11px] text-dim">
              <span className="flex items-center gap-1.5">
                <span className="h-0.5 w-4 rounded bg-cy" /> EMA 20
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-0.5 w-4 rounded bg-wait" /> EMA 50
              </span>
              <span className="ml-auto">zoom · pan · crosshair идэвхтэй</span>
            </div>
          </section>

          {/* Signal */}
          <aside className="min-w-0">
            {analysis.status === "loading" ? (
              <div className="rounded-md border border-line bg-panel/60">
                <SignalSkeleton />
              </div>
            ) : analysis.status === "error" ? (
              <div className="rounded-md border border-line bg-panel/60 p-5">
                <p className="font-mono text-[12.5px] text-sell">✕ {analysis.message}</p>
                <button
                  type="button"
                  onClick={() => void loadAnalysis(symbol)}
                  className="mt-3 rounded-sm border border-line px-4 py-2 font-mono text-[12px] text-fog transition-colors hover:border-edge hover:text-mist"
                >
                  ↻ Дахин оролдох
                </button>
              </div>
            ) : (
              <SignalPanel signal={analysis.payload.signal} decimals={decimals} />
            )}
          </aside>
        </div>

        {/* 5M / 15M техникийн шинжилгээ */}
        <div className="mt-5 grid gap-5 md:grid-cols-2">
          {analysis.status === "ok" ? (
            <>
              <TfAnalysisCard tf="5M" data={analysis.payload.signal.timeframes["5m"]} decimals={decimals} />
              <TfAnalysisCard tf="15M" data={analysis.payload.signal.timeframes["15m"]} decimals={decimals} />
            </>
          ) : analysis.status === "loading" ? (
            <>
              <div className="rounded-md border border-line bg-panel/60">
                <TfCardSkeleton />
              </div>
              <div className="rounded-md border border-line bg-panel/60">
                <TfCardSkeleton />
              </div>
            </>
          ) : null}
        </div>

        {/* AI тайлбар */}
        <div className="mt-5">
          {analysis.status === "loading" ? (
            <AnalysisPanel analysis={null} loading signal={null} />
          ) : analysis.status === "ok" ? (
            <AnalysisPanel
              analysis={analysis.payload}
              loading={false}
              signal={analysis.payload.signal.signal}
            />
          ) : (
            <div className="rounded-md border border-line bg-panel/60 p-5">
              <p className="font-mono text-[12.5px] text-sell">✕ Шинжилгээ авах боломжгүй: {analysis.message}</p>
              <p className="mt-1.5 text-[12.5px] leading-relaxed text-fog">
                Market data chart дээр хэвийн харагдаж байна. Шинжилгээг дахин оролдоно уу.
              </p>
              <button
                type="button"
                onClick={() => void loadAnalysis(symbol)}
                className="mt-3 rounded-sm border border-line px-4 py-2 font-mono text-[12px] text-fog transition-colors hover:border-edge hover:text-mist"
              >
                ↻ Дахин оролдох
              </button>
            </div>
          )}
        </div>

        {/* Хөл тайлбар */}
        <p className="mt-6 border-t border-line pt-4 text-center font-mono text-[10.5px] leading-relaxed text-dim">
          Signal нь зөвхөн техникийн indicator дээр суурилсан детерминист тооцоо бөгөөд баталгаатай ашиг амлахгүй.
          AI тайлбар нь signal-д нөлөөлдөггүй.
        </p>
      </main>
    </div>
  );
}

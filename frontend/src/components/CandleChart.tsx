"use client";

/**
 * Candlestick chart + EMA20/EMA50 overlay — TradingView Lightweight Charts v4.
 *
 * ЗӨВХӨН визуализаци: лаанууд backend-ийн /api/forex/candles-аас ирнэ. EMA
 * шугамууд нь зүгээр л график дээрх туслах зураас (display-only, signal биш).
 * Zoom/pan/crosshair нь Lightweight Charts-ийн built-in боломж юм.
 */
import { useEffect, useMemo, useRef, type ReactNode } from "react";
import { createChart, ColorType, type IChartApi, type UTCTimestamp } from "lightweight-charts";
import type { Candle } from "@/lib/market";
import { closesOf, emaSeries } from "@/lib/indicators";

const CHART_OPTIONS = {
  autoSize: true,
  layout: {
    background: { type: ColorType.Solid, color: "transparent" },
    textColor: "#8faab4",
    fontSize: 11,
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
  },
  grid: {
    vertLines: { color: "rgba(30, 62, 74, 0.35)" },
    horzLines: { color: "rgba(30, 62, 74, 0.35)" },
  },
  rightPriceScale: { borderColor: "#1e3e4a" },
  timeScale: { timeVisible: true, secondsVisible: false, borderColor: "#1e3e4a" },
  crosshair: {
    horzLine: { labelBackgroundColor: "#17303a" },
    vertLine: { labelBackgroundColor: "#17303a" },
  },
} as const;

type LineSeries = ReturnType<IChartApi["addLineSeries"]>;

export function CandleChart({ candles, showEma = true }: { candles: Candle[]; showEma?: boolean }): ReactNode {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleRef = useRef<ReturnType<IChartApi["addCandlestickSeries"]> | null>(null);
  const ema20Ref = useRef<LineSeries | null>(null);
  const ema50Ref = useRef<LineSeries | null>(null);

  // EMA цувааг зөвхөн лаанууд өөрчлөгдөхөд тооцно (memo)
  const closes = useMemo(() => closesOf(candles), [candles]);
  const ema20 = useMemo(() => emaSeries(closes, 20), [closes]);
  const ema50 = useMemo(() => emaSeries(closes, 50), [closes]);

  // Chart-ийг нэг удаа үүсгээд unmount-д чөлөөлнө (StrictMode-д тэсвэртэй)
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const chart = createChart(el, CHART_OPTIONS);
    candleRef.current = chart.addCandlestickSeries({
      upColor: "#2fd08c",
      downColor: "#fb6f84",
      wickUpColor: "#2fd08c",
      wickDownColor: "#fb6f84",
      borderVisible: false,
      priceLineColor: "#45d6e4",
      priceLineStyle: 2,
    });
    ema20Ref.current = chart.addLineSeries({
      color: "#45d6e4",
      lineWidth: 1.5,
      priceLineVisible: false,
      lastValueVisible: false,
    });
    ema50Ref.current = chart.addLineSeries({
      color: "#f5b84b",
      lineWidth: 1.5,
      priceLineVisible: false,
      lastValueVisible: false,
    });
    chartRef.current = chart;
    return () => {
      chart.remove();
      chartRef.current = null;
      candleRef.current = null;
      ema20Ref.current = null;
      ema50Ref.current = null;
    };
  }, []);

  // Өгөгдөл солигдох бүрт setData + fit
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart || !candleRef.current || !ema20Ref.current || !ema50Ref.current) return;

    const times = candles.map((c) => Math.floor(new Date(c.timestamp).getTime() / 1000) as UTCTimestamp);

    candleRef.current.setData(
      candles.map((c, i) => ({
        time: times[i],
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
      })),
    );

    const toLine = (vals: number[]) =>
      showEma
        ? vals
            .map((v, i) => ({ time: times[i], value: v }))
            .filter((p) => Number.isFinite(p.value))
        : [];
    ema20Ref.current.setData(toLine(ema20));
    ema50Ref.current.setData(toLine(ema50));

    chart.timeScale().fitContent();
  }, [candles, ema20, ema50, showEma]);

  return <div ref={containerRef} className="h-full w-full" aria-label="Candlestick график" />;
}

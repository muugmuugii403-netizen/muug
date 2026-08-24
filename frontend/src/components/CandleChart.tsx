"use client";

/**
 * Candlestick chart — TradingView Lightweight Charts v4.
 *
 * ЗӨВХӨН визуализаци: өгөгдөл нь backend-ийн /api/forex/candles-аас ирнэ.
 * Chart өөрөө data source биш (Lightweight Charts нь JS номын сан).
 */
import { useEffect, useRef, type ReactNode } from "react";
import { createChart, ColorType, type IChartApi, type UTCTimestamp } from "lightweight-charts";
import type { Candle } from "@/lib/market";

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

export function CandleChart({ candles }: { candles: Candle[] }): ReactNode {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ReturnType<IChartApi["addCandlestickSeries"]> | null>(null);

  // Нэг удаа үүсгээд, unmount-д чөлөөлнө (StrictMode давхар mount-д тэсвэртэй)
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const chart = createChart(el, CHART_OPTIONS);
    const series = chart.addCandlestickSeries({
      upColor: "#2fd08c",
      downColor: "#fb6f84",
      wickUpColor: "#2fd08c",
      wickDownColor: "#fb6f84",
      borderVisible: false,
      priceLineColor: "#45d6e4",
      priceLineStyle: 2,
    });
    chartRef.current = chart;
    seriesRef.current = series;
    return () => {
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, []);

  // Өгөгдөл солигдох бүрт setData + fit
  useEffect(() => {
    const series = seriesRef.current;
    const chart = chartRef.current;
    if (!series || !chart) return;
    series.setData(
      candles.map((c) => ({
        time: Math.floor(new Date(c.timestamp).getTime() / 1000) as UTCTimestamp,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
      })),
    );
    chart.timeScale().fitContent();
  }, [candles]);

  return <div ref={containerRef} className="h-full w-full" aria-label="Candlestick график" />;
}

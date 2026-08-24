"use client";

/**
 * Equity муруй — backtest-ийн бодит үр дүнд суурилсан balance line chart (Step 6).
 * TradingView Lightweight Charts; fake data байхгүй.
 */
import { useEffect, useRef, type ReactNode } from "react";
import { createChart, ColorType, type IChartApi, type IPriceLine, type UTCTimestamp } from "lightweight-charts";
import type { EquityPoint } from "@/lib/backtest";

const OPTIONS = {
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

export function EquityCurveChart({ points, initial }: { points: EquityPoint[]; initial: number }): ReactNode {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ReturnType<IChartApi["addLineSeries"]> | null>(null);
  const baseLineRef = useRef<IPriceLine | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const chart = createChart(el, OPTIONS);
    const series = chart.addLineSeries({
      color: "#2fd08c",
      lineWidth: 2,
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

  useEffect(() => {
    const series = seriesRef.current;
    const chart = chartRef.current;
    if (!series || !chart) return;
    series.setData(
      points.map((p) => ({
        time: Math.floor(new Date(p.time).getTime() / 1000) as UTCTimestamp,
        value: p.equity,
      })),
    );
    // Эхний балансын хэвтээ шугам (давхардахгүйн тулд хуучныг нь устгана)
    if (baseLineRef.current) series.removePriceLine(baseLineRef.current);
    baseLineRef.current = series.createPriceLine({
      price: initial,
      color: "#5e7b87",
      lineWidth: 1,
      lineStyle: 2,
      axisLabelVisible: true,
      title: "initial",
    });
    chart.timeScale().fitContent();
  }, [points, initial]);

  return <div ref={containerRef} className="h-full w-full" aria-label="Equity муруй" />;
}

/**
 * Нэг timeframe (5M эсвэл 15M)-ийн техникийн шинжилгээний карт.
 * Trend badge + RSI + MACD + EMA20/EMA50 + ATR + Support/Resistance.
 * Бүх утга backend-ийн indicator давхаргаас ирсэн бодит тооцоо.
 */
import type { ReactNode } from "react";
import type { TimeframeAnalysis } from "@/lib/analysis";
import { macdLabel, trendLabel } from "@/lib/indicators";
import { IcFlat, IcTrendDown, IcTrendUp } from "./icons";

interface Props {
  tf: string; // "5M" | "15M"
  data: TimeframeAnalysis;
  decimals: number;
}

function TrendBadge({ trend }: { trend: TimeframeAnalysis["trend"] }): ReactNode {
  const cls =
    trend === "BULLISH"
      ? "border-buy/40 bg-buy/10 text-buy"
      : trend === "BEARISH"
        ? "border-sell/40 bg-sell/10 text-sell"
        : "border-wait/40 bg-wait/10 text-wait";
  const Icon = trend === "BULLISH" ? IcTrendUp : trend === "BEARISH" ? IcTrendDown : IcFlat;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-sm border px-2 py-0.5 font-mono text-[11px] font-semibold ${cls}`}>
      <Icon className="h-3.5 w-3.5" />
      {trendLabel(trend)}
    </span>
  );
}

function Row({ label, value, valueCls = "text-mist" }: { label: string; value: string; valueCls?: string }): ReactNode {
  return (
    <div className="flex items-baseline justify-between border-b border-line/60 py-1.5 last:border-b-0">
      <span className="font-mono text-[11px] uppercase tracking-wider text-dim">{label}</span>
      <span className={`font-mono text-[13px] font-semibold ${valueCls}`}>{value}</span>
    </div>
  );
}

export function TfAnalysisCard({ tf, data, decimals }: Props): ReactNode {
  const macdCls = data.macd === "BULLISH" ? "text-buy" : data.macd === "BEARISH" ? "text-sell" : "text-wait";
  return (
    <div className="rounded-md border border-line bg-panel/60 p-4 transition-colors hover:border-edge">
      <div className="mb-3 flex items-center justify-between">
        <p className="font-mono text-[13px] font-bold text-mist">{tf} шинжилгээ</p>
        <TrendBadge trend={data.trend} />
      </div>
      <div>
        <Row label="RSI (14)" value={data.rsi.toFixed(1)} valueCls={data.rsi > 70 ? "text-sell" : data.rsi < 30 ? "text-buy" : "text-mist"} />
        <Row label="MACD" value={macdLabel(data.macd)} valueCls={macdCls} />
        <Row label="EMA 20" value={data.ema20.toFixed(decimals)} />
        <Row label="EMA 50" value={data.ema50.toFixed(decimals)} />
        <Row label="ATR (14)" value={data.atr.toFixed(decimals)} valueCls="text-fog" />
        <Row label="Support" value={data.support.toFixed(decimals)} valueCls="text-buy" />
        <Row label="Resistance" value={data.resistance.toFixed(decimals)} valueCls="text-sell" />
      </div>
    </div>
  );
}

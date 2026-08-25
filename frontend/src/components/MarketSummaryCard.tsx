/**
 * Зах зээлийн товч самбар: Trend · Momentum · Volatility · Support · Resistance.
 * Trend/Momentum/Volatility нь 15M шинжилгээнээс (үндсэн timeframe), Support/
 * Resistance нь 15M-ийн тооцсон түвшин. Бүгд backend өгөгдөл дээр суурилна.
 */
import type { ReactNode } from "react";
import type { SignalResponse } from "@/lib/analysis";
import { classifyMomentum, classifyVolatility, trendLabel } from "@/lib/indicators";
import { IcFlat, IcTrendDown, IcTrendUp } from "./icons";

interface Props {
  signal: SignalResponse;
  decimals: number;
}

function Tile({ label, value, cls }: { label: string; value: string; cls?: string }): ReactNode {
  return (
    <div className="rounded-sm border border-line bg-panel/40 px-3 py-2.5 transition-colors hover:border-edge">
      <p className="font-mono text-[9.5px] uppercase tracking-widest text-dim">{label}</p>
      <p className={`mt-1 font-mono text-[14px] font-bold ${cls ?? "text-mist"}`}>{value}</p>
    </div>
  );
}

export function MarketSummaryCard({ signal, decimals }: Props): ReactNode {
  const tf15 = signal.timeframes["15m"];
  const momentum = classifyMomentum(tf15.rsi);
  const volatility = classifyVolatility(tf15.atr, tf15.ema20);

  const trendCls =
    tf15.trend === "BULLISH" ? "text-buy" : tf15.trend === "BEARISH" ? "text-sell" : "text-wait";
  const TrendIcon = tf15.trend === "BULLISH" ? IcTrendUp : tf15.trend === "BEARISH" ? IcTrendDown : IcFlat;
  const momCls = momentum === "Хүчтэй" ? "text-cy" : momentum === "Дунд зэрэг" ? "text-mist" : "text-fog";
  const volCls = volatility === "Өндөр" ? "text-sell" : volatility === "Дунд" ? "text-wait" : "text-buy";

  return (
    <section aria-label="Зах зээлийн тойм" className="rounded-md border border-line bg-panel/60 p-4">
      <p className="mb-3 font-mono text-[10.5px] uppercase tracking-widest text-dim">Зах зээлийн тойм (15M)</p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        <div className="rounded-sm border border-line bg-panel/40 px-3 py-2.5 transition-colors hover:border-edge">
          <p className="font-mono text-[9.5px] uppercase tracking-widest text-dim">Trend</p>
          <p className={`mt-1 flex items-center gap-1.5 font-mono text-[14px] font-bold ${trendCls}`}>
            <TrendIcon className="h-4 w-4" />
            {trendLabel(tf15.trend)}
          </p>
        </div>
        <Tile label="Momentum" value={momentum} cls={momCls} />
        <Tile label="Volatility" value={volatility} cls={volCls} />
        <Tile label="Support" value={tf15.support.toFixed(decimals)} cls="text-buy" />
        <Tile label="Resistance" value={tf15.resistance.toFixed(decimals)} cls="text-sell" />
      </div>
    </section>
  );
}

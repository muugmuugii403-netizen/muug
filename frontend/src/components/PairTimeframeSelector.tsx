/**
 * Forex pair сонголт + 5M/15M timeframe tab.
 * Зөвхөн сонголтыг өөрчилнө — өгөгдөл/шинжилгээг page.tsx ачаална.
 */
import type { ReactNode } from "react";
import { FOREX_PAIRS, type Interval } from "@/lib/market";

interface Props {
  symbol: string;
  interval: Interval;
  onSymbol: (s: string) => void;
  onInterval: (tf: Interval) => void;
}

export function PairTimeframeSelector({ symbol, interval, onSymbol, onInterval }: Props): ReactNode {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4">
      {/* Pair сонголт */}
      <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Forex pair">
        {FOREX_PAIRS.map((p) => {
          const active = p.symbol === symbol;
          return (
            <button
              key={p.symbol}
              type="button"
              role="tab"
              aria-selected={active}
              title={p.name}
              onClick={() => onSymbol(p.symbol)}
              className={`rounded-sm border px-3 py-2 font-mono text-[13px] font-semibold tracking-tight transition-all duration-150 ${
                active
                  ? "border-cy/60 bg-cy/10 text-mist shadow-[0_0_16px_-6px_rgba(69,214,228,0.5)]"
                  : "border-line bg-panel/40 text-fog hover:border-edge hover:text-mist"
              }`}
            >
              {p.symbol}
            </button>
          );
        })}
      </div>

      {/* Timeframe tab */}
      <div className="flex overflow-hidden rounded-sm border border-line" role="tablist" aria-label="Timeframe">
        {(["5min", "15min"] as const).map((tf) => {
          const active = tf === interval;
          return (
            <button
              key={tf}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onInterval(tf)}
              className={`px-5 py-2 font-mono text-[13px] font-semibold transition-colors duration-150 ${
                active ? "bg-buy/15 text-buy" : "bg-panel/40 text-dim hover:text-fog"
              }`}
            >
              {tf === "5min" ? "5M" : "15M"}
            </button>
          );
        })}
      </div>
    </div>
  );
}

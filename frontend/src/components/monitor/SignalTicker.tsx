/**
 * Олон pair-ийн шууд signal самбар (Step 7).
 * SSE `signal` event-ээр шинэчлэгдэнэ — хуудас дахин ачаалахгүй.
 * Pair дээр дарахад сонгогдоно.
 */
import type { ReactNode } from "react";
import { FOREX_PAIRS } from "@/lib/market";
import { SIGNAL_META, type SignalDirection, type SignalResponse } from "@/lib/analysis";

interface Props {
  signals: Record<string, SignalResponse>;
  selected: string;
  onSelect: (symbol: string) => void;
  connected: boolean;
}

function SignalChip({ dir, confidence }: { dir: SignalDirection; confidence: number }): ReactNode {
  const meta = SIGNAL_META[dir];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-sm border px-2 py-0.5 font-mono text-[11px] font-semibold ${meta.border} ${meta.cls}`}>
      <span>{meta.emoji}</span>
      {dir}
      <span className="text-[10px] opacity-70">{confidence}</span>
    </span>
  );
}

export function SignalTicker({ signals, selected, onSelect, connected }: Props): ReactNode {
  return (
    <section className="border-b border-line bg-panel/40">
      <div className="mx-auto w-full max-w-7xl px-5 sm:px-8">
        <div className="flex items-center gap-3 py-2">
          <span className={`led h-1.5 w-1.5 shrink-0 rounded-full ${connected ? "bg-buy" : "bg-sell"}`} />
          <span className="shrink-0 font-mono text-[10px] uppercase tracking-widest text-dim">
            {connected ? "LIVE · 7 pair" : "Холболтгүй"}
          </span>
          <div className="flex flex-1 gap-2 overflow-x-auto py-1 [scrollbar-width:none]">
            {FOREX_PAIRS.map((p) => {
              const sig = signals[p.symbol];
              const active = p.symbol === selected;
              return (
                <button
                  key={p.symbol}
                  type="button"
                  onClick={() => onSelect(p.symbol)}
                  className={`flex shrink-0 items-center gap-2 rounded-sm border px-2.5 py-1.5 transition-colors ${
                    active ? "border-cy/60 bg-cy/10" : "border-line bg-panel/60 hover:border-edge"
                  }`}
                >
                  <span className={`font-mono text-[11.5px] ${active ? "text-mist" : "text-fog"}`}>{p.symbol}</span>
                  {sig ? (
                    <SignalChip dir={sig.signal} confidence={sig.confidence} />
                  ) : (
                    <span className="font-mono text-[10px] text-dim">…</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

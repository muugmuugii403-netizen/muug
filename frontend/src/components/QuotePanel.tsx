"use client";

/**
 * Амьд үнийн самбар: price, bid, ask, spread + эх сурвалжийн тэмдэг.
 * Auto-refresh (20с) нь quote endpoint-ийн TTL cache-тай зохицсон.
 */
import type { ReactNode } from "react";
import type { QuoteResponse } from "@/lib/market";
import { spreadInPips } from "@/lib/market";

interface Props {
  quote: QuoteResponse | null;
  pipDecimals: number;
  loading: boolean;
  error: string | null;
  autoRefresh: boolean;
  onToggleAuto: () => void;
  onRefresh: () => void;
}

function Row({ label, value, cls }: { label: string; value: string; cls: string }): ReactNode {
  return (
    <div className="flex items-center justify-between rounded-sm border border-line bg-panel2/60 px-3 py-2.5 transition-colors hover:border-edge">
      <span className="font-mono text-[10.5px] uppercase tracking-wider text-dim">{label}</span>
      <span className={`font-mono text-[14px] font-semibold ${cls}`}>{value}</span>
    </div>
  );
}

export function QuotePanel({ quote, pipDecimals, loading, error, autoRefresh, onToggleAuto, onRefresh }: Props): ReactNode {
  const pips = quote ? spreadInPips(quote.symbol, quote.spread) : null;
  const updated = quote ? new Date(quote.timestamp) : null;

  return (
    <section className="rounded-md border border-line bg-panel/60 p-4">
      <div className="flex items-center justify-between">
        <h2 className="font-mono text-[11px] uppercase tracking-[0.18em] text-dim">Quote</h2>
        <div className="flex items-center gap-2">
          {quote && (
            <span
              className={`rounded-sm border px-2 py-0.5 font-mono text-[10px] tracking-wider ${
                quote.source === "sample"
                  ? "border-wait/50 bg-wait/10 text-wait"
                  : "border-buy/50 bg-buy/10 text-buy"
              }`}
            >
              {quote.source === "sample" ? "SAMPLE" : "LIVE"}
            </span>
          )}
          <button
            type="button"
            onClick={onToggleAuto}
            className={`flex items-center gap-1.5 rounded-sm border px-2 py-0.5 font-mono text-[10.5px] transition-colors ${
              autoRefresh ? "border-cy/50 bg-cy/10 text-cy" : "border-line text-dim hover:border-edge"
            }`}
            title="20 секунд тутам шинэчилнэ"
          >
            <span className={`h-1.5 w-1.5 rounded-full ${autoRefresh ? "led bg-cy" : "bg-dim"}`} />
            auto
          </button>
          <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            className="rounded-sm border border-line px-2 py-0.5 font-mono text-[10.5px] text-fog transition-colors hover:border-edge hover:text-mist disabled:opacity-40"
            title="Одоо шинэчлэх"
          >
            ↻
          </button>
        </div>
      </div>

      {loading && !quote && (
        <div className="mt-3 space-y-2">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-10 animate-pulse rounded-sm bg-panel2" />
          ))}
        </div>
      )}

      {error && !quote && (
        <p className="mt-3 rounded-sm border border-sell/40 bg-sell/10 px-3 py-2.5 font-mono text-[12px] text-sell">
          ✕ {error}
        </p>
      )}

      {quote && (
        <>
          <div className="mt-3 rounded-sm border border-line bg-deep px-4 py-4 text-center">
            <p className="font-mono text-[10.5px] uppercase tracking-wider text-dim">{quote.symbol} · mid</p>
            <p
              className={`font-display mt-1 text-[34px] font-bold leading-none tracking-tight transition-opacity ${
                loading ? "opacity-50" : "opacity-100"
              }`}
            >
              {quote.price.toFixed(pipDecimals)}
            </p>
            {updated && (
              <p className="mt-2 font-mono text-[10.5px] text-dim">
                шинэчилсэн: {updated.toLocaleTimeString("mn-MN", { hour12: false })}
              </p>
            )}
          </div>
          <div className="mt-2.5 space-y-1.5">
            <Row label="Bid" value={quote.bid.toFixed(pipDecimals)} cls="text-sell" />
            <Row label="Ask" value={quote.ask.toFixed(pipDecimals)} cls="text-buy" />
            <Row
              label="Spread"
              value={`${quote.spread.toFixed(pipDecimals)} · ${pips !== null ? pips.toFixed(1) : "–"} pips`}
              cls="text-wait"
            />
          </div>
        </>
      )}
    </section>
  );
}

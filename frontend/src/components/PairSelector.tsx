"use client";

/**
 * Pair + timeframe сонгогч.
 * Сонголтыг илгээхээс өмнө zod-оор validate хийнэ (backend мөн Pydantic-аар давхар шалгана).
 */
import { useMemo, useState } from "react";
import { z } from "zod";
import { TIMEFRAMES, type AnalysisRequest, type PairInfo, type Timeframe } from "@/lib/types";

const requestSchema = z.object({
  symbol: z.string().regex(/^[A-Z]{3}\/[A-Z]{3}$/, "Pair формат буруу (жишээ: EUR/USD)"),
  timeframe: z.enum(TIMEFRAMES),
});

interface Props {
  pairs: PairInfo[];
  loading: boolean;
  busy: boolean;
  onSubmit: (req: AnalysisRequest) => void;
}

export function PairSelector({ pairs, loading, busy, onSubmit }: Props) {
  const [symbol, setSymbol] = useState<string>("EUR/USD");
  const [timeframe, setTimeframe] = useState<Timeframe>("1h");
  const [error, setError] = useState<string | null>(null);

  const selected = useMemo(() => pairs.find((p) => p.symbol === symbol) ?? null, [pairs, symbol]);

  const handleSubmit = (): void => {
    const parsed = requestSchema.safeParse({ symbol, timeframe });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Сонголт буруу байна");
      return;
    }
    setError(null);
    onSubmit(parsed.data);
  };

  return (
    <section className="rounded-md border border-line bg-panel/60 p-5">
      <h2 className="text-sm font-semibold tracking-wide text-mist">Шинжилгээний сонголт</h2>

      {/* Pair товчнууд */}
      <p className="mt-4 font-mono text-[11px] uppercase tracking-wider text-dim">Currency pair</p>
      <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {loading
          ? Array.from({ length: 6 }, (_, i) => (
              <div key={i} className="h-10 animate-pulse rounded-sm border border-line bg-panel2" />
            ))
          : pairs.map((p) => (
              <button
                key={p.symbol}
                type="button"
                onClick={() => setSymbol(p.symbol)}
                className={`rounded-sm border px-3 py-2 text-left font-mono text-[13px] transition-colors ${
                  p.symbol === symbol
                    ? "border-cy/60 bg-cy/10 text-mist"
                    : "border-line text-fog hover:border-edge hover:text-mist"
                }`}
                title={p.name}
              >
                {p.symbol}
              </button>
            ))}
      </div>

      {/* Timeframe */}
      <p className="mt-4 font-mono text-[11px] uppercase tracking-wider text-dim">Timeframe</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {TIMEFRAMES.map((tf) => (
          <button
            key={tf}
            type="button"
            onClick={() => setTimeframe(tf)}
            className={`rounded-sm border px-3 py-1.5 font-mono text-[12px] transition-colors ${
              tf === timeframe ? "border-buy/60 bg-buy/10 text-buy" : "border-line text-fog hover:border-edge"
            }`}
          >
            {tf}
          </button>
        ))}
      </div>

      {selected && (
        <p className="mt-3 text-[13px] text-fog">
          {selected.name} · pip нарийвчлал {selected.pip_decimals} орон
        </p>
      )}

      {error && <p className="mt-3 rounded-sm border border-sell/40 bg-sell/10 px-3 py-2 text-[13px] text-sell">{error}</p>}

      <button
        type="button"
        onClick={handleSubmit}
        disabled={busy || loading}
        className="mt-4 w-full rounded-sm border border-buy/50 bg-buy/15 px-4 py-2.5 font-semibold text-buy transition-colors hover:bg-buy/25 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busy ? "Илгээж байна…" : "Шинжлэх хүсэлт илгээх"}
      </button>
      <p className="mt-2 text-center font-mono text-[11px] text-dim">
        Scoring engine Step 2-т идэвхжинэ — одоо 501 хариу ирнэ
      </p>
    </section>
  );
}

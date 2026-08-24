"use client";

/**
 * AI тайлбар самбар (Step 4). Зөвхөн Qwen-ийн Монгол хэл дээрх тайлбарыг
 * харуулна — signal/оноо/үнэд хүрэхгүй. AI байхгүй үед (unavailable/disabled)
 * тохирох мессеж гаргаж, signal самбар хэвийн хэвээр үлдэнэ.
 */
import type { ReactNode } from "react";
import { SIGNAL_META, type AnalysisResponse, type SignalDirection } from "@/lib/analysis";
import { AnalysisSkeleton } from "./Skeletons";

function Block({ title, text }: { title: string; text: string }): ReactNode {
  return (
    <div>
      <p className="font-mono text-[10.5px] uppercase tracking-wider text-cy">{title}</p>
      <p className="mt-1 text-[13.5px] leading-relaxed text-fog">{text}</p>
    </div>
  );
}

function aiStatusChip(status: AnalysisResponse["ai_status"], message: string): ReactNode {
  const map = {
    ok: { cls: "border-buy/50 text-buy", dot: "bg-buy" },
    unavailable: { cls: "border-wait/50 text-wait", dot: "bg-wait" },
    disabled: { cls: "border-line text-dim", dot: "bg-dim" },
  } as const;
  const m = map[status];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-sm border px-2 py-0.5 font-mono text-[10.5px] ${m.cls}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${m.dot}`} />
      {status === "ok" ? "Qwen AI" : message}
    </span>
  );
}

export function AnalysisPanel({
  analysis,
  loading,
  signal,
}: {
  analysis: AnalysisResponse | null;
  loading: boolean;
  signal: SignalDirection | null;
}): ReactNode {
  if (loading) {
    return (
      <section className="rounded-md border border-line bg-panel/60">
        <AnalysisSkeleton />
        <p className="px-6 pb-5 font-mono text-[11px] text-dim">Qwen AI тайлбар бэлтгэж байна…</p>
      </section>
    );
  }

  if (!analysis) {
    return (
      <section className="rounded-md border border-line bg-panel/60 p-5">
        <p className="text-[13.5px] text-fog">Шинжилгээ авахын тулд дээрх товчийг дарна уу.</p>
      </section>
    );
  }

  const meta = signal ? SIGNAL_META[signal] : null;
  const explanation = analysis.explanation;

  return (
    <section className="rounded-md border border-line bg-panel/60 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-[15px] font-semibold text-mist">
          ЯАГААД {meta ? meta.label : ""} ВЭ?
        </h2>
        {aiStatusChip(analysis.ai_status, analysis.ai_message)}
      </div>

      {explanation ? (
        <div className="mt-4 space-y-4">
          <Block title="Товч тайлбар" text={explanation.summary} />
          <Block title="Signal тайлбар" text={explanation.signal_explanation} />

          {explanation.technical_reasons.length > 0 && (
            <div>
              <p className="font-mono text-[10.5px] uppercase tracking-wider text-cy">Техник шалтгаан</p>
              <ul className="mt-1.5 space-y-1">
                {explanation.technical_reasons.map((r) => (
                  <li key={r} className="flex gap-2 text-[13px] text-fog">
                    <span className="text-buy">▸</span> {r}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <Block title="Зах зээлийн нөхцөл" text={explanation.market_context} />
          <Block title="Entry тайлбар" text={explanation.entry_explanation} />
          <Block title="Stop Loss тайлбар" text={explanation.stop_loss_explanation} />
          <Block title="Take Profit тайлбар" text={explanation.take_profit_explanation} />

          <div className="rounded-md border border-sell/40 bg-sell/[0.06] p-3.5">
            <p className="font-mono text-[10.5px] uppercase tracking-wider text-sell">⚠️ Эрсдэл</p>
            <p className="mt-1 text-[13.5px] leading-relaxed text-fog">{explanation.risk_analysis}</p>
            {explanation.warnings.length > 0 && (
              <ul className="mt-2 space-y-1">
                {explanation.warnings.map((w) => (
                  <li key={w} className="flex gap-2 text-[12.5px] text-fog">
                    <span className="text-sell">•</span> {w}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      ) : (
        <div className="mt-4 rounded-md border border-wait/45 bg-wait/[0.06] p-4">
          <p className="text-[13.5px] font-medium text-wait">{analysis.ai_message}</p>
          <p className="mt-1.5 text-[12.5px] leading-relaxed text-fog">
            Technical signal дээр самбарт бүрэн харагдаж байна. AI тайлбар нь зөвхөн нэмэлт
            тайлбар бөгөөд signal-д нөлөөлөхгүй.
          </p>
        </div>
      )}
    </section>
  );
}

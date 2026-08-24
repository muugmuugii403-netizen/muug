"use client";

/**
 * Signal самбар (Step 5): том signal, оноонууд, confidence, entry/SL/TP/RR.
 * WAIT үед худалдааны төлөвлөгөөг онцолж харуулахгүй (бүдгэрүүлнэ).
 * Бүх утга backend-ийн deterministic engine-ээс ирсэн — frontend тооцохгүй.
 */
import type { ReactNode } from "react";
import { SIGNAL_META, formatPrice, type SignalResponse } from "@/lib/analysis";
import { IcTarget } from "./icons";

function ScoreBar({ label, value, cls }: { label: string; value: number; cls: string }): ReactNode {
  return (
    <div className="flex items-center gap-2.5">
      <span className="w-11 font-mono text-[11px] font-semibold text-dim">{label}</span>
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-panel2">
        <div className={`h-full ${cls} transition-[width] duration-700 ease-out`} style={{ width: `${value}%` }} />
      </div>
      <span className="w-8 text-right font-mono text-[12px] font-bold text-mist">{value}</span>
    </div>
  );
}

function Level({ label, value, cls, muted }: { label: string; value: string; cls: string; muted: boolean }): ReactNode {
  return (
    <div className={`bg-panel/60 px-2 py-2.5 text-center transition-opacity ${muted ? "opacity-40" : ""}`}>
      <p className="font-mono text-[9.5px] tracking-wider text-dim">{label}</p>
      <p className={`mt-1 font-mono text-[12.5px] font-bold ${cls}`}>{value}</p>
    </div>
  );
}

export function SignalPanel({ signal, decimals }: { signal: SignalResponse; decimals: number }): ReactNode {
  const meta = SIGNAL_META[signal.signal];
  const isWait = signal.signal === "WAIT";

  return (
    <section
      aria-label="Signal самбар"
      className={`rounded-md border bg-panel/60 transition-colors ${meta.border}`}
    >
      <div className="p-5">
        {/* Signal + confidence */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="text-3xl leading-none">{meta.emoji}</span>
            <div>
              <p className={`font-mono text-[30px] font-extrabold leading-none tracking-tight ${meta.cls}`}>
                {meta.label}
              </p>
              <p className="mt-1 font-mono text-[10.5px] uppercase tracking-widest text-dim">
                {isWait ? "Хүлээх дохио" : "Детерминист сигнал"}
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="font-mono text-[10px] uppercase tracking-widest text-dim">Confidence</p>
            <p className={`font-mono text-2xl font-extrabold ${meta.cls}`}>
              {signal.confidence}
              <span className="text-[13px] font-semibold text-dim">/100</span>
            </p>
          </div>
        </div>

        {/* Оноонууд */}
        <div className="mt-5 space-y-2.5">
          <ScoreBar label="BUY" value={signal.buy_score} cls="bg-buy" />
          <ScoreBar label="SELL" value={signal.sell_score} cls="bg-sell" />
          <ScoreBar label="WAIT" value={signal.wait_score} cls="bg-wait" />
        </div>
      </div>

      {/* Trade levels */}
      <div className="border-t border-line px-5 py-4">
        <div className="mb-2.5 flex items-center justify-between">
          <p className="flex items-center gap-1.5 font-mono text-[10.5px] uppercase tracking-wider text-dim">
            <IcTarget className="h-3.5 w-3.5" /> Худалдааны түвшин
          </p>
          {isWait && (
            <span className="rounded-sm border border-wait/40 bg-wait/10 px-2 py-px font-mono text-[9.5px] text-wait">
              Төлөвлөгөөгүй
            </span>
          )}
        </div>
        <div className="grid grid-cols-4 overflow-hidden rounded-sm border border-line">
          <Level label="ENTRY" value={formatPrice(signal.entry, decimals)} cls="text-mist" muted={isWait} />
          <Level label="STOP LOSS" value={formatPrice(signal.stop_loss, decimals)} cls="text-sell" muted={isWait} />
          <Level label="TAKE PROFIT" value={formatPrice(signal.take_profit, decimals)} cls="text-buy" muted={isWait} />
          <Level
            label="RISK / REWARD"
            value={signal.risk_reward === null ? "—" : `1 : ${signal.risk_reward.toFixed(1)}`}
            cls="text-cy"
            muted={isWait}
          />
        </div>
        {isWait && (
          <p className="mt-2.5 text-[12px] leading-relaxed text-fog">
            WAIT дохио нь одоогоор арилжаа хийхийг зөвлөхгүй байна. Нөхцөл тодорхой болтол хүлээнэ үү.
          </p>
        )}
      </div>
    </section>
  );
}

"use client";

/**
 * Deterministic signal самбар (Step 3): signal, оноо, confidence, entry/SL/TP,
 * 5M/15M шинжилгээ, reasons, warnings. Эдгээр нь AI-гүйгээр бүрэн ажиллана.
 */
import type { ReactNode } from "react";
import { SIGNAL_META, formatPrice, type SignalResponse } from "@/lib/analysis";

function ScoreBar({ label, value, cls }: { label: string; value: number; cls: string }): ReactNode {
  return (
    <div className="flex items-center gap-2">
      <span className="w-10 font-mono text-[10.5px] text-dim">{label}</span>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-panel2">
        <div className={`h-full ${cls} transition-[width] duration-700`} style={{ width: `${value}%` }} />
      </div>
      <span className="w-8 text-right font-mono text-[11.5px] text-mist">{value}</span>
    </div>
  );
}

function TfCard({ tf, data }: { tf: string; data: SignalResponse["timeframes"]["5m"] }): ReactNode {
  const trendCls =
    data.trend === "BULLISH" ? "text-buy" : data.trend === "BEARISH" ? "text-sell" : "text-wait";
  return (
    <div className="rounded-md border border-line bg-panel/60 p-3">
      <p className="font-mono text-[10.5px] uppercase tracking-wider text-dim">{tf} шинжилгээ</p>
      <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1.5 text-[12.5px]">
        <p className="text-fog">
          Trend: <span className={`font-semibold ${trendCls}`}>{data.trend}</span>
        </p>
        <p className="text-fog">
          RSI: <span className="font-mono text-mist">{data.rsi.toFixed(1)}</span>
        </p>
        <p className="text-fog">
          MACD: <span className={data.macd === "BULLISH" ? "text-buy" : data.macd === "BEARISH" ? "text-sell" : "text-wait"}>{data.macd}</span>
        </p>
        <p className="text-fog">
          EMA20: <span className="font-mono text-mist">{data.ema20.toFixed(5)}</span>
        </p>
      </div>
    </div>
  );
}

export function SignalPanel({ signal, decimals }: { signal: SignalResponse; decimals: number }): ReactNode {
  const meta = SIGNAL_META[signal.signal];
  return (
    <section className="rounded-md border border-line bg-panel/60 p-5">
      {/* Signal + confidence */}
      <div className="flex items-center justify-between">
        <div className={`inline-flex items-center gap-2.5 rounded-md border px-4 py-2 ${meta.border}`}>
          <span className="text-xl">{meta.emoji}</span>
          <span className={`font-display text-2xl font-bold ${meta.cls}`}>{meta.label}</span>
        </div>
        <div className="text-right">
          <p className="font-mono text-[10.5px] uppercase tracking-wider text-dim">Confidence</p>
          <p className={`font-display text-xl font-bold ${meta.cls}`}>{signal.confidence}/100</p>
        </div>
      </div>

      {/* Оноонууд */}
      <div className="mt-4 space-y-2">
        <ScoreBar label="BUY" value={signal.buy_score} cls="bg-buy" />
        <ScoreBar label="SELL" value={signal.sell_score} cls="bg-sell" />
        <ScoreBar label="WAIT" value={signal.wait_score} cls="bg-wait" />
      </div>

      {/* Entry / SL / TP / RR */}
      <div className="mt-4 grid grid-cols-4 overflow-hidden rounded-sm border border-line">
        {(
          [
            ["ENTRY", formatPrice(signal.entry, decimals), "text-mist"],
            ["STOP LOSS", formatPrice(signal.stop_loss, decimals), "text-sell"],
            ["TAKE PROFIT", formatPrice(signal.take_profit, decimals), "text-buy"],
            ["R:R", signal.risk_reward === null ? "—" : `1:${signal.risk_reward.toFixed(1)}`, "text-cy"],
          ] as const
        ).map(([t, v, c], i) => (
          <div key={t} className={`bg-panel/60 px-2 py-2.5 text-center ${i > 0 ? "border-l border-line" : ""}`}>
            <p className="font-mono text-[9.5px] tracking-wider text-dim">{t}</p>
            <p className={`mt-1 font-mono text-[12px] font-semibold ${c}`}>{v}</p>
          </div>
        ))}
      </div>

      {/* 5M / 15M */}
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <TfCard tf="5M" data={signal.timeframes["5m"]} />
        <TfCard tf="15M" data={signal.timeframes["15m"]} />
      </div>

      {/* Reasons / Warnings */}
      {signal.reasons.length > 0 && (
        <div className="mt-4">
          <p className="font-mono text-[10.5px] uppercase tracking-wider text-dim">Шалтгаан</p>
          <ul className="mt-1.5 space-y-1">
            {signal.reasons.map((r) => (
              <li key={r} className="flex gap-2 text-[12.5px] text-fog">
                <span className="text-buy">▸</span> {r}
              </li>
            ))}
          </ul>
        </div>
      )}
      {signal.warnings.length > 0 && (
        <div className="mt-4">
          <p className="font-mono text-[10.5px] uppercase tracking-wider text-dim">Сануулга</p>
          <ul className="mt-1.5 space-y-1">
            {signal.warnings.map((w) => (
              <li key={w} className="flex gap-2 text-[12.5px] text-fog">
                <span className="text-wait">⚠</span> {w}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

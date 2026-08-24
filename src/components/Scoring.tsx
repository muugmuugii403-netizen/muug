import { useState, type ReactNode } from "react";
import { DEMO_PAIRS, EXAMPLE_78, FORMULA_TXT, RULES, type DemoPair } from "../data";
import { Callout, Chip, CodeBlock, IcBolt, IcCheck, IcCross, Reveal, SectionHead } from "./bits";

/* ================= deterministic engine (demo) ================= */

type Direction = "BUY" | "SELL" | "WAIT";

interface EngineResult {
  buy: number;
  sell: number;
  wait: number;
  margin: number;
  c1: boolean;
  c2: boolean;
  c3: boolean;
  dir: Direction;
}

function runEngine(p: DemoPair): EngineResult {
  let buy = 0;
  let sell = 0;
  let wait = 0;
  for (const r of p.rules) {
    buy += r.bull;
    sell += r.bear;
    wait += r.neutral;
  }
  const max = Math.max(buy, sell);
  const margin = Math.abs(buy - sell);
  const rr = p.trade?.rr ?? 0;
  const c1 = max >= 55;
  const c2 = margin >= 25;
  const c3 = rr >= 1.5;
  const dir: Direction = c1 && c2 && c3 ? (buy > sell ? "BUY" : "SELL") : "WAIT";
  return { buy, sell, wait, margin, c1, c2, c3, dir };
}

const DIR_STYLE: Record<Direction, { text: string; border: string; bg: string }> = {
  BUY: { text: "text-buy", border: "border-buy/40", bg: "bg-buy/[0.08]" },
  SELL: { text: "text-sell", border: "border-sell/40", bg: "bg-sell/[0.08]" },
  WAIT: { text: "text-wait", border: "border-wait/40", bg: "bg-wait/[0.08]" },
};

function ScoreBar({ label, v, cls, delay }: { label: string; v: number; cls: string; delay: number }): ReactNode {
  return (
    <div className="flex items-center gap-3">
      <span className={`w-11 font-mono text-[11.5px] font-semibold ${cls.replace("bg-", "text-")}`}>{label}</span>
      <div className="h-2 flex-1 overflow-hidden rounded-sm bg-panel2">
        <div className={`${cls} h-full rounded-sm transition-[width] duration-700 ease-out`} style={{ width: `${v}%`, transitionDelay: `${delay}ms` }} />
      </div>
      <span className="w-14 text-right font-mono text-[12.5px] text-mist">{v}/100</span>
    </div>
  );
}

function Condition({ ok, text }: { ok: boolean; text: string }): ReactNode {
  return (
    <div className="flex items-center gap-2.5 rounded-sm border border-line bg-deep/60 px-3 py-2">
      <span className={ok ? "text-buy" : "text-sell"}>{ok ? <IcCheck /> : <IcCross />}</span>
      <span className={`font-mono text-[11.5px] ${ok ? "text-fog" : "text-dim line-through decoration-sell/60"}`}>{text}</span>
    </div>
  );
}

function Demo(): ReactNode {
  const [idx, setIdx] = useState(0);
  const pair = DEMO_PAIRS[idx];
  const r = runEngine(pair);
  const ds = DIR_STYLE[r.dir];

  return (
    <Reveal>
      <div className="overflow-hidden rounded-md border border-edge bg-deep/70">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-panel px-4 py-3">
          <div className="flex gap-2">
            {DEMO_PAIRS.map((p, i) => (
              <button
                key={p.sym}
                type="button"
                onClick={() => setIdx(i)}
                className={`rounded-sm border px-3 py-1.5 font-mono text-[12px] transition-all duration-200 ${
                  i === idx
                    ? "border-cy/60 bg-cy/10 text-mist shadow-[0_0_18px_-6px_rgba(69,214,228,0.5)]"
                    : "border-line text-dim hover:border-edge hover:text-fog"
                }`}
              >
                {p.pair}
              </button>
            ))}
          </div>
          <Chip tone="wait">жишээ өгөгдөл · ижил дүрэм</Chip>
        </div>

        <div className="grid gap-6 p-4 sm:p-6 lg:grid-cols-[0.9fr_1.1fr]">
          {/* left: result */}
          <div>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-mono text-[10.5px] tracking-[0.2em] text-dim uppercase">signal output</p>
                <div key={r.dir} className={`popin mt-2 inline-flex items-baseline gap-3 rounded-sm border px-4 py-2 ${ds.border} ${ds.bg}`}>
                  <span className={`font-display text-3xl font-bold ${ds.text}`}>{r.dir}</span>
                  <span className="font-mono text-[11px] text-fog">{pair.tf}</span>
                </div>
              </div>
              <div className="text-right">
                <p className="font-mono text-[10.5px] text-dim">confidence</p>
                <p className={`font-display text-2xl font-bold ${ds.text}`}>{pair.confidence}</p>
              </div>
            </div>

            <div className="mt-5 space-y-2.5">
              <ScoreBar label="BUY" v={r.buy} cls="bg-buy" delay={0} />
              <ScoreBar label="SELL" v={r.sell} cls="bg-sell" delay={90} />
              <ScoreBar label="WAIT" v={r.wait} cls="bg-wait" delay={180} />
            </div>

            <div className="mt-5 space-y-1.5">
              <Condition ok={r.c1} text={`max оноо ≥ 55 (одуул: ${Math.max(r.buy, r.sell)})`} />
              <Condition ok={r.c2} text={`зөрүү ≥ 25 (одуул: ${r.margin})`} />
              <Condition ok={r.c3} text={`RR ≥ 1.5 (одуул: ${pair.trade ? pair.trade.rr.toFixed(2) : "—"})`} />
            </div>

            {/* trade plan */}
            <div className="mt-5 grid grid-cols-4 overflow-hidden rounded-sm border border-line">
              {(
                [
                  ["ENTRY", pair.trade?.entry ?? "—", "text-mist"],
                  ["STOP LOSS", pair.trade?.sl ?? "—", "text-sell"],
                  ["TAKE PROFIT", pair.trade?.tp ?? "—", "text-buy"],
                  ["R:R", pair.trade ? `1:${pair.trade.rr.toFixed(2)}` : "—", "text-cy"],
                ] as const
              ).map(([t, v, c], i) => (
                <div key={t} className={`bg-panel/60 px-2.5 py-2.5 text-center ${i > 0 ? "border-l border-line" : ""}`}>
                  <p className="font-mono text-[9.5px] tracking-wider text-dim">{t}</p>
                  <p className={`mt-1 font-mono text-[12.5px] font-semibold ${c}`}>{v}</p>
                </div>
              ))}
            </div>

            <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1 font-mono text-[11.5px] text-fog">
              <span>
                trend: <b className="text-mist">{pair.trend}</b>
              </span>
              <span>
                support: <b className="text-buy">{pair.support}</b>
              </span>
              <span>
                resistance: <b className="text-sell">{pair.resistance}</b>
              </span>
            </div>

            {pair.warnings.map((w) => (
              <div key={w} className="mt-4">
                <Callout tone="wait" title="Сануулга">
                  {w}
                </Callout>
              </div>
            ))}
          </div>

          {/* right: rule breakdown */}
          <div>
            <p className="mb-2.5 font-mono text-[10.5px] tracking-[0.2em] text-dim uppercase">
              дүрмийн задалгаа · Σ = 100
            </p>
            <div className="space-y-2">
              {pair.rules.map((rule) => (
                <div
                  key={rule.key}
                  className="group rounded-sm border border-line bg-panel/50 px-3.5 py-2.5 transition-all duration-200 hover:translate-x-1 hover:border-edge"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="font-mono text-[10.5px] text-dim">{rule.key}</span>
                    <span className="font-mono text-[12.5px] font-medium text-mist">{rule.name}</span>
                    <span className="ml-auto flex gap-1.5">
                      {rule.bull > 0 ? <span className="rounded-sm bg-buy/12 px-1.5 py-px font-mono text-[10.5px] text-buy">+{rule.bull}</span> : null}
                      {rule.bear > 0 ? <span className="rounded-sm bg-sell/12 px-1.5 py-px font-mono text-[10.5px] text-sell">−{rule.bear}</span> : null}
                      {rule.neutral > 0 ? <span className="rounded-sm bg-panel2 px-1.5 py-px font-mono text-[10.5px] text-dim">~{rule.neutral}</span> : null}
                    </span>
                  </div>
                  <p className="mt-1 text-[12.5px] leading-relaxed text-fog">{rule.note}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </Reveal>
  );
}

/* ================= 06 · scoring section ================= */

export function ScoringSection(): ReactNode {
  return (
    <section id="scoring" className="scroll-mt-28">
      <SectionHead
        num="06"
        kicker="Deterministic Scoring"
        title="Signal scoring алгоритм"
        desc="Дүрэм бүр нийт 100 онооны жингээс хуваарилалт авна. Шийдвэр нь хүнээс хамаарахгүй, кодонд бичигдсэн 3 босго нөхцөлөөр гарна."
      />

      <Reveal>
        <div className="mb-8 flex gap-3.5 rounded-md border border-wait/45 border-l-[3px] bg-wait/[0.05] p-4 sm:p-5">
          <span className="mt-0.5 text-wait">
            <IcBolt className="h-5 w-5" />
          </span>
          <div>
            <p className="font-display text-[13.5px] font-semibold tracking-wide text-mist">
              ЧУХАЛ ЗАРЧИМ — AI signal зохиохгүй
            </p>
            <p className="mt-1 text-[14px] leading-relaxed text-fog">
              Qwen API дур мэдэн BUY/SELL гаргаж <b className="text-sell">болохгүй</b>. Техникийн indicator болон market
              data дээр суурилсан deterministic engine <b className="text-mist">эхлээд</b> signal-ийг тооцоолно. AI түүний
              дараа зөвхөн “яагаад” гэдгийг хүн унших хэлбэрээр тайлбарлана — output нь зөвхөн <i>text</i>.
            </p>
          </div>
        </div>
      </Reveal>

      {/* rules */}
      <div className="space-y-2">
        {RULES.map((rule, i) => (
          <Reveal key={rule.id} delay={Math.min(i * 50, 200)}>
            <div className="group grid gap-3 rounded-md border border-line bg-deep/50 p-4 transition-colors hover:border-edge sm:grid-cols-[190px_1fr] sm:gap-5">
              <div className="flex items-start gap-3 sm:flex-col sm:gap-2">
                <span className="font-mono text-[11px] text-cy">{rule.id}</span>
                <div className="flex-1 sm:flex-none">
                  <p className="font-display text-[13px] font-semibold text-mist">{rule.name}</p>
                  <div className="mt-1.5 flex items-center gap-2">
                    <div className="h-1.5 w-24 overflow-hidden rounded-sm bg-panel2">
                      <div className="h-full rounded-sm bg-cy/70 transition-[width] duration-700" style={{ width: `${rule.weight * 5}%` }} />
                    </div>
                    <span className="font-mono text-[11px] text-fog">жин {rule.weight}</span>
                  </div>
                </div>
              </div>
              <div className="grid gap-2 text-[13.5px] leading-relaxed sm:grid-cols-2">
                <p className="rounded-sm border border-buy/20 bg-buy/[0.04] px-3 py-2 text-fog">
                  <span className="mr-2 font-mono text-[10.5px] font-semibold text-buy">BULLISH</span>
                  {rule.bull}
                </p>
                <p className="rounded-sm border border-sell/20 bg-sell/[0.04] px-3 py-2 text-fog">
                  <span className="mr-2 font-mono text-[10.5px] font-semibold text-sell">BEARISH</span>
                  {rule.bear}
                </p>
              </div>
            </div>
          </Reveal>
        ))}
      </div>
      <Reveal delay={100}>
        <p className="mt-3 font-mono text-[11.5px] text-dim">
          * Аль ч нөхцөл биелээгүй дүрэм жингээ WAIT талд бичнэ · RSI 70+/30− үед оноо биш, зөвхөн warning үүснэ.
        </p>
      </Reveal>

      {/* formula + demo */}
      <div className="mt-10 grid gap-8 lg:grid-cols-[0.92fr_1.08fr] lg:gap-10">
        <div className="min-w-0">
          <Reveal>
            <CodeBlock title="scoring_engine.py · дүрэм + босго" lang="python" code={FORMULA_TXT} />
          </Reveal>
          <Reveal delay={120}>
            <div className="mt-5">
              <Callout tone="cy" title="Яагаад ийм босго вэ?">
                <b className="text-mist">55+</b> оноо — дүрмүүдийн дийлэнх нь нэг чиглэлд байна гэсэн үг.{" "}
                <b className="text-mist">25+</b> зөрүү — эсрэг талын дохио сул байх ёстой.{" "}
                <b className="text-mist">RR ≥ 1.5</b> — эрсдэл/өгөөж хүлээн зөвшөөрөхгүй бол signal биш, WAIT.
              </Callout>
            </div>
          </Reveal>
        </div>
        <div className="min-w-0">
          <Reveal delay={80}>
            <p className="mb-3 flex items-center justify-between font-mono text-[11px] tracking-[0.18em] text-dim uppercase">
              <span>▸ Interactive demo — дүрмийг амьдаар нь хар</span>
              <span className="text-cy">client-side</span>
            </p>
          </Reveal>
          <Demo />
        </div>
      </div>

      {/* 78/12/10 example */}
      <Reveal>
        <div className="mt-10">
          <p className="mb-4 font-mono text-[11px] tracking-[0.18em] text-dim uppercase">
            ▸ Жишээ тооцоолол — EUR/USD 1H → BUY 78 / SELL 12 / WAIT 10
          </p>
          <div className="overflow-x-auto rounded-md border border-line bg-deep/60">
            <table className="w-full min-w-[640px] text-left">
              <thead>
                <tr className="border-b border-line bg-panel">
                  {["Дүрэм", "Жин", "→ BUY", "→ SELL", "→ WAIT", "Тайлбар"].map((h) => (
                    <th key={h} className="px-4 py-2.5 font-mono text-[10.5px] font-medium tracking-[0.15em] text-dim uppercase">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {EXAMPLE_78.map((row) => (
                  <tr key={row.rule} className="transition-colors hover:bg-panel">
                    <td className="px-4 py-2.5 font-mono text-[12.5px] text-mist">{row.rule}</td>
                    <td className="px-4 py-2.5 font-mono text-[12.5px] text-fog">{row.w}</td>
                    <td className="px-4 py-2.5 font-mono text-[12.5px] text-buy">{row.bull > 0 ? `+${row.bull}` : "·"}</td>
                    <td className="px-4 py-2.5 font-mono text-[12.5px] text-sell">{row.bear > 0 ? `−${row.bear}` : "·"}</td>
                    <td className="px-4 py-2.5 font-mono text-[12.5px] text-wait">{row.neutral > 0 ? `~${row.neutral}` : "·"}</td>
                    <td className="px-4 py-2.5 text-[13px] text-fog">{row.detail}</td>
                  </tr>
                ))}
                <tr className="border-t-2 border-edge bg-panel/80">
                  <td className="px-4 py-3 font-display text-[12.5px] font-semibold text-mist">НИЙЛБЭР</td>
                  <td className="px-4 py-3 font-mono text-[13px] font-semibold text-mist">100</td>
                  <td className="px-4 py-3 font-mono text-[13px] font-bold text-buy">78</td>
                  <td className="px-4 py-3 font-mono text-[13px] font-bold text-sell">12</td>
                  <td className="px-4 py-3 font-mono text-[13px] font-bold text-wait">10</td>
                  <td className="px-4 py-3 text-[13px] text-fog">
                    78 ≥ 55 ✓ · зөрүү 66 ≥ 25 ✓ · RR 1.73 ≥ 1.5 ✓ → <b className="text-buy">Signal: BUY</b>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </Reveal>
    </section>
  );
}

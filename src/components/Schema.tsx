import type { ReactNode } from "react";
import { DDL_SQL, DISCLAIMER, PHASES, SECURITY, TABLES } from "../data";
import { Callout, Chip, CodeBlock, IcCheck, Reveal, SectionHead } from "./bits";

/* ================= 07 · database schema ================= */

const BADGE_CLS: Record<string, string> = {
  PK: "border-wait/45 text-wait",
  FK: "border-cy/45 text-cy",
  UQ: "border-buy/45 text-buy",
  IDX: "border-line text-fog",
};

export function DbSection(): ReactNode {
  return (
    <section id="db" className="scroll-mt-28">
      <SectionHead
        num="07"
        kicker="PostgreSQL 15"
        title="Database схем"
        desc="6 хүснэгт. candles нь хамгийн их уншигддаг тул pair × timeframe × ts unique index + сарын partition-тай. signals нь шалтгаан ба indicator snapshot-ийг JSONB-аар хадгална."
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {TABLES.map((t, i) => (
          <Reveal key={t.name} delay={Math.min(i * 60, 240)}>
            <div className="group flex h-full flex-col overflow-hidden rounded-md border border-line bg-deep/60 transition-all duration-300 hover:-translate-y-1 hover:border-edge hover:shadow-[0_18px_40px_-24px_rgba(0,0,0,0.9)]">
              <div className="border-b border-line bg-panel px-4 py-3">
                <p className="font-mono text-[13px] font-semibold text-cy">
                  <span className="mr-1.5 text-dim">▤</span>
                  {t.name}
                </p>
                <p className="mt-1 text-[12px] leading-snug text-dim">{t.desc}</p>
              </div>
              <div className="flex-1 divide-y divide-line/60 px-4 py-1">
                {t.cols.map((c) => (
                  <div key={c.c} className="flex items-center gap-2 py-[7px] transition-colors hover:bg-panel/60">
                    <span className="min-w-0 flex-1 truncate font-mono text-[11.5px] text-mist">{c.c}</span>
                    <span className="shrink-0 font-mono text-[10.5px] text-dim">{c.t}</span>
                    {(c.b ?? []).map((b) => (
                      <span key={b} className={`shrink-0 rounded-sm border px-1 py-px font-mono text-[9px] ${BADGE_CLS[b]}`}>
                        {b}
                      </span>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </Reveal>
        ))}
      </div>
      <Reveal delay={120}>
        <CodeBlock title="migrations/0003_candles_signals.sql" lang="sql" code={DDL_SQL} className="mt-8" />
      </Reveal>
    </section>
  );
}

/* ================= 08 · roadmap ================= */

export function PhasesSection(): ReactNode {
  return (
    <section id="phases" className="scroll-mt-28">
      <SectionHead
        num="08"
        kicker="Roadmap"
        title="Хөгжүүлэлтийн үе шатууд"
        desc="Жижиг, шалгаж болох 9 phase-д хуваав. Phase бүр дуусахад ажилладаг, deploy хийж болох хэсэг үлдэнэ. Нийт хэмжээ ≈ 37 ажлын өдөр."
      />
      <div className="relative">
        <div className="absolute top-3 bottom-3 left-[21px] w-px bg-gradient-to-b from-buy/60 via-line to-sell/40 sm:left-[25px]" />
        <div className="space-y-5">
          {PHASES.map((p, i) => (
            <Reveal key={p.n} delay={Math.min(i * 50, 200)}>
              <div className="group relative flex gap-4 sm:gap-6">
                <div
                  className={`relative z-10 flex h-11 w-11 shrink-0 items-center justify-center rounded-sm border font-display text-[13px] font-bold transition-colors sm:h-[52px] sm:w-[52px] sm:text-[15px] ${
                    p.n === 0
                      ? "border-buy/60 bg-buy/10 text-buy"
                      : "border-edge bg-panel text-cy group-hover:border-cy/70"
                  }`}
                >
                  P{p.n}
                </div>
                <div className="min-w-0 flex-1 rounded-md border border-line bg-deep/50 p-4 transition-all duration-300 group-hover:translate-x-1 group-hover:border-edge sm:p-5">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                    <h3 className="font-display text-[15px] font-semibold text-mist">{p.title}</h3>
                    <Chip tone={p.n === 0 ? "buy" : "fog"}>{p.days}</Chip>
                    {p.n === 0 ? <Chip tone="cy">◉ эхлэх цэг</Chip> : null}
                  </div>
                  <p className="mt-1 text-[13.5px] text-fog italic">{p.goal}</p>
                  <ul className="mt-3 grid gap-x-6 gap-y-1.5 md:grid-cols-2">
                    {p.tasks.map((t) => (
                      <li key={t} className="flex items-start gap-2.5 text-[13.5px] leading-snug text-fog">
                        <span className="mt-[5px] h-1.5 w-1.5 shrink-0 rotate-45 bg-cy/70" />
                        {t}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ================= 09 · security ================= */

export function SecuritySection(): ReactNode {
  return (
    <section id="security" className="scroll-mt-28">
      <SectionHead
        num="09"
        kicker="Security & QA"
        title="Аюулгүй байдал · чанарын checklist"
        desc="Production-ready гэдэг нь эдгээр 12 зүйл code review бүрт шалгагдана гэсэн үг."
      />
      <Reveal>
        <div className="grid gap-2 sm:grid-cols-2">
          {SECURITY.map((s, i) => (
            <div
              key={s}
              className="group flex items-start gap-3 rounded-sm border border-line bg-deep/50 px-4 py-3 transition-all duration-200 hover:translate-x-1 hover:border-buy/40"
            >
              <span className="mt-0.5 shrink-0 text-buy">
                <IcCheck />
              </span>
              <span className="text-[13.5px] leading-snug text-fog">
                <span className="mr-2 font-mono text-[10.5px] text-dim">{String(i + 1).padStart(2, "0")}</span>
                {s}
              </span>
            </div>
          ))}
        </div>
      </Reveal>
      <Reveal delay={140}>
        <div className="mt-6">
          <Callout tone="sell" title="Эрсдэлийн сануулга — UI-д үргэлж харагдана">
            {DISCLAIMER}
          </Callout>
        </div>
      </Reveal>
    </section>
  );
}

/* ================= footer ================= */

export function Footer(): ReactNode {
  return (
    <footer className="mt-24 border-t border-line bg-deep/60">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-5 py-12 sm:px-8 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="font-display text-xl font-bold text-mist">
            FOREX <span className="stroke-text">ANALYZER</span>
          </p>
          <p className="mt-2 font-mono text-[11.5px] leading-relaxed text-dim">
            Technical blueprint v1.0 · Next.js 15 × FastAPI × PostgreSQL
            <br />
            signal: deterministic · explanation: AI · risk: always on
          </p>
        </div>
        <div className="md:text-right">
          <p className="font-mono text-[10.5px] tracking-[0.2em] text-dim uppercase">Дараагийн алхам</p>
          <p className="mt-2 inline-flex items-center gap-2 rounded-sm border border-buy/40 bg-buy/[0.06] px-4 py-2 font-mono text-[12.5px] text-buy">
            <span className="led inline-block h-1.5 w-1.5 rounded-full bg-buy" />
            Phase 0 → GitHub repo + docker-compose
          </p>
          <p className="mt-3 max-w-xs text-[11.5px] leading-relaxed text-dim md:ml-auto">
            Энэ баримт нь хөрөнгө оруулалтын зөвлөгөө биш, системийн техникийн төлөвлөгөө юм.
          </p>
        </div>
      </div>
    </footer>
  );
}

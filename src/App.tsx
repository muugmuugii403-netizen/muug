import type { ReactNode } from "react";
import { NAV, NAV1, STEP2_CURL, STEP2_ENDPOINTS, STEP2_FILES } from "./data";
import { useScrollSpy } from "./hooks";
import { Callout, Chip, CodeBlock, MethodBadge, Reveal, SectionHead } from "./components/bits";
import { TickerTape } from "./components/Header";
import {
  ContractSection,
  FilesSection,
  NextStepsSection,
  PkgsSection,
  RunSection,
  StepMasthead,
} from "./components/Scaffold";
import { ArchitectureSection, FlowSection, FolderSection } from "./components/Architecture";
import { ApiSection, DataSection } from "./components/ApiData";
import { ScoringSection } from "./components/Scoring";
import { DbSection, Footer, PhasesSection, SecuritySection } from "./components/Schema";

/* ================= Step 2 · market data layer ================= */

function MarketDataSection(): ReactNode {
  return (
    <section id="s2-layer" className="scroll-mt-28">
      <SectionHead
        num="06"
        kicker="Step 2 · Done"
        title="Market data layer — Twelve Data"
        desc="Backend: router → service → provider давхарга бүхий market data систем. 7 pair, зөвхөн 5min/15min, timeout + retry + rate-limit + validation + 20 гаруй тест. Frontend: pair/timeframe сонголт, candlestick chart, амьд quote самбар."
      />
      <Reveal>
        <div className="overflow-x-auto rounded-md border border-line bg-deep/60">
          <table className="w-full min-w-[620px] text-left">
            <thead>
              <tr className="border-b border-line bg-panel">
                {["Method", "Endpoint", "Статус", "Тайлбар"].map((h) => (
                  <th key={h} className="px-4 py-2.5 font-mono text-[10.5px] font-medium tracking-[0.15em] text-dim uppercase">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {STEP2_ENDPOINTS.map((e) => (
                <tr key={e.path} className="transition-colors hover:bg-panel">
                  <td className="px-4 py-3">
                    <MethodBadge m={e.method} />
                  </td>
                  <td className="px-4 py-3 font-mono text-[12px] text-mist">{e.path}</td>
                  <td className="px-4 py-3 font-mono text-[11.5px] text-cy">{e.status}</td>
                  <td className="px-4 py-3 text-[13px] text-fog">{e.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Reveal>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.08fr_0.92fr]">
        <div className="min-w-0">
          <Reveal>
            <CodeBlock title="Шалгах команд" lang="bash" code={STEP2_CURL} />
          </Reveal>
          <Reveal delay={120}>
            <div className="mt-5 space-y-4">
              <Callout tone="cy" title="Rate-limit хамгаалалт">
                Twelve Data free plan: <b className="text-mist">8 credit/мин · 800/өдөр</b>. Хамгаалалт гурван үе: backend
                TTL cache (candles 30с, quote 15с) → 429 ирвэл <b className="text-mist">Retry-After</b>-г дээш дамжуулна →
                frontend auto-refresh 20с. 5xx/сүлжээнд retry ×3 (0.5→1→2с backoff), key лог-д хэзээ ч хэвлэгдэхгүй.
              </Callout>
              <Callout tone="wait" title="SAMPLE горим">
                <b className="text-mist">TWELVE_DATA_API_KEY</b> хоосон үед детерминист sample өгөгдөл ашиглагдана — бүх
                хариунд <b className="text-mist">source: "sample"</b>, UI-д шар SAMPLE тэмдэг. Бодит key .env-д ороход LIVE
                горим руу автоматаар шилжинэ. Энэ горим нь Twelve Data docs-д заасан хариуны форматтай ижил.
              </Callout>
            </div>
          </Reveal>
        </div>
        <Reveal delay={80}>
          <div className="overflow-hidden rounded-md border border-line bg-deep/60">
            <div className="flex items-center justify-between border-b border-line bg-panel px-4 py-2.5">
              <p className="font-display text-[13px] font-semibold text-mist">Өөрчлөгдсөн файлууд</p>
              <Chip tone="buy">+10 шинэ · ~7 засвар</Chip>
            </div>
            <ul className="max-h-[430px] divide-y divide-line overflow-y-auto">
              {STEP2_FILES.map((f) => (
                <li key={f.path} className="group px-4 py-2.5 transition-all duration-200 hover:translate-x-1 hover:bg-panel">
                  <p className="font-mono text-[12px] font-medium text-buy">{f.path}</p>
                  <p className="mt-0.5 text-[12.5px] leading-relaxed text-fog">{f.role}</p>
                </li>
              ))}
            </ul>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

const IDS: string[] = [...NAV1.map((n) => n.id), ...NAV.map((n) => n.id)];

function MobileNav({ active }: { active: string }): ReactNode {
  return (
    <nav className="sticky top-0 z-40 border-b border-line bg-ink/95 backdrop-blur-md lg:hidden">
      <div className="flex gap-1.5 overflow-x-auto px-4 py-2 [scrollbar-width:none]">
        {NAV1.map((n) => (
          <a
            key={n.id}
            href={`#${n.id}`}
            className={`shrink-0 rounded-sm border px-2.5 py-1 font-mono text-[11px] transition-colors ${
              active === n.id ? "border-cy/60 bg-cy/10 text-cy" : "border-line text-dim hover:border-edge hover:text-fog"
            }`}
          >
            {n.num}
          </a>
        ))}
        <a href="#arch" className="shrink-0 rounded-sm border border-line px-2.5 py-1 font-mono text-[11px] text-dim">
          step 0 ↓
        </a>
      </div>
    </nav>
  );
}

function SideRail({ active }: { active: string }): ReactNode {
  const linkCls = (id: string): string =>
    `group flex items-center gap-2.5 border-l-2 py-[7px] pl-3.5 transition-all duration-200 ${
      active === id ? "border-cy bg-cy/[0.05] text-mist" : "border-line text-dim hover:border-edge hover:text-fog"
    }`;
  return (
    <nav className="sticky top-24 hidden flex-col lg:flex">
      <p className="mb-3 font-mono text-[10px] tracking-[0.25em] text-cy uppercase">Step 1 · scaffold</p>
      {NAV1.map((n) => (
        <a key={n.id} href={`#${n.id}`} className={linkCls(n.id)}>
          <span className={`font-mono text-[10.5px] ${active === n.id ? "text-cy" : "text-dim"}`}>{n.num}</span>
          <span className="text-[12.5px] transition-transform duration-200 group-hover:translate-x-0.5">{n.label}</span>
        </a>
      ))}
      <p className="mt-6 mb-3 font-mono text-[10px] tracking-[0.25em] text-dim uppercase">Step 0 · blueprint</p>
      {NAV.map((n) => (
        <a key={n.id} href={`#${n.id}`} className={linkCls(n.id)}>
          <span className={`font-mono text-[10.5px] ${active === n.id ? "text-cy" : "text-dim"}`}>{n.num}</span>
          <span className="text-[12px] opacity-80 transition-transform duration-200 group-hover:translate-x-0.5">{n.label}</span>
        </a>
      ))}
    </nav>
  );
}

export default function App(): ReactNode {
  const active = useScrollSpy(IDS);
  return (
    <div className="relative min-h-screen overflow-x-clip">
      {/* ambient background */}
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="bg-grid absolute inset-0" />
        <div
          className="drift absolute -top-40 left-1/4 h-[520px] w-[720px] rounded-full opacity-60"
          style={{ background: "radial-gradient(closest-side, rgba(69,214,228,0.09), transparent 70%)" }}
        />
        <div
          className="drift absolute top-1/3 -right-40 h-[480px] w-[640px] rounded-full opacity-50"
          style={{ background: "radial-gradient(closest-side, rgba(47,208,140,0.07), transparent 70%)", animationDelay: "-7s" }}
        />
      </div>
      <div className="noise pointer-events-none fixed inset-0 z-[70]" />

      <TickerTape />
      <MobileNav active={active} />
      <StepMasthead />

      <div className="mx-auto w-full max-w-6xl px-5 sm:px-8">
        <div className="grid gap-10 lg:grid-cols-[200px_1fr] lg:gap-14">
          <aside className="min-w-0">
            <SideRail active={active} />
          </aside>
          <main className="min-w-0 space-y-24">
            <FilesSection />
            <RunSection />
            <PkgsSection />
            <ContractSection />
            <NextStepsSection />
            <MarketDataSection />

            {/* ---- Хавсралт: Step 0 blueprint ---- */}
            <Reveal>
              <div className="border-t border-dashed border-edge pt-10">
                <p className="font-mono text-[11px] tracking-[0.24em] text-dim uppercase">Хавсралт</p>
                <h2 className="font-display mt-2 text-xl font-bold text-mist sm:text-2xl">
                  Step 0 — Архитектурын blueprint
                </h2>
                <p className="mt-2 max-w-2xl text-[14px] leading-relaxed text-fog">
                  Step 1-ийн тулгуур болсон анхны баримт: архитектур, folder бүтэц, API төлөвлөгөө, market data эх
                  сурвалж, scoring дүрэм, DB схем, phase хуваарь, security checklist — бүгд доор хэвээрээ.
                </p>
              </div>
            </Reveal>
            <ArchitectureSection />
            <FolderSection />
            <FlowSection />
            <ApiSection />
            <DataSection />
            <ScoringSection />
            <DbSection />
            <PhasesSection />
            <SecuritySection />
          </main>
        </div>
      </div>

      <Footer />
    </div>
  );
}

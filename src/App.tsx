import type { ReactNode } from "react";
import { NAV, NAV1 } from "./data";
import { useScrollSpy } from "./hooks";
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
import { Reveal } from "./components/bits";

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

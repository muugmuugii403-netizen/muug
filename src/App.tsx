import type { ReactNode } from "react";
import { NAV } from "./data";
import { useScrollSpy } from "./hooks";
import { Masthead, TickerTape } from "./components/Header";
import { ArchitectureSection, FlowSection, FolderSection } from "./components/Architecture";
import { ApiSection, DataSection } from "./components/ApiData";
import { ScoringSection } from "./components/Scoring";
import { DbSection, Footer, PhasesSection, SecuritySection } from "./components/Schema";

const IDS: string[] = NAV.map((n) => n.id);

/* mobile section nav */
function MobileNav({ active }: { active: string }): ReactNode {
  return (
    <nav className="sticky top-0 z-40 border-b border-line bg-ink/90 backdrop-blur-md lg:hidden">
      <div className="flex gap-1.5 overflow-x-auto px-4 py-2 [scrollbar-width:none]">
        {NAV.map((n) => (
          <a
            key={n.id}
            href={`#${n.id}`}
            className={`shrink-0 rounded-sm border px-2.5 py-1 font-mono text-[11px] transition-colors ${
              active === n.id
                ? "border-cy/60 bg-cy/10 text-cy"
                : "border-line text-dim hover:border-edge hover:text-fog"
            }`}
          >
            {n.num}
          </a>
        ))}
      </div>
    </nav>
  );
}

/* desktop side rail */
function SideRail({ active }: { active: string }): ReactNode {
  return (
    <nav className="sticky top-24 hidden flex-col gap-0.5 lg:flex">
      <p className="mb-3 font-mono text-[10px] tracking-[0.25em] text-dim uppercase">Агуулга</p>
      {NAV.map((n) => (
        <a
          key={n.id}
          href={`#${n.id}`}
          className={`group flex items-center gap-2.5 border-l-2 py-[7px] pl-3.5 transition-all duration-200 ${
            active === n.id
              ? "border-cy bg-cy/[0.05] text-mist"
              : "border-line text-dim hover:border-edge hover:text-fog"
          }`}
        >
          <span className={`font-mono text-[10.5px] ${active === n.id ? "text-cy" : "text-dim"}`}>{n.num}</span>
          <span className="text-[12.5px] transition-transform duration-200 group-hover:translate-x-0.5">{n.label}</span>
        </a>
      ))}
      <div className="mt-6 rounded-sm border border-line bg-deep/60 p-3">
        <p className="font-mono text-[10px] tracking-wider text-dim uppercase">Нийт хэмжээ</p>
        <p className="mt-1 font-display text-lg font-bold text-buy">≈ 37 өдөр</p>
        <p className="font-mono text-[10.5px] text-dim">9 phase · 1 хүн / баг</p>
      </div>
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
      <Masthead />

      <div className="mx-auto w-full max-w-6xl px-5 sm:px-8">
        <div className="grid gap-10 lg:grid-cols-[200px_1fr] lg:gap-14">
          <aside className="min-w-0">
            <SideRail active={active} />
          </aside>
          <main className="min-w-0 space-y-24">
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

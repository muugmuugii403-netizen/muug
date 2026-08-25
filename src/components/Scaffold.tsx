import { useMemo, useState, type ReactNode } from "react";
import {
  CHECKLIST,
  DISCLAIMER,
  MANIFEST,
  NEXT_STEPS,
  PKG_BACK,
  PKG_FRONT,
  RUN_TABS,
  SCAFFOLD_TREE,
  SCOPE_OUT,
  STEP1_ENDPOINTS,
  STEP1_ERROR_422_JSON,
  STEP1_ERROR_501_JSON,
  STEP1_HEALTH_JSON,
  type SNode,
} from "../data";
import { useScramble } from "../hooks";
import {
  Callout,
  Chip,
  CodeBlock,
  IcCheck,
  IcChevron,
  IcCross,
  IcFile,
  IcFolder,
  MethodBadge,
  Reveal,
  SectionHead,
} from "./bits";

/* ================= terminal card ================= */

const TERM_LINES: Array<{ text: string; cls: string }> = [
  { text: "$ make setup", cls: "text-mist" },
  { text: "✔ backend: venv + pip install -r requirements.txt", cls: "text-buy" },
  { text: "✔ __init__.py × 7 package үүслээ", cls: "text-buy" },
  { text: "✔ backend/.env ← .env.example", cls: "text-buy" },
  { text: "✔ frontend: npm install + .env.local ← .env.example", cls: "text-buy" },
  { text: "$ make dev-api &          # :8000", cls: "text-mist" },
  { text: "$ make dev-web &          # :3000", cls: "text-mist" },
  { text: "$ curl :8000/api/v1/health", cls: "text-mist" },
  { text: '{"status":"ok","version":"v1","env":"dev"}   ← 200', cls: "text-buy" },
  { text: '$ curl -X POST :8000/api/v1/analysis \\', cls: "text-mist" },
  { text: '    -d \'{"symbol":"EUR/USD","timeframe":"1h"}\'', cls: "text-mist" },
  { text: '{"error":"not_implemented",…}   ← 501 (contract ёсоор зөв)', cls: "text-wait" },
];

function TerminalCard(): ReactNode {
  return (
    <div className="overflow-hidden rounded-md border border-edge bg-deep shadow-[0_24px_70px_-30px_rgba(0,0,0,0.85)]">
      <div className="flex items-center justify-between border-b border-line bg-panel px-4 py-2.5">
        <div className="flex items-center gap-3">
          <span className="flex gap-1.5">
            <i className="h-2.5 w-2.5 rounded-full bg-sell/70" />
            <i className="h-2.5 w-2.5 rounded-full bg-wait/70" />
            <i className="h-2.5 w-2.5 rounded-full bg-buy/70" />
          </span>
          <span className="font-mono text-[11.5px] text-fog">forex-analyzer · zsh</span>
        </div>
        <span className="led h-2 w-2 rounded-full bg-buy" />
      </div>
      <div className="p-4 font-mono text-[12px] leading-[1.85] sm:p-5">
        {TERM_LINES.map((l, i) => (
          <Reveal key={i} delay={i * 70}>
            <div className={l.cls}>{l.text}</div>
          </Reveal>
        ))}
        <span className="blink mt-1 inline-block h-3.5 w-[7px] translate-y-[2px] bg-cy" />
      </div>
    </div>
  );
}

/* ================= masthead ================= */

const STATS: Array<[string, string, string]> = [
  ["21", "файл үүслээ", "text-cy"],
  ["11", "frontend", "text-cy"],
  ["8", "backend", "text-buy"],
  ["2", "root", "text-wait"],
  ["5", "pytest тест ✓", "text-buy"],
];

export function StepMasthead(): ReactNode {
  const word = useScramble("SCAFFOLD", true);
  return (
    <header className="relative mx-auto w-full max-w-6xl px-5 pt-12 pb-14 sm:px-8 sm:pt-16">
      <div className="grid items-center gap-10 lg:grid-cols-[1.04fr_0.96fr] lg:gap-12">
        <div>
          <Reveal>
            <p className="flex flex-wrap items-center gap-2.5 font-mono text-[11px] tracking-[0.24em] text-cy uppercase">
              <span className="led inline-block h-2 w-2 rounded-full bg-buy" />
              Хөгжүүлэлтийн тэмдэглэл · Step 01 · дууссан
            </p>
          </Reveal>
          <h1 className="font-display mt-5 leading-[0.98] font-extrabold">
            <span className="block text-[40px] text-mist sm:text-[58px]">PROJECT</span>
            <span className="stroke-text block text-[40px] tracking-tight sm:text-[58px]">{word}</span>
          </h1>
          <Reveal delay={120}>
            <p className="mt-5 max-w-xl text-[15px] leading-relaxed text-fog">
              Next.js 15 frontend ба FastAPI backend-ийн үндсэн бүтэц бэлэн: <b className="text-mist">strict TypeScript</b>,{" "}
              <b className="text-mist">type-hint бүрэн Python</b>, нэгдсэн <b className="text-buy">error contract</b>, timeout/retry
              бүхий API холболт. Architecture өөрчлөгдөөгүй — гадаад API болон алгоритм зориудаар холбогдоогүй.
            </p>
          </Reveal>
          <Reveal delay={200}>
            <div className="mt-6 flex flex-wrap gap-2">
              <Chip tone="buy">21 файл</Chip>
              <Chip tone="cy">strict TS + type hints</Chip>
              <Chip tone="wait">.env.example ×2</Chip>
              <Chip tone="fog">secret hardcode-гүй</Chip>
              <Chip tone="sell">AI / algo / data API — холбогдоогүй</Chip>
            </div>
          </Reveal>
        </div>
        <Reveal delay={150}>
          <TerminalCard />
        </Reveal>
      </div>

      {/* stats */}
      <Reveal delay={100}>
        <div className="mt-12 grid grid-cols-2 overflow-hidden rounded-md border border-line bg-deep/70 sm:grid-cols-5">
          {STATS.map(([v, l, c], i) => (
            <div
              key={l}
              className={`group flex items-baseline gap-2.5 px-5 py-4 transition-colors hover:bg-panel ${
                i > 0 ? "border-l border-line" : ""
              } ${i >= 2 ? "border-t border-line sm:border-t-0" : ""} ${i === 2 ? "border-l-0 sm:border-l" : ""} ${
                i === 4 ? "col-span-2 border-t border-line sm:col-span-1 sm:border-t-0" : ""
              }`}
            >
              <span className={`font-display text-2xl font-bold ${c} transition-transform duration-300 group-hover:-translate-y-0.5`}>
                {v}
              </span>
              <span className="font-mono text-[11px] text-dim">{l}</span>
            </div>
          ))}
        </div>
      </Reveal>

      {/* checklist + scope out */}
      <div className="mt-10 grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <Reveal>
          <div className="rounded-md border border-line bg-deep/60 p-5">
            <p className="font-mono text-[11px] tracking-[0.2em] text-dim uppercase">Step 1-ийн шаардлагууд ✓</p>
            <ul className="mt-4 grid gap-x-6 gap-y-3 sm:grid-cols-2">
              {CHECKLIST.map(([req, how]) => (
                <li key={req} className="group flex gap-2.5">
                  <span className="mt-0.5 shrink-0 text-buy">
                    <IcCheck />
                  </span>
                  <div>
                    <p className="text-[13.5px] font-medium text-mist">{req}</p>
                    <p className="text-[12px] leading-relaxed text-dim">{how}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </Reveal>
        <Reveal delay={120}>
          <Callout tone="sell" title="Энэ алхамд хийгдээгүй — зориудаар">
            <ul className="space-y-2">
              {SCOPE_OUT.map((s) => (
                <li key={s} className="flex gap-2">
                  <span className="mt-0.5 shrink-0 text-sell">
                    <IcCross className="h-3.5 w-3.5" />
                  </span>
                  <span>{s}</span>
                </li>
              ))}
            </ul>
          </Callout>
        </Reveal>
      </div>
    </header>
  );
}

/* ================= 01 · files ================= */

function collectDirs(node: SNode, path: string): string[] {
  if (node.t !== "d") return [];
  const out = [path];
  (node.c ?? []).forEach((c, i) => out.push(...collectDirs(c, `${path}-${i}`)));
  return out;
}

function TreeRow({
  node,
  path,
  depth,
  expanded,
  toggle,
}: {
  node: SNode;
  path: string;
  depth: number;
  expanded: Set<string>;
  toggle: (p: string) => void;
}): ReactNode {
  const isDir = node.t === "d";
  const isOpen = expanded.has(path);
  const isEnv = node.n.startsWith(".env");
  return (
    <div>
      {isDir ? (
        <button
          type="button"
          onClick={() => toggle(path)}
          className="flex w-full items-center gap-2 rounded-sm py-[3.5px] pr-2 text-left transition-colors hover:bg-panel"
          style={{ paddingLeft: depth * 18 + 6 }}
        >
          <IcChevron open={isOpen} />
          <IcFolder open={isOpen} />
          <span className="font-mono text-[12.5px] font-medium text-mist">{node.n}</span>
          {node.note ? (
            <span className="ml-auto hidden truncate pl-4 font-mono text-[11px] text-dim md:block">{node.note}</span>
          ) : null}
        </button>
      ) : (
        <div
          className="flex items-center gap-2 rounded-sm py-[3.5px] pr-2 transition-colors hover:bg-panel"
          style={{ paddingLeft: depth * 18 + 6 + 18 }}
        >
          <IcFile />
          <span className={`font-mono text-[12.5px] ${isEnv ? "text-wait" : "text-fog"}`}>{node.n}</span>
          {node.note ? (
            <span className="ml-auto hidden truncate pl-4 font-mono text-[11px] text-dim md:block">{node.note}</span>
          ) : null}
        </div>
      )}
      {isDir && isOpen && node.c
        ? node.c.map((child, i) => (
            <TreeRow key={child.n} node={child} path={`${path}-${i}`} depth={depth + 1} expanded={expanded} toggle={toggle} />
          ))
        : null}
    </div>
  );
}

const AREAS = [
  { id: "all", label: "Бүгд" },
  { id: "frontend", label: "Frontend" },
  { id: "backend", label: "Backend" },
  { id: "root", label: "Root" },
] as const;
type AreaId = (typeof AREAS)[number]["id"];

const AREA_COLOR: Record<string, string> = { frontend: "text-cy", backend: "text-buy", root: "text-wait" };

export function FilesSection(): ReactNode {
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(collectDirs(SCAFFOLD_TREE, "0")));
  const [area, setArea] = useState<AreaId>("all");
  const toggle = (p: string): void =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(p)) next.delete(p);
      else next.add(p);
      return next;
    });
  const filtered = useMemo(() => (area === "all" ? MANIFEST : MANIFEST.filter((m) => m.area === area)), [area]);

  return (
    <section id="s1-files" className="scroll-mt-28">
      <SectionHead
        num="01"
        kicker="Files Created"
        title="Ямар файл үүсгэсэн, ямар үүрэгтэй"
        desc="Нийт 21 файл: frontend 11 · backend 8 · root 2. Модыг нудаж хумина, баруун талд файлуудыг давхаргаар шүүж харна."
      />
      <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        <Reveal>
          <div className="overflow-hidden rounded-md border border-line bg-deep/60">
            <div className="flex items-center justify-between border-b border-line bg-panel px-3.5 py-2">
              <span className="font-mono text-[11px] tracking-wider text-dim uppercase">git@github.com:you/forex-analyzer.git</span>
              <Chip tone="buy">21 файл</Chip>
            </div>
            <div className="py-2">
              <TreeRow node={SCAFFOLD_TREE} path="0" depth={0} expanded={expanded} toggle={toggle} />
            </div>
          </div>
        </Reveal>
        <Reveal delay={100}>
          <div className="overflow-hidden rounded-md border border-line bg-deep/60">
            <div className="flex gap-1.5 border-b border-line bg-panel px-3 py-2">
              {AREAS.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => setArea(a.id)}
                  className={`rounded-sm border px-2.5 py-1 font-mono text-[11px] transition-colors ${
                    area === a.id ? "border-cy/60 bg-cy/10 text-mist" : "border-line text-dim hover:border-edge hover:text-fog"
                  }`}
                >
                  {a.label}
                  <span className="ml-1.5 text-dim">
                    {a.id === "all" ? MANIFEST.length : MANIFEST.filter((m) => m.area === a.id).length}
                  </span>
                </button>
              ))}
            </div>
            <ul className="max-h-[520px] divide-y divide-line overflow-y-auto">
              {filtered.map((m) => (
                <li key={m.path} className="group px-4 py-2.5 transition-all duration-200 hover:translate-x-1 hover:bg-panel">
                  <p className={`font-mono text-[12.5px] font-medium ${AREA_COLOR[m.area] ?? "text-fog"}`}>{m.path}</p>
                  <p className="mt-0.5 text-[12.5px] leading-relaxed text-fog">{m.role}</p>
                </li>
              ))}
            </ul>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ================= 02 · run ================= */

function CopyBtn({ text }: { text: string }): ReactNode {
  const [copied, setCopied] = useState(false);
  const copy = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard unavailable */
    }
  };
  return (
    <button
      type="button"
      onClick={() => void copy()}
      className={`rounded-sm border px-2.5 py-1 font-mono text-[11px] transition-colors ${
        copied ? "border-buy/60 bg-buy/10 text-buy" : "border-line text-dim hover:border-edge hover:text-fog"
      }`}
    >
      {copied ? "✓ хууллаа" : "⧉ хуулах"}
    </button>
  );
}

export function RunSection(): ReactNode {
  const [tab, setTab] = useState("setup");
  const active = RUN_TABS.find((t) => t.id === tab) ?? RUN_TABS[0];
  return (
    <section id="s1-run" className="scroll-mt-28">
      <SectionHead
        num="02"
        kicker="How To Run"
        title="Яаж ажиллуулах"
        desc="Гурван команд л хэрэгтэй: make setup → make dev-api → make dev-web. Дэлгэрэнгүй бүх хувилбар (Windows, makeгүй, гараар) README.md §3-т бий."
      />
      <Reveal>
        <div className="flex flex-wrap gap-1.5">
          {RUN_TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`rounded-sm border px-3.5 py-1.5 font-mono text-[12px] transition-all duration-200 ${
                tab === t.id
                  ? "border-cy/60 bg-cy/10 text-mist shadow-[0_0_18px_-6px_rgba(69,214,228,0.5)]"
                  : "border-line text-dim hover:border-edge hover:text-fog"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </Reveal>
      <div className="mt-4 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <Reveal delay={80}>
          <div className="relative">
            <div className="absolute top-2.5 right-3 z-10">
              <CopyBtn text={active?.code ?? ""} />
            </div>
            <CodeBlock title={`terminal · ${active?.label ?? ""}`} lang="bash" code={active?.code ?? ""} />
          </div>
        </Reveal>
        <Reveal delay={140}>
          <div className="space-y-3">
            {[
              ["http://localhost:8000/docs", "Swagger UI — API-г шууд туршина", "backend"],
              ["http://localhost:8000/api/v1/health", "Liveness: {\"status\":\"ok\"}", "backend"],
              ["http://localhost:3000", "Frontend — холболтын статус, pair сонголт", "frontend"],
            ].map(([url, desc, side]) => (
              <div
                key={url}
                className="group rounded-md border border-line bg-deep/50 px-4 py-3 transition-all duration-200 hover:translate-x-1 hover:border-edge"
              >
                <div className="flex items-center gap-2.5">
                  <Chip tone={side === "backend" ? "buy" : "cy"}>{side}</Chip>
                  <p className="truncate font-mono text-[12.5px] text-mist">{url}</p>
                </div>
                <p className="mt-1 text-[12.5px] text-fog">{desc}</p>
              </div>
            ))}
            <Callout tone="cy" title="Холболтын зарчим">
              Frontend-ийн бүх хүсэлт <b className="text-mist">lib/api.ts</b>-ээр дамжина: timeout 8s (AbortController),
              5xx/сүлжээнд retry ×2 (300→600ms backoff), 4xx-ийг дахин оролдохгүй, бүх алдаа нэгдсэн{" "}
              <b className="text-mist">ApiError</b> болно.
            </Callout>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ================= 03 · packages ================= */

function PkgPanel({ title, file, rows, accent }: { title: string; file: string; rows: [string, string, string][]; accent: string }): ReactNode {
  return (
    <div className="overflow-hidden rounded-md border border-line bg-deep/60">
      <div className="flex items-center justify-between border-b border-line bg-panel px-4 py-2.5">
        <p className="font-display text-[13px] font-semibold text-mist">{title}</p>
        <span className={`font-mono text-[11px] ${accent}`}>{file}</span>
      </div>
      <ul className="divide-y divide-line">
        {rows.map(([name, ver, role]) => (
          <li key={name} className="group flex items-baseline gap-3 px-4 py-2.5 transition-colors hover:bg-panel">
            <span className="w-44 shrink-0 font-mono text-[12.5px] text-mist transition-transform duration-200 group-hover:translate-x-0.5">
              {name}
            </span>
            <span className="w-14 shrink-0 font-mono text-[11.5px] text-cy">{ver}</span>
            <span className="text-[12.5px] text-fog">{role}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function PkgsSection(): ReactNode {
  return (
    <section id="s1-pkgs" className="scroll-mt-28">
      <SectionHead
        num="03"
        kicker="Dependencies"
        title="Ямар package суулгасан"
        desc="Хамаарлууд package.json ба requirements.txt-д тунхаглагдсан бөгөөд make setup автоматаар суулгана. Step-ийн тэмдэглэгээтэй мөрүүд тухайн алхамд идэвхжинэ."
      />
      <div className="grid gap-6 lg:grid-cols-2">
        <Reveal>
          <PkgPanel title="Frontend" file="frontend/package.json" rows={PKG_FRONT} accent="text-cy" />
        </Reveal>
        <Reveal delay={120}>
          <PkgPanel title="Backend" file="backend/requirements.txt" rows={PKG_BACK} accent="text-buy" />
        </Reveal>
      </div>
    </section>
  );
}

/* ================= 04 · contract ================= */

export function ContractSection(): ReactNode {
  return (
    <section id="s1-contract" className="scroll-mt-28">
      <SectionHead
        num="04"
        kicker="API Contract"
        title="Step 1-ийн API гэрээ"
        desc="Гурван endpoint аль хэдийн тогтвортой contract-тай: /analysis нь зөв оролтыг validate хийж чадах ба engine ирэхэд (Step 2) зөвхөн хариу код нь 501 → 202 болж өөрчлөгдөнө."
      />
      <Reveal>
        <div className="overflow-x-auto rounded-md border border-line bg-deep/60">
          <table className="w-full min-w-[560px] text-left">
            <thead>
              <tr className="border-b border-line bg-panel">
                {["Method", "Path", "Статус", "Тайлбар"].map((h) => (
                  <th key={h} className="px-4 py-2.5 font-mono text-[10.5px] font-medium tracking-[0.15em] text-dim uppercase">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {STEP1_ENDPOINTS.map((e) => (
                <tr key={e.path} className="transition-colors hover:bg-panel">
                  <td className="px-4 py-3">
                    <MethodBadge m={e.method} />
                  </td>
                  <td className="px-4 py-3 font-mono text-[12.5px] text-mist">{e.path}</td>
                  <td className="px-4 py-3 font-mono text-[12px] text-cy">{e.status}</td>
                  <td className="px-4 py-3 text-[13px] text-fog">{e.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Reveal>
      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Reveal>
          <CodeBlock title="GET /health → 200" lang="json" code={STEP1_HEALTH_JSON} />
        </Reveal>
        <Reveal delay={90}>
          <CodeBlock title="POST /analysis → 501" lang="json" code={STEP1_ERROR_501_JSON} />
        </Reveal>
        <Reveal delay={180}>
          <CodeBlock title="Буруу symbol → 422" lang="json" code={STEP1_ERROR_422_JSON} />
        </Reveal>
      </div>
      <Reveal delay={120}>
        <div className="mt-5">
          <Callout tone="cy" title="Нэгдсэн алдааны формат">
            Backend-ийн бүх алдаа <b className="text-mist">{"{ error, detail, path, utc_now }"}</b> хэлбэртэй — 422, 404, 500, 501
            бүгд. Frontend үүнийг <b className="text-mist">ApiError(status, code)</b> болгон задалж, хэрэглэгчид уншиж болохуйц
            монгол мессеж харуулна. Дотоод алдааны (500) мэдээлэл client руу хэзээ ч задрахгүй.
          </Callout>
        </div>
      </Reveal>
    </section>
  );
}

/* ================= 05 · next steps ================= */

const STEP_TONE: Record<string, string> = { done: "text-buy", next: "text-cy", todo: "text-edge" };

export function NextStepsSection(): ReactNode {
  return (
    <section id="s1-next" className="scroll-mt-28">
      <SectionHead
        num="05"
        kicker="Roadmap"
        title="Дараагийн алхамд юу хийгдэх вэ"
        desc="Step 2-оос систем доороосоо дээш «амьдрал» авна: эхлээд market data, дараа нь indicator, scoring engine, AI тайлбар, UI."
      />
      <div className="relative">
        <div className="absolute top-2 bottom-2 left-[19px] w-px bg-gradient-to-b from-buy/50 via-line to-line sm:left-[23px]" />
        <div className="space-y-2">
          {NEXT_STEPS.map((s, i) => (
            <Reveal key={s.step} delay={Math.min(i * 60, 240)}>
              <div className="group relative flex gap-4 sm:gap-6">
                <div
                  className={`relative z-10 mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-sm border font-mono text-[12.5px] font-semibold transition-colors sm:h-12 sm:w-12 sm:text-[14px] ${
                    s.status === "done"
                      ? "border-buy/50 bg-buy/10 text-buy"
                      : s.status === "next"
                        ? "border-cy/60 bg-cy/10 text-cy shadow-[0_0_20px_-6px_rgba(69,214,228,0.55)]"
                        : "border-edge bg-panel text-dim group-hover:border-edge group-hover:text-fog"
                  }`}
                >
                  {s.status === "done" ? <IcCheck className="h-4 w-4" /> : s.step}
                </div>
                <div className="min-w-0 flex-1 rounded-md border border-transparent p-3 transition-all duration-300 group-hover:translate-x-1 group-hover:border-line group-hover:bg-deep/60 sm:p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className={`font-display text-[13.5px] font-semibold ${s.status === "todo" ? "text-fog" : "text-mist"}`}>
                      Step {s.step} · {s.title}
                    </h3>
                    {s.status === "done" ? (
                      <Chip tone="buy">✓ дууссан</Chip>
                    ) : s.status === "next" ? (
                      <Chip tone="cy">▸ дараагийн</Chip>
                    ) : (
                      <Chip tone="fog">{s.eta}</Chip>
                    )}
                    {s.status === "next" ? <Chip tone="fog">{s.eta}</Chip> : null}
                  </div>
                  <p className="mt-1.5 text-[14px] leading-relaxed text-fog">{s.desc}</p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
      <Reveal delay={150}>
        <div className="mt-8 grid gap-5 lg:grid-cols-2">
          <Callout tone="cy" title="Step 2-т тодорхой: TwelveDataClient">
            <b className="text-mist">backend/app/services/market_data/twelve_data.py</b> — httpx.AsyncClient(timeout=8s),
            retry ×3 exponential backoff, амжилтгүй бол yfinance fallback, амжилттай OHLCV-г Redis-д cache-лна. Гол зарчим:{" "}
            <b className="text-mist">API key зөвхөн backend-ийн .env-д</b>.
          </Callout>
          <Callout tone="wait" title="Сануулга">
            {DISCLAIMER}
          </Callout>
        </div>
      </Reveal>
    </section>
  );
}

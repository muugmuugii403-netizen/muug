import { useState, type ReactNode } from "react";
import { FLOW, TREE, type FolderNode } from "../data";
import { usePRM } from "../hooks";
import { Chip, IcChevron, IcFile, IcFolder, IcLock, Reveal, SectionHead } from "./bits";

/* ================= 01 · architecture diagram ================= */

interface NodeProps {
  x: number;
  y: number;
  w: number;
  h: number;
  accent: string;
  title: string;
  lines: string[];
  badge?: string;
}

function Node({ x, y, w, h, accent, title, lines, badge }: NodeProps): ReactNode {
  return (
    <g className="transition-opacity hover:opacity-90">
      <rect x={x} y={y} width={w} height={h} rx="7" fill="#12262e" stroke="#2a5566" strokeWidth="1.2" />
      <rect x={x} y={y} width="4" height={h} rx="2" fill={accent} />
      <text x={x + 18} y={y + 27} fontFamily="Unbounded, sans-serif" fontSize="13" fill="#e8f2f4" fontWeight="600">
        {title}
      </text>
      {badge ? (
        <text x={x + w - 14} y={y + 26} textAnchor="end" fontFamily="IBM Plex Mono, monospace" fontSize="9.5" fill={accent}>
          {badge}
        </text>
      ) : null}
      {lines.map((l, i) => (
        <text key={i} x={x + 18} y={y + 47 + i * 15} fontFamily="IBM Plex Mono, monospace" fontSize="10.5" fill="#8faab4">
          {l}
        </text>
      ))}
    </g>
  );
}

interface EdgeProps {
  d: string;
  label: string;
  lx: number;
  ly: number;
  prm: boolean;
  dot?: string;
  anchor?: "start" | "middle";
}

function Edge({ d, label, lx, ly, prm, dot, anchor = "middle" }: EdgeProps): ReactNode {
  return (
    <g>
      <path d={d} fill="none" stroke="#1e3e4a" strokeWidth="1.6" markerEnd="url(#arrow)" />
      <path d={d} fill="none" stroke="#45d6e4" strokeWidth="1.3" opacity="0.45" className="flowline" />
      {!prm && dot ? (
        <circle r="3" fill={dot}>
          <animateMotion dur="4.5s" repeatCount="indefinite" path={d} />
        </circle>
      ) : null}
      <text x={lx} y={ly} textAnchor={anchor} fontFamily="IBM Plex Mono, monospace" fontSize="10" fill="#5e7b87">
        {label}
      </text>
    </g>
  );
}

function Diagram(): ReactNode {
  const prm = usePRM();
  return (
    <Reveal>
      <div className="overflow-x-auto rounded-md border border-line bg-deep/60 p-3 sm:p-5">
        <svg viewBox="0 0 960 540" className="w-full min-w-[720px]" role="img" aria-label="Системийн архитектур диаграм">
          <defs>
            <marker id="arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M0,0 L8,4 L0,8 z" fill="#2a5566" />
            </marker>
          </defs>

          {/* edges */}
          <Edge d="M480,112 L480,203" label="HTTPS · JSON" lx={492} ly={160} anchor="start" prm={prm} dot="#45d6e4" />
          <Edge d="M330,245 L278,245" label="OHLCV · retry ×3" lx={304} ly={233} prm={prm} />
          <Edge d="M630,245 L682,245" label="scoring JSON → text" lx={656} ly={233} prm={prm} />
          <Edge d="M400,287 C 385,340 350,362 310,390" label="raw OHLCV" lx={330} ly={330} prm={prm} dot="#2fd08c" />
          <Edge d="M560,287 C 580,340 615,362 650,390" label="SQL · SQLAlchemy async" lx={640} ly={330} anchor="start" prm={prm} />
          <Edge d="M422,436 L538,436" label="signals + indicators insert" lx={480} ly={424} prm={prm} dot="#f5b84b" />

          {/* nodes */}
          <Node
            x={330} y={30} w={300} h={82} accent="#45d6e4" title="FRONTEND"
            lines={["Next.js 15 · TypeScript strict", "Tailwind · Lightweight Charts · TanStack Query"]}
            badge="client"
          />
          <Node
            x={330} y={205} w={300} h={82} accent="#e8f2f4" title="API GATEWAY"
            lines={["FastAPI · Pydantic v2 validation", "JWT · rate limit · CORS whitelist"]}
            badge="server"
          />
          <Node
            x={36} y={205} w={242} h={82} accent="#2fd08c" title="MARKET DATA"
            lines={["Twelve Data (primary)", "yfinance (fallback)"]}
            badge="ext"
          />
          <Node
            x={682} y={205} w={242} h={82} accent="#f5b84b" title="QWEN AI"
            lines={["Зөвхөн тайлбар үүсгэнэ", "signal-д оролцох эрхгүй"]}
            badge="ext"
          />
          <Node
            x={120} y={392} w={302} h={90} accent="#2fd08c" title="ANALYSIS ENGINE"
            lines={["pandas + pandas-ta · 10 indicator", "ScoringEngine — pure function", "Risk: Entry / SL / TP / RR"]}
            badge="core"
          />
          <Node
            x={538} y={392} w={302} h={90} accent="#45d6e4" title="POSTGRESQL 15"
            lines={["candles · indicators_cache", "signals · economic_events", "partition by month · JSONB"]}
            badge="db"
          />
        </svg>
      </div>
    </Reveal>
  );
}

const BOUNDARIES: Array<[string, string, string]> = [
  ["01", "API key хил", "Twelve Data болон Qwen-ийн key зөвхөн backend-ийн .env-д. Frontend тэдгээрийг хэзээ ч харахгүй — бүх гадаад дуудлага FastAPI-аар дамжина."],
  ["02", "Deterministic хил", "Signal бол цэвэр функц: ижил indicator оролт → ижил гаралт. Нэг ч AI дуудлагын хариу scoring-д ордоггүй. pytest-ээр баталгаажуулна."],
  ["03", "AI хил", "Qwen зөвхөн бэлэн scoring JSON-ийг хүлээж аваад тайлбар text буцаана. System prompt нь fixed, хэрэглэгчийн текст орохгүй (prompt-injection хаалт)."],
];

export function ArchitectureSection(): ReactNode {
  return (
    <section id="arch" className="scroll-mt-28">
      <SectionHead
        num="01"
        kicker="System Architecture"
        title="Системийн архитектур"
        desc="Гурван үндсэн давхарга: Next.js frontend, FastAPI API gateway, болон Python analysis engine + PostgreSQL. Гадны 2 сервис (market data, Qwen) — хоёулаа зөвхөн backend-ээс дуудагдана."
      />
      <Diagram />
      <div className="mt-6 space-y-3">
        {BOUNDARIES.map(([n, t, d], i) => (
          <Reveal key={n} delay={i * 90}>
            <div className="group flex gap-4 rounded-md border border-line bg-deep/50 p-4 transition-colors hover:border-edge sm:gap-5">
              <span className="font-display text-lg font-bold text-edge transition-colors group-hover:text-cy">{n}</span>
              <div>
                <p className="font-display text-[13px] font-semibold tracking-wide text-mist">{t}</p>
                <p className="mt-1 text-[14px] leading-relaxed text-fog">{d}</p>
              </div>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

/* ================= 02 · folder tree ================= */

function initialExpanded(): Set<string> {
  return new Set(["0", "0-1", "0-2"]);
}

function TreeRow({ node, path, depth, expanded, toggle }: {
  node: FolderNode;
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
          className="group flex w-full items-center gap-2 rounded-sm py-[3.5px] pr-2 text-left transition-colors hover:bg-panel"
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
          {isEnv ? <IcLock /> : <IcFile />}
          <span className={`font-mono text-[12.5px] ${isEnv ? "text-wait" : "text-fog"}`}>{node.n}</span>
          {node.note ? (
            <span className={`ml-auto hidden truncate pl-4 font-mono text-[11px] md:block ${isEnv ? "text-wait/70" : "text-dim"}`}>
              {node.note}
            </span>
          ) : null}
        </div>
      )}
      {isDir && isOpen && node.c
        ? node.c.map((child, i) => (
            <TreeRow
              key={child.n}
              node={child}
              path={`${path}-${i}`}
              depth={depth + 1}
              expanded={expanded}
              toggle={toggle}
            />
          ))
        : null}
    </div>
  );
}

export function FolderSection(): ReactNode {
  const [expanded, setExpanded] = useState<Set<string>>(initialExpanded);
  const toggle = (p: string): void => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(p)) next.delete(p);
      else next.add(p);
      return next;
    });
  };
  return (
    <section id="folders" className="scroll-mt-28">
      <SectionHead
        num="02"
        kicker="Monorepo Layout"
        title="Folder бүтэц"
        desc="Нэг repo, хоёр апп: /frontend (Next.js 15) ба /backend (FastAPI). Нудсан дарж нээж хаана. Түлхүүр файлуудын үүргийг баруун талд тэмдэглэв."
      />
      <Reveal>
        <div className="flex items-center justify-between gap-3 border-b border-line px-3 py-2">
          <span className="font-mono text-[11px] tracking-wider text-dim uppercase">git@github.com:you/forex-analyzer.git</span>
          <span className="flex gap-2">
            <Chip tone="cy">monorepo</Chip>
            <Chip tone="wait">.env server-only</Chip>
          </span>
        </div>
        <div className="rounded-b-md border border-t-0 border-line bg-deep/60 py-2">
          <TreeRow node={TREE} path="0" depth={0} expanded={expanded} toggle={toggle} />
        </div>
      </Reveal>
    </section>
  );
}

/* ================= 03 · data flow ================= */

export function FlowSection(): ReactNode {
  return (
    <section id="flow" className="scroll-mt-28">
      <SectionHead
        num="03"
        kicker="Data Flow"
        title="Өгөгдлийн урсгал — frontend ↔ backend ↔ database"
        desc="Нэг шинжилгээний хүсэлтийн бүрэн зам: сонголт → validation → cache → market data → indicator → scoring → AI тайлбар → рэндэр. Алхам бүрт timeout, retry, fallback тодорхой."
      />
      <div className="relative">
        <div className="absolute top-2 bottom-2 left-[19px] w-px bg-gradient-to-b from-cy/50 via-line to-line sm:left-[23px]" />
        <div className="space-y-2">
          {FLOW.map((s, i) => (
            <Reveal key={s.n} delay={Math.min(i * 60, 240)}>
              <div className="group relative flex gap-4 sm:gap-6">
                <div className="relative z-10 mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-sm border border-edge bg-panel font-mono text-[13px] font-semibold text-cy transition-colors group-hover:border-cy group-hover:bg-panel2 sm:h-12 sm:w-12 sm:text-[15px]">
                  {s.n}
                </div>
                <div className="min-w-0 flex-1 rounded-md border border-transparent p-3 transition-all duration-300 group-hover:translate-x-1 group-hover:border-line group-hover:bg-deep/60 sm:p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-display text-[13.5px] font-semibold text-mist">{s.title}</h3>
                  </div>
                  <p className="mt-1.5 text-[14px] leading-relaxed text-fog">{s.desc}</p>
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    {s.tags.map((t) => (
                      <Chip key={t} tone={t.toLowerCase().includes("fallback") ? "wait" : "fog"}>
                        {t}
                      </Chip>
                    ))}
                  </div>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

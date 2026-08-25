import type { ReactNode } from "react";
import { useReveal } from "../hooks";

/* ---------- scroll reveal wrapper ---------- */

export function Reveal({
  children,
  delay = 0,
  className = "",
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}): ReactNode {
  const { ref, on } = useReveal<HTMLDivElement>();
  return (
    <div
      ref={ref}
      className={`rv ${on ? "on" : ""} ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

/* ---------- section header ---------- */

export function SectionHead({
  num,
  kicker,
  title,
  desc,
}: {
  num: string;
  kicker: string;
  title: string;
  desc?: string;
}): ReactNode {
  return (
    <Reveal className="mb-8">
      <div className="flex items-end gap-4 sm:gap-6">
        <span
          className="font-display text-[52px] leading-[0.85] font-extrabold text-transparent select-none sm:text-[72px]"
          style={{ WebkitTextStroke: "1.5px #2a5566" }}
        >
          {num}
        </span>
        <div className="min-w-0 flex-1 border-b border-line pb-3">
          <p className="font-mono text-[11px] tracking-[0.22em] text-cy uppercase">{kicker}</p>
          <h2 className="font-display mt-1 text-xl font-600 text-mist sm:text-2xl">{title}</h2>
        </div>
      </div>
      {desc ? <p className="mt-4 max-w-3xl text-[15px] leading-relaxed text-fog">{desc}</p> : null}
    </Reveal>
  );
}

/* ---------- small chip ---------- */

export function Chip({ children, tone = "fog" }: { children: ReactNode; tone?: "fog" | "cy" | "buy" | "sell" | "wait" }): ReactNode {
  const map: Record<string, string> = {
    fog: "border-line text-fog",
    cy: "border-[#1e5563] text-cy",
    buy: "border-[#1d5c44] text-buy",
    sell: "border-[#66303c] text-sell",
    wait: "border-[#5f4d24] text-wait",
  };
  return (
    <span className={`inline-block rounded-sm border px-2 py-0.5 font-mono text-[11px] whitespace-nowrap ${map[tone]}`}>
      {children}
    </span>
  );
}

/* ---------- code block ---------- */

export function CodeBlock({
  title,
  lang,
  code,
  className = "",
}: {
  title: string;
  lang: string;
  code: string;
  className?: string;
}): ReactNode {
  const lines = code.split("\n");
  return (
    <div className={`overflow-hidden rounded-md border border-line bg-deep ${className}`}>
      <div className="flex items-center justify-between border-b border-line bg-panel px-3.5 py-2">
        <div className="flex items-center gap-2.5">
          <span className="flex gap-1.5">
            <i className="h-2.5 w-2.5 rounded-full bg-[#3a5560]" />
            <i className="h-2.5 w-2.5 rounded-full bg-[#2c4854]" />
            <i className="h-2.5 w-2.5 rounded-full bg-[#223942]" />
          </span>
          <span className="font-mono text-[11.5px] text-fog">{title}</span>
        </div>
        <span className="rounded-sm border border-line px-1.5 py-px font-mono text-[10px] tracking-wider text-dim uppercase">
          {lang}
        </span>
      </div>
      <pre className="overflow-x-auto px-4 py-3.5 font-mono text-[12px] leading-[1.7] text-[#b9d2da]">
        {lines.map((ln, i) => (
          <div key={i} className={isComment(ln) ? "text-dim" : ""}>
            {ln === "" ? " " : ln}
          </div>
        ))}
      </pre>
    </div>
  );
}

function isComment(line: string): boolean {
  const t = line.trim();
  return t.startsWith("//") || t.startsWith("--") || t.startsWith("#");
}

/* ---------- callout ---------- */

export function Callout({
  tone,
  title,
  children,
}: {
  tone: "wait" | "sell" | "cy";
  title: string;
  children: ReactNode;
}): ReactNode {
  const styles: Record<string, string> = {
    wait: "border-wait/45 bg-wait/[0.05]",
    sell: "border-sell/45 bg-sell/[0.05]",
    cy: "border-cy/40 bg-cy/[0.05]",
  };
  const dot: Record<string, string> = { wait: "bg-wait", sell: "bg-sell", cy: "bg-cy" };
  return (
    <div className={`rounded-md border border-l-[3px] p-4 sm:p-5 ${styles[tone]}`}>
      <p className="mb-1.5 flex items-center gap-2 font-display text-[13px] font-semibold tracking-wide text-mist">
        <span className={`inline-block h-2 w-2 rotate-45 ${dot[tone]}`} />
        {title}
      </p>
      <div className="text-[14px] leading-relaxed text-fog">{children}</div>
    </div>
  );
}

/* ---------- custom inline icons ---------- */

export function IcCheck({ className = "h-4 w-4" }: { className?: string }): ReactNode {
  return (
    <svg viewBox="0 0 16 16" className={className} fill="none" aria-hidden>
      <path d="M2.5 8.5 6 12l7.5-8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="square" />
    </svg>
  );
}

export function IcCross({ className = "h-4 w-4" }: { className?: string }): ReactNode {
  return (
    <svg viewBox="0 0 16 16" className={className} fill="none" aria-hidden>
      <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="square" />
    </svg>
  );
}

export function IcBolt({ className = "h-4 w-4" }: { className?: string }): ReactNode {
  return (
    <svg viewBox="0 0 16 16" className={className} fill="currentColor" aria-hidden>
      <path d="M9.5 1 3 9h4l-1 6 7-9H8.5l1-5z" />
    </svg>
  );
}

export function IcChevron({ open }: { open: boolean }): ReactNode {
  return (
    <svg
      viewBox="0 0 12 12"
      className={`h-3 w-3 text-dim transition-transform duration-300 ${open ? "rotate-90 text-cy" : ""}`}
      fill="none"
      aria-hidden
    >
      <path d="M4.5 2.5 8 6l-3.5 3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="square" />
    </svg>
  );
}

export function IcFolder({ open }: { open: boolean }): ReactNode {
  return (
    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 shrink-0 text-wait/80" fill="none" aria-hidden>
      {open ? (
        <path d="M1.5 4.5V3h4l1.5 1.5h7.5v2h-11L1.5 12V4.5z M2.8 7h11.7l-1.6 5.5H1.5L2.8 7z" fill="currentColor" />
      ) : (
        <path d="M1.5 3.5h4L7 5h7.5v7.5h-13V3.5z" fill="currentColor" />
      )}
    </svg>
  );
}

export function IcFile(): ReactNode {
  return (
    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 shrink-0 text-dim" fill="none" aria-hidden>
      <path d="M3.5 1.5h6l3 3v10h-9v-13z" stroke="currentColor" strokeWidth="1.2" />
      <path d="M9.5 1.5v3h3" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
}

export function IcLock(): ReactNode {
  return (
    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 shrink-0 text-wait" fill="none" aria-hidden>
      <rect x="3.5" y="7" width="9" height="7" stroke="currentColor" strokeWidth="1.3" />
      <path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  );
}

/* ---------- method badge ---------- */

export function MethodBadge({ m }: { m: "GET" | "POST" }): ReactNode {
  return (
    <span
      className={`inline-block w-12 rounded-sm py-0.5 text-center font-mono text-[10.5px] font-semibold tracking-wide ${
        m === "GET" ? "bg-buy/12 text-buy border border-buy/30" : "bg-wait/12 text-wait border border-wait/30"
      }`}
    >
      {m}
    </span>
  );
}

import { useEffect, useState, type ReactNode } from "react";
import { TICKER } from "../data";
import { useScramble } from "../hooks";
import { Chip, Reveal } from "./bits";

/* ================= ticker tape ================= */

function TickerItems(): ReactNode {
  return (
    <>
      {TICKER.map((t) => (
        <span key={t.s} className="flex items-center gap-2 px-5 font-mono text-[12px]">
          <span className="text-dim">{t.s}</span>
          <span className="text-mist">{t.p}</span>
          <span className={t.d >= 0 ? "text-buy" : "text-sell"}>
            {t.d >= 0 ? "▲" : "▼"} {Math.abs(t.d).toFixed(2)}%
          </span>
          <span className="pl-4 text-line">│</span>
        </span>
      ))}
    </>
  );
}

export function TickerTape(): ReactNode {
  return (
    <div className="relative overflow-hidden border-b border-line bg-deep/80 py-1.5">
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-16 bg-gradient-to-r from-ink to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-16 bg-gradient-to-l from-ink to-transparent" />
      <div className="ticker-track flex w-max">
        <span className="flex items-center pr-2 pl-4 font-mono text-[10px] tracking-[0.25em] text-dim">
          SAMPLE FEED
        </span>
        <TickerItems />
        <TickerItems />
      </div>
    </div>
  );
}

/* ================= mini candle chart (demo) ================= */

const CANDLES = Array.from({ length: 21 }, (_, i) => {
  const w = (k: number): number => Math.sin(k * 0.9) * 6 + Math.sin(k * 2.3) * 2.5;
  const close = 24 + i * 1.7 + w(i);
  const open = 24 + (i - 1) * 1.7 + w(i - 1);
  return {
    x: 5 + i * 11.6,
    up: close >= open,
    top: 88 - Math.max(open, close),
    bot: 88 - Math.min(open, close),
    hi: 88 - (Math.max(open, close) + 2.5 + Math.abs(Math.sin(i * 1.7)) * 3),
    lo: 88 - (Math.min(open, close) - 2.5 - Math.abs(Math.cos(i * 1.3)) * 3),
  };
});

function Candles(): ReactNode {
  return (
    <svg viewBox="0 0 250 92" className="h-24 w-full" aria-hidden>
      {[20, 40, 60, 80].map((y) => (
        <line key={y} x1="0" x2="250" y1={y} y2={y} stroke="#1e3e4a" strokeWidth="0.6" strokeDasharray="3 4" />
      ))}
      {CANDLES.map((c, i) => (
        <g key={i} className="candle" style={{ ["--i" as string]: i }}>
          <line x1={c.x + 3.4} x2={c.x + 3.4} y1={c.hi} y2={c.lo} stroke={c.up ? "#2fd08c" : "#fb6f84"} strokeWidth="1" opacity="0.75" />
          <rect
            x={c.x}
            y={c.top}
            width="6.8"
            height={Math.max(c.bot - c.top, 2.2)}
            fill={c.up ? "#2fd08c" : "#fb6f84"}
            opacity={c.up ? 0.92 : 0.88}
            rx="1"
          />
        </g>
      ))}
    </svg>
  );
}

/* ================= terminal card ================= */

const SCORES = [
  { label: "BUY", v: 78, cls: "bg-buy", text: "text-buy" },
  { label: "SELL", v: 12, cls: "bg-sell", text: "text-sell" },
  { label: "WAIT", v: 10, cls: "bg-wait", text: "text-wait" },
];

function TerminalCard(): ReactNode {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    const t = window.setTimeout(() => setArmed(true), 350);
    return () => window.clearTimeout(t);
  }, []);

  return (
    <Reveal delay={150}>
      <div className="relative overflow-hidden rounded-md border border-edge bg-deep shadow-[0_24px_70px_-30px_rgba(0,0,0,0.85)]">
        <div className="scan pointer-events-none absolute inset-x-0 h-16 bg-gradient-to-b from-transparent via-cy/[0.05] to-transparent" />
        {/* header */}
        <div className="flex items-center justify-between border-b border-line bg-panel px-4 py-2.5">
          <div className="flex items-center gap-3">
            <span className="flex gap-1.5">
              <i className="h-2.5 w-2.5 rounded-full bg-sell/70" />
              <i className="h-2.5 w-2.5 rounded-full bg-wait/70" />
              <i className="h-2.5 w-2.5 rounded-full bg-buy/70" />
            </span>
            <span className="font-mono text-[11.5px] text-fog">signal_engine · EURUSD · 1H</span>
          </div>
          <span className="led h-2 w-2 rounded-full bg-buy" />
        </div>
        {/* body */}
        <div className="p-4 sm:p-5">
          <div className="mb-1 flex items-center justify-between font-mono text-[10.5px] text-dim">
            <span>OHLCV · candles_1H</span>
            <span className="text-cy">lightweight-charts</span>
          </div>
          <Candles />
          <div className="my-4 border-t border-dashed border-line" />
          {/* stacked distribution */}
          <div className="flex h-2 w-full overflow-hidden rounded-sm bg-panel2">
            {SCORES.map((s) => (
              <div
                key={s.label}
                className={`${s.cls} transition-[width] duration-1000 ease-out`}
                style={{ width: armed ? `${s.v}%` : "0%" }}
              />
            ))}
          </div>
          <div className="mt-3 space-y-2">
            {SCORES.map((s, i) => (
              <div key={s.label} className="flex items-center gap-3">
                <span className={`w-11 font-mono text-[11px] font-semibold ${s.text}`}>{s.label}</span>
                <div className="h-[7px] flex-1 overflow-hidden rounded-sm bg-panel2">
                  <div
                    className={`${s.cls} h-full rounded-sm transition-[width] duration-1000 ease-out`}
                    style={{ width: armed ? `${s.v}%` : "0%", transitionDelay: `${200 + i * 120}ms` }}
                  />
                </div>
                <span className={`w-12 text-right font-mono text-[12px] ${s.text}`}>{s.v}/100</span>
              </div>
            ))}
          </div>
          {/* signal row */}
          <div className="mt-4 flex items-center justify-between rounded-sm border border-buy/30 bg-buy/[0.07] px-3.5 py-2.5">
            <span className="font-display text-xl font-bold tracking-wide text-buy">BUY</span>
            <div className="flex items-center gap-3 font-mono text-[11px] text-fog">
              <span>
                conf <b className="text-mist">82</b>
              </span>
              <span>
                RR <b className="text-mist">1.73</b>
              </span>
              <span className="hidden text-dim sm:inline">SL 1.0821 · TP 1.0941</span>
            </div>
          </div>
          <p className="mt-3 font-mono text-[10.5px] text-dim">
            engine: <span className="text-buy">deterministic</span> ▸ ai:{" "}
            <span className="text-wait">explain-only</span>
            <span className="blink ml-1 inline-block h-3 w-[7px] translate-y-[2px] bg-cy" />
          </p>
        </div>
      </div>
    </Reveal>
  );
}

/* ================= masthead ================= */

const STACK = [
  ["Next.js 15", "cy"],
  ["FastAPI", "cy"],
  ["PostgreSQL 15", "cy"],
  ["pandas + pandas-ta", "buy"],
  ["Lightweight Charts", "fog"],
  ["Qwen API", "wait"],
  ["GitHub Actions", "fog"],
] as const;

export function Masthead(): ReactNode {
  const title = useScramble("ANALYZER", true);
  return (
    <header className="relative mx-auto w-full max-w-6xl px-5 pt-12 pb-14 sm:px-8 sm:pt-16">
      <div className="grid items-center gap-10 lg:grid-cols-[1.06fr_0.94fr] lg:gap-12">
        <div>
          <Reveal>
            <p className="flex items-center gap-2.5 font-mono text-[11px] tracking-[0.28em] text-cy uppercase">
              <span className="led inline-block h-2 w-2 rounded-full bg-buy" />
              Техник blueprint · Production plan · v1.0
            </p>
          </Reveal>
          <h1 className="font-display mt-5 leading-[0.98] font-extrabold">
            <span className="block text-[44px] text-mist sm:text-[64px]">FOREX</span>
            <span className="stroke-text block text-[44px] tracking-tight sm:text-[64px]">{title}</span>
          </h1>
          <Reveal delay={120}>
            <p className="mt-5 max-w-xl text-[15px] leading-relaxed text-fog">
              EUR/USD сонгохад систем OHLCV өгөгдөл авч, <b className="text-mist">10 indicator</b>-ийг тооцоолж,{" "}
              <b className="text-buy">100% deterministic scoring engine</b>-ээр BUY / SELL / WAIT signal гаргана.
              AI (Qwen) зөвхөн тайлбар бичнэ — <span className="text-wait">шийдвэрт хэзээ ч оролцохгүй</span>.
            </p>
          </Reveal>
          <Reveal delay={220}>
            <div className="mt-6 flex flex-wrap gap-2">
              {STACK.map(([name, tone]) => (
                <Chip key={name} tone={tone as "cy" | "buy" | "wait" | "fog"}>
                  {name}
                </Chip>
              ))}
            </div>
          </Reveal>
        </div>
        <TerminalCard />
      </div>

      {/* stats strip */}
      <Reveal delay={100}>
        <div className="mt-14 grid grid-cols-2 overflow-hidden rounded-md border border-line bg-deep/70 sm:grid-cols-4">
          {[
            ["10", "indicator", "text-cy"],
            ["7", "scoring дүрэм · жин 100", "text-buy"],
            ["6", "PostgreSQL хүснэгт", "text-wait"],
            ["9", "хөгжүүлэлтийн phase", "text-sell"],
          ].map(([v, l, c], i) => (
            <div
              key={l}
              className={`group flex items-baseline gap-2.5 px-5 py-4 transition-colors hover:bg-panel ${i > 0 ? "border-l border-line" : ""} ${i >= 2 ? "border-t border-line sm:border-t-0" : ""} ${i === 2 ? "border-l-0 sm:border-l" : ""}`}
            >
              <span className={`font-display text-2xl font-bold ${c} transition-transform duration-300 group-hover:-translate-y-0.5`}>
                {v}
              </span>
              <span className="font-mono text-[11px] text-dim">{l}</span>
            </div>
          ))}
        </div>
      </Reveal>
    </header>
  );
}

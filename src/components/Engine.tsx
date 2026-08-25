import type { ReactNode } from "react";
import {
  DISCLAIMER,
  STEP34_AI_RULES,
  STEP34_ENDPOINTS,
  STEP34_FILES,
  STEP34_FLOW,
  STEP34_WEIGHTS,
} from "../data";
import { Callout, Chip, IcBolt, IcCheck, MethodBadge, Reveal, SectionHead } from "./bits";

/* ================= 07 · signal engine + AI ================= */

export function EngineSection(): ReactNode {
  return (
    <section id="s34-engine" className="scroll-mt-28">
      <SectionHead
        num="07"
        kicker="Signal Engine + Qwen AI"
        title="Step 3–4: Deterministic signal + AI тайлбар"
        desc="Signal-ийг ЗӨВХӨН market data + indicator + онооны систем гаргана. Qwen AI нь түүний дараа structured signal-ийг хүн унших Монгол хэлээр тайлбарлана — шийдвэрт хэзээ ч оролцохгүй."
      />

      {/* урсгал */}
      <Reveal>
        <div className="rounded-md border border-line bg-deep/60 p-4 sm:p-5">
          <p className="font-mono text-[10.5px] uppercase tracking-[0.2em] text-dim">Дараалал</p>
          <ol className="mt-3 space-y-0">
            {STEP34_FLOW.map((step, i) => (
              <li key={step} className="group flex gap-3">
                <div className="flex flex-col items-center">
                  <span
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border font-mono text-[10.5px] font-semibold ${
                      i === 3
                        ? "border-buy/60 bg-buy/15 text-buy"
                        : i === 4
                          ? "border-wait/60 bg-wait/10 text-wait"
                          : "border-edge bg-panel text-cy"
                    }`}
                  >
                    {i + 1}
                  </span>
                  {i < STEP34_FLOW.length - 1 && <span className="my-0.5 w-px flex-1 bg-line" />}
                </div>
                <p className="pb-4 text-[13.5px] leading-relaxed text-fog transition-colors group-hover:text-mist">
                  {step}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </Reveal>

      {/* scoring weight */}
      <div className="mt-8 grid gap-8 lg:grid-cols-[1.05fr_0.95fr]">
        <div>
          <Reveal>
            <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.18em] text-dim">
              Scoring жин (нийлбэр = 100)
            </p>
          </Reveal>
          <div className="space-y-2">
            {STEP34_WEIGHTS.map((w, i) => (
              <Reveal key={w.rule} delay={Math.min(i * 50, 200)}>
                <div className="group rounded-md border border-line bg-deep/50 p-3.5 transition-colors hover:border-edge">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-mono text-[13px] font-medium text-mist">{w.rule}</p>
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-24 overflow-hidden rounded-sm bg-panel2">
                        <div className="h-full rounded-sm bg-cy/70" style={{ width: `${(w.weight / 25) * 100}%` }} />
                      </div>
                      <span className="w-8 text-right font-mono text-[11px] text-cy">{w.weight}</span>
                    </div>
                  </div>
                  <div className="mt-2 grid gap-1.5 text-[12.5px] sm:grid-cols-2">
                    <p className="text-fog">
                      <span className="mr-1.5 font-mono text-[10px] font-semibold text-buy">BUY</span>
                      {w.buy}
                    </p>
                    <p className="text-fog">
                      <span className="mr-1.5 font-mono text-[10px] font-semibold text-sell">SELL</span>
                      {w.sell}
                    </p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
          <Reveal delay={120}>
            <div className="mt-4">
              <Callout tone="cy" title="Шийдвэрийн босго">
                <b className="text-buy">BUY</b>: buy_score ≥ 65 ба buy &gt; sell · <b className="text-sell">SELL</b>:
                sell_score ≥ 65 ба sell &gt; buy · <b className="text-wait">WAIT</b>: бусад бүх тохиолдол (5M/15M
                зөрчилтэй үед оноо WAIT руу шилжинэ). WAIT бол бүрэн эрхтэй, зөв шийдвэр — систем заавал худалдаа
                санал болгох албагүй.
              </Callout>
            </div>
          </Reveal>
        </div>

        <div>
          <Reveal delay={80}>
            <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.18em] text-dim">Үүссэн файлууд</p>
          </Reveal>
          <ul className="space-y-1.5">
            {STEP34_FILES.map((f, i) => (
              <Reveal key={f.path} delay={Math.min(i * 40, 200)}>
                <li className="group rounded-sm border border-transparent px-3 py-2 transition-all duration-200 hover:translate-x-1 hover:border-line hover:bg-deep/60">
                  <p className="font-mono text-[12px] font-medium text-cy">{f.path}</p>
                  <p className="mt-0.5 text-[12px] leading-relaxed text-fog">{f.role}</p>
                </li>
              </Reveal>
            ))}
          </ul>
        </div>
      </div>

      {/* endpoints */}
      <Reveal>
        <div className="mt-8">
          <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.18em] text-dim">Endpoint</p>
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
                {STEP34_ENDPOINTS.map((e) => (
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
        </div>
      </Reveal>

      {/* AI safety rules */}
      <Reveal>
        <div className="mt-8 rounded-md border border-wait/45 border-l-[3px] bg-wait/[0.05] p-4 sm:p-5">
          <p className="flex items-center gap-2 font-display text-[13.5px] font-semibold tracking-wide text-mist">
            <span className="text-wait">
              <IcBolt className="h-5 w-5" />
            </span>
            AI аюулгүй байдлын дүрмүүд (prompt-д хатуу тусгагдсан)
          </p>
          <ul className="mt-3 grid gap-x-6 gap-y-2.5 sm:grid-cols-2">
            {STEP34_AI_RULES.map((r) => (
              <li key={r} className="flex gap-2.5">
                <span className="mt-0.5 shrink-0 text-wait">
                  <IcCheck className="h-3.5 w-3.5" />
                </span>
                <span className="text-[13.5px] leading-relaxed text-fog">{r}</span>
              </li>
            ))}
          </ul>
        </div>
      </Reveal>

      {/* resilience + disclaimer */}
      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <Reveal>
          <Callout tone="cy" title="Тэсвэртэй байдал — AI унасан ч signal амьд">
            <ul className="space-y-2">
              {[
                "Ижил signal + indicator утгад AI дахин дуудагдахгүй (TTL fingerprint cache)",
                "AI timeout / 5xx / rate limit → ai_status=unavailable, signal хэвээрээ",
                "QWEN_API_KEY хоосон → ai_status=disabled, signal engine хэвийн",
                "AI signal-ийг өөрчлөх гэж оролдвол (tampering) тайлбар устгагдана",
                "AI хариу Pydantic-аар validate хийгдэнэ (зөвхөн текст талбар)",
              ].map((t) => (
                <li key={t} className="flex gap-2">
                  <span className="mt-0.5 shrink-0 text-cy">
                    <IcCheck className="h-3.5 w-3.5" />
                  </span>
                  <span>{t}</span>
                </li>
              ))}
            </ul>
          </Callout>
        </Reveal>
        <Reveal delay={100}>
          <Callout tone="wait" title="Сануулга">
            {DISCLAIMER}
          </Callout>
        </Reveal>
      </div>

      {/* test coverage chips */}
      <Reveal delay={120}>
        <div className="mt-6">
          <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.18em] text-dim">Тест coverage</p>
          <div className="flex flex-wrap gap-2">
            {[
              "signal: BUY",
              "signal: SELL",
              "signal: WAIT",
              "5M/15M зөрчил",
              "дутуу өгөгдөл",
              "SL/TP тооцоо",
              "Qwen success",
              "Qwen timeout",
              "Qwen 5xx",
              "Qwen rate limit",
              "API key дутуу",
              "буруу AI хариу",
              "signal tampering",
              "AIгүй үед signal амьд",
              "AI cache",
            ].map((t) => (
              <Chip key={t} tone={t.startsWith("Qwen") || t.startsWith("AI") || t.startsWith("буруу") || t.startsWith("signal tamper") || t.startsWith("API key") ? "wait" : "buy"}>
                {t}
              </Chip>
            ))}
          </div>
        </div>
      </Reveal>
    </section>
  );
}

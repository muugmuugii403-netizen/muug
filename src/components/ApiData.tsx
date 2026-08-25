import type { ReactNode } from "react";
import { ADAPTER_PY, ENDPOINTS, ERROR_JSON, PROVIDERS, RESPONSE_JSON, type Provider } from "../data";
import { Callout, Chip, CodeBlock, MethodBadge, Reveal, SectionHead } from "./bits";

/* ================= 04 · API endpoints ================= */

function RecBadge({ rec }: { rec: Provider["rec"] }): ReactNode {
  switch (rec) {
    case "primary":
      return <Chip tone="buy">✓ PRIMARY</Chip>;
    case "fallback":
      return <Chip tone="wait">FALLBACK</Chip>;
    case "no":
      return <Chip tone="sell">✕ АВАХГҮЙ</Chip>;
    case "viz":
      return <Chip tone="cy">LIB</Chip>;
  }
}

export function ApiSection(): ReactNode {
  return (
    <section id="api" className="scroll-mt-28">
      <SectionHead
        num="04"
        kicker="REST Contract"
        title="API endpoint төлөвлөгөө"
        desc="Бүх зам /api/v1 prefix-тэй, JSON хариутай, нэгдсэн error contract-тай. Үндсэн endpoint нь GET /analysis/{symbol} — нэг хүсэлтээр бүрэн шинжилгээ."
      />
      <div className="grid gap-8 lg:grid-cols-[0.95fr_1.05fr] lg:gap-10">
        <div className="min-w-0">
          <Reveal>
            <div className="overflow-hidden rounded-md border border-line bg-deep/60">
              <p className="border-b border-line bg-panel px-4 py-2.5 font-mono text-[10.5px] tracking-[0.2em] text-dim uppercase">
                endpoints · v1
              </p>
              <div className="divide-y divide-line">
                {ENDPOINTS.map((e) => (
                  <div
                    key={e.p + e.m}
                    className={`group flex items-start gap-3 px-4 py-3 transition-colors hover:bg-panel ${
                      e.star ? "border-l-[3px] border-l-buy bg-buy/[0.04]" : ""
                    }`}
                  >
                    <MethodBadge m={e.m} />
                    <div className="min-w-0 flex-1">
                      <p className="font-mono text-[12.5px] break-all text-mist">
                        {e.p}
                        {e.star ? <span className="ml-2 text-buy">★ гол</span> : null}
                      </p>
                      <p className="mt-0.5 text-[13px] text-fog">{e.d}</p>
                      {e.extra ? <p className="mt-0.5 font-mono text-[11px] text-dim">{e.extra}</p> : null}
                    </div>
                    <span className="mt-0.5 shrink-0 rounded-sm border border-line px-1.5 py-px font-mono text-[10px] text-dim">
                      {e.phase}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </Reveal>
          <Reveal delay={120}>
            <CodeBlock title="error_contract.json" lang="http" code={ERROR_JSON} className="mt-6" />
          </Reveal>
          <Reveal delay={160}>
            <div className="mt-6 grid gap-2 sm:grid-cols-3">
              {[
                ["Cache-Control", "нийтлэг өгөгдөлд 60s"],
                ["Pagination", "limit ≤ 500 · cursor"],
                ["Idempotency", "GET бүр давтагдах боломжтой"],
              ].map(([t, d]) => (
                <div key={t} className="rounded-sm border border-line bg-deep/50 px-3 py-2.5 transition-colors hover:border-edge">
                  <p className="font-mono text-[11.5px] text-cy">{t}</p>
                  <p className="mt-0.5 text-[12px] text-fog">{d}</p>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
        <Reveal delay={100} className="lg:sticky lg:top-24 lg:self-start">
          <CodeBlock title="GET /api/v1/analysis/EURUSD · 200 OK" lang="json" code={RESPONSE_JSON} />
          <p className="mt-3 font-mono text-[11.5px] leading-relaxed text-dim">
            ▲ Энэ нэг хариунд frontend-ийн бүх панель дүүрнэ: SignalPanel (scores), TradePlanCard (trade),
            IndicatorTable (indicators), MtfMatrix (timeframes), “Яагаад?” (reasons), AI тайлбар (explanation).
          </p>
        </Reveal>
      </div>
    </section>
  );
}

/* ================= 05 · market data sources ================= */

export function DataSection(): ReactNode {
  return (
    <section id="data" className="scroll-mt-28">
      <SectionHead
        num="05"
        kicker="Market Data"
        title="Market data хаанаас авах вэ?"
        desc="Adapter pattern-аар эх сурвалжийг солих боломжтой. MVP-д Twelve Data, production-д OANDA stream руу шилжихээр төлөвлөв."
      />
      <Reveal>
        <div className="overflow-x-auto rounded-md border border-line bg-deep/60">
          <table className="w-full min-w-[680px] text-left">
            <thead>
              <tr className="border-b border-line bg-panel">
                {["Эх сурвалж", "Төрөл", "Үнэгүй хязгаар", "Хоцрогдол", "Үүрэг системд"].map((h) => (
                  <th key={h} className="px-4 py-2.5 font-mono text-[10.5px] font-medium tracking-[0.15em] text-dim uppercase">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {PROVIDERS.map((p) => (
                <tr key={p.name} className="align-top transition-colors hover:bg-panel">
                  <td className="px-4 py-3">
                    <span className="font-mono text-[13px] font-semibold text-mist">{p.name}</span>
                    <div className="mt-1">
                      <RecBadge rec={p.rec} />
                    </div>
                  </td>
                  <td className="px-4 py-3 text-[13px] text-fog">{p.type}</td>
                  <td className="px-4 py-3 font-mono text-[12px] text-fog">{p.free}</td>
                  <td className="px-4 py-3 font-mono text-[12px] text-fog">{p.speed}</td>
                  <td className="px-4 py-3 text-[13px] leading-relaxed text-fog">{p.role}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Reveal>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Reveal delay={80}>
          <CodeBlock title="market_data.py · adapter pattern" lang="python" code={ADAPTER_PY} />
        </Reveal>
        <div className="space-y-4">
          <Reveal delay={140}>
            <Callout tone="cy" title="Rate budget тооцоо">
              Нэг шинжилгээ = 5 timeframe × ~300 лаа. 800 credit/өдөр ≈ <b className="text-mist">160 шинжилгээ/өдөр</b> —
              MVP-д хүрэлцээтэй. 5 минутын DB cache нь давхардсан хүсэлтийг 80%+ хэмнэнэ.
            </Callout>
          </Reveal>
          <Reveal delay={200}>
            <Callout tone="wait" title="Түгээмэл андуурал">
              TradingView Lightweight Charts бол <b className="text-mist">зөвхөн зурах номын сан</b> — өгөгдөл өгдөггүй.
              Лаа, EMA шугамыг бид API-аас авсан JSON-оороо өөрсдөө тэжээнэ.
            </Callout>
          </Reveal>
          <Reveal delay={260}>
            <div className="rounded-md border border-line bg-deep/50 p-4">
              <p className="font-mono text-[10.5px] tracking-[0.2em] text-dim uppercase">Алдаа тэсвэрлэлт</p>
              <ul className="mt-2.5 space-y-1.5 text-[13.5px] text-fog">
                <li className="flex gap-2"><span className="text-cy">▸</span> Timeout 5s → retry 3 → exponential backoff (1s·2s·4s)</li>
                <li className="flex gap-2"><span className="text-wait">▸</span> 429 авбал RateLimit-Header хүртэл зогсоно</li>
                <li className="flex gap-2"><span className="text-sell">▸</span> 3 удаа дараалан унавал circuit breaker → yfinance</li>
              </ul>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

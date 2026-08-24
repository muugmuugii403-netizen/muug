"use client";

/**
 * Нүүр хуудас (Step 1):
 *  1. Backend-ийн холболтын статусыг /health-ээр шалгана (latency-тай)
 *  2. Pair жагсаалтыг /pairs-аас авна
 *  3. Шинжилгээний хүсэлтийг /analysis руу илгээнэ → одоогоор 501 (engine Step 2)
 */
import { useCallback, useEffect, useState } from "react";
import { PairSelector } from "@/components/PairSelector";
import { ApiError, API_BASE_URL, getHealth, getPairs, postAnalysis } from "@/lib/api";
import type { AnalysisRequest, HealthResponse, PairInfo } from "@/lib/types";

type Status<T> =
  | { state: "loading" }
  | { state: "ok"; data: T; latencyMs?: number }
  | { state: "error"; message: string };

export default function HomePage() {
  const [health, setHealth] = useState<Status<HealthResponse>>({ state: "loading" });
  const [pairs, setPairs] = useState<Status<PairInfo[]>>({ state: "loading" });
  const [analysis, setAnalysis] = useState<{ busy: boolean; error: ApiError | null }>({
    busy: false,
    error: null,
  });

  const checkHealth = useCallback(async (): Promise<void> => {
    setHealth({ state: "loading" });
    const t0 = performance.now();
    try {
      const data = await getHealth();
      setHealth({ state: "ok", data, latencyMs: Math.round(performance.now() - t0) });
    } catch (e) {
      setHealth({ state: "error", message: e instanceof ApiError ? e.message : "Тодорхойгүй алдаа" });
    }
  }, []);

  useEffect(() => {
    void checkHealth();
    getPairs()
      .then((data) => setPairs({ state: "ok", data }))
      .catch((e: unknown) =>
        setPairs({ state: "error", message: e instanceof ApiError ? e.message : "Pair жагсаалт авч чадсангүй" }),
      );
  }, [checkHealth]);

  const handleAnalyze = useCallback(async (req: AnalysisRequest): Promise<void> => {
    setAnalysis({ busy: true, error: null });
    try {
      await postAnalysis(req);
      // Step 1-д энд хүрэхгүй (backend 501 буцаана)
      setAnalysis({ busy: false, error: new ApiError("Гэнэтийн амжилт — engine аль хэдийн хэрэгжсэн үү?", 202, "unexpected") });
    } catch (e) {
      setAnalysis({ busy: false, error: e instanceof ApiError ? e : new ApiError("Тодорхойгүй алдаа", 0, "unknown") });
    }
  }, []);

  return (
    <main className="mx-auto w-full max-w-5xl px-5 py-10 sm:px-8">
      {/* Header */}
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-6">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-cy">Forex Analyzer</p>
          <h1 className="mt-1 text-2xl font-bold text-mist">Зах зээлийн дүн шинжилгээ</h1>
        </div>
        <span className="rounded-sm border border-line px-3 py-1.5 font-mono text-[12px] text-fog">
          Step 1 · scaffold
        </span>
      </header>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_1.1fr]">
        {/* Зүүн: холболтын статус */}
        <section className="space-y-4">
          <div className="rounded-md border border-line bg-panel/60 p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-mist">Backend холболт</h2>
              <button
                type="button"
                onClick={() => void checkHealth()}
                className="rounded-sm border border-line px-2.5 py-1 font-mono text-[11px] text-fog transition-colors hover:border-edge hover:text-mist"
              >
                ↻ дахин шалгах
              </button>
            </div>
            <p className="mt-1 truncate font-mono text-[11.5px] text-dim">GET {API_BASE_URL}/health</p>

            {health.state === "loading" && (
              <p className="mt-4 animate-pulse font-mono text-[13px] text-fog">Шалгаж байна…</p>
            )}
            {health.state === "ok" && (
              <div className="mt-4 flex items-center gap-3">
                <span className="led h-2.5 w-2.5 rounded-full bg-buy" />
                <p className="font-mono text-[13px] text-buy">
                  status: ok · v{health.data.version} · env: {health.data.env}
                </p>
                {health.latencyMs !== undefined && (
                  <span className="ml-auto font-mono text-[12px] text-dim">{health.latencyMs}ms</span>
                )}
              </div>
            )}
            {health.state === "error" && (
              <div className="mt-4 rounded-sm border border-sell/40 bg-sell/10 px-3 py-2.5">
                <p className="font-mono text-[12.5px] text-sell">✕ {health.message}</p>
                <p className="mt-1 text-[12.5px] text-fog">
                  Backend ажиллаж байна уу? <code className="font-mono text-mist">make dev-api</code>
                </p>
              </div>
            )}
          </div>

          {/* Pair жагсаалт */}
          <div className="rounded-md border border-line bg-panel/60 p-5">
            <h2 className="text-sm font-semibold text-mist">Дэмжигдэх pair-ууд</h2>
            <p className="mt-1 font-mono text-[11.5px] text-dim">GET {API_BASE_URL}/pairs</p>
            {pairs.state === "loading" && (
              <div className="mt-4 space-y-2">
                {Array.from({ length: 3 }, (_, i) => (
                  <div key={i} className="h-8 animate-pulse rounded-sm bg-panel2" />
                ))}
              </div>
            )}
            {pairs.state === "ok" && (
              <ul className="mt-3 divide-y divide-line">
                {pairs.data.map((p) => (
                  <li key={p.symbol} className="flex items-center justify-between py-2 font-mono text-[13px]">
                    <span className="text-mist">{p.symbol}</span>
                    <span className="text-dim">{p.name}</span>
                  </li>
                ))}
              </ul>
            )}
            {pairs.state === "error" && (
              <p className="mt-3 font-mono text-[12.5px] text-sell">✕ {pairs.message}</p>
            )}
          </div>
        </section>

        {/* Баруун: сонголт + хүсэлт */}
        <div>
          <PairSelector
            pairs={pairs.state === "ok" ? pairs.data : []}
            loading={pairs.state === "loading"}
            busy={analysis.busy}
            onSubmit={(req) => void handleAnalyze(req)}
          />

          {analysis.error && (
            <div className="mt-4 rounded-md border border-wait/45 bg-wait/[0.06] p-4">
              <p className="font-mono text-[12px] text-wait">
                HTTP {analysis.error.status} · {analysis.error.code}
              </p>
              <p className="mt-1 text-[13.5px] text-fog">{analysis.error.message}</p>
              <p className="mt-2 text-[12.5px] text-dim">
                Энэ бол Step 1-ийн <b className="text-mist">хүлээгдэж буй</b> хариу: оролт validate хийгдсэн боловч
                deterministic engine Step 2-т хэрэгжинэ.
              </p>
            </div>
          )}

          <p className="mt-4 rounded-md border border-line bg-panel/40 p-4 text-[12.5px] leading-relaxed text-dim">
            ⚠ Энэ систем баталгаатай ашиг амлахгүй. Signal нь зөвхөн техникийн indicator дээр суурилсан
            deterministic дүрмээр гарах ба AI тайлбар нь зөвлөгөө биш.
          </p>
        </div>
      </div>
    </main>
  );
}

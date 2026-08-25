/**
 * Backend руу хандах цорын ганц цэг (API client).
 *
 * - Timeout: AbortController (default 8s)
 * - Retry: exponential backoff — ЗӨВХӨН 5xx болон сүлжээний алдаанд (4xx-ийг дахин оролдохгүй)
 * - Алдаа: бүгд нэгдсэн ApiError болж хувирна
 * - Env: NEXT_PUBLIC_API_BASE_URL (zod-оор validate хийгдэнэ)
 */
import { z } from "zod";
import type { AnalysisRequest, ApiErrorBody, HealthResponse, PairInfo } from "./types";

const envSchema = z.object({
  NEXT_PUBLIC_API_BASE_URL: z.string().url().default("http://localhost:8000/api/v1"),
});

const ENV = envSchema.parse({
  NEXT_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL,
});

export const API_BASE_URL: string = ENV.NEXT_PUBLIC_API_BASE_URL;

/** Market data endpoint-үүд /api/forex доор байрладаг (v1 биш) — URL-аас гаргаж авна. */
export const FOREX_BASE_URL: string = API_BASE_URL.replace(/\/v1\/?$/, "/forex");

/** /api язгуур (v1, forex аль алиныг агуулсан). */
export const API_ROOT_URL: string = API_BASE_URL.replace(/\/v1\/?$/, "");

/** SSE урсгалын URL — server→client realtime event. */
export const STREAM_EVENTS_URL: string = `${API_ROOT_URL}/stream/events`;

/** Бүх API алдааны нэгдсэн класс. */
export class ApiError extends Error {
  readonly status: number; // HTTP статус; 0 = сүлжээ/timeout
  readonly code: string; // validation_error | timeout | network | not_implemented | …

  constructor(message: string, status: number, code: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

export interface FetchOptions {
  method?: "GET" | "POST";
  body?: unknown;
  timeoutMs?: number;
  retries?: number;
  /** Өөр base URL (жишээ нь FOREX_BASE_URL); үгүй бол API_BASE_URL */
  base?: string;
}

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

async function toApiError(res: Response): Promise<ApiError> {
  let body: ApiErrorBody | null = null;
  try {
    body = (await res.json()) as ApiErrorBody;
  } catch {
    /* хариу JSON биш байж болно */
  }
  return new ApiError(body?.detail ?? res.statusText, res.status, body?.error ?? "http_error");
}

export async function apiFetch<T>(path: string, opts: FetchOptions = {}): Promise<T> {
  const { method = "GET", body, timeoutMs = 8000, retries = 2, base } = opts;
  let lastError: ApiError = new ApiError("Тодорхойгүй алдаа", 0, "unknown");

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(`${base ?? API_BASE_URL}${path}`, {
        method,
        headers: {
          Accept: "application/json",
          ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });
      if (res.ok) return (await res.json()) as T;

      const err = await toApiError(res);
      if (err.status < 500) throw err; // client алдааг retry хийхгүй
      lastError = err;
    } catch (e) {
      if (e instanceof ApiError && e.status < 500) throw e;
      const timedOut = e instanceof DOMException && e.name === "AbortError";
      lastError =
        e instanceof ApiError
          ? e
          : new ApiError(
              timedOut ? `Хүсэлт хэт удаан (> ${timeoutMs}ms)` : "Сүлжээний алдаа — сервертэй холбогдохгүй байна",
              0,
              timedOut ? "timeout" : "network",
            );
    } finally {
      clearTimeout(timer);
    }
    if (attempt < retries) await sleep(300 * 2 ** attempt); // 300ms → 600ms → 1200ms
  }
  throw lastError;
}

/* ---------------- Endpoint-ууд (typed wrappers) ---------------- */

export const getHealth = (): Promise<HealthResponse> =>
  apiFetch<HealthResponse>("/health", { retries: 0, timeoutMs: 5000 });

export const getPairs = (): Promise<PairInfo[]> => apiFetch<PairInfo[]>("/pairs");

/** Step 1-д backend 501 буцаана — engine Step 2-т ирнэ. */
export const postAnalysis = (req: AnalysisRequest): Promise<never> =>
  apiFetch<never>("/analysis", { method: "POST", body: req, retries: 0 });

/**
 * API contract төрлүүд — backend/app/schemas/analysis.py-тай 1:1 тохирно.
 * Wire format: snake_case (backend-ын Pydantic гаралттай ижил).
 */

/** Multi-timeframe шинжилгээний timeframe-ууд (Step 2-оос бүрэн ашиглагдана). */
export const TIMEFRAMES = ["5m", "15m", "1h", "4h", "1d"] as const;
export type Timeframe = (typeof TIMEFRAMES)[number];

/** Дэмжигдэх Forex pair-ийн мэдээлэл (GET /pairs). */
export interface PairInfo {
  symbol: string; // "EUR/USD"
  name: string; // "Euro / US Dollar"
  pip_decimals: number; // EUR/USD → 5, USD/JPY → 3
}

/** GET /health хариу. */
export interface HealthResponse {
  status: "ok";
  version: string;
  env: string;
  utc_now: string; // ISO-8601
}

/** POST /analysis хүсэлт. */
export interface AnalysisRequest {
  symbol: string;
  timeframe: Timeframe;
}

/** Нэгдсэн алдааны формат — бүх endpoint ижил хэлбэрээр буцаана. */
export interface ApiErrorBody {
  error: string; // machine-readable код: validation_error | not_implemented | …
  detail: string; // хүнд уншигдахуйц мессеж
  path: string | null;
  utc_now: string;
}

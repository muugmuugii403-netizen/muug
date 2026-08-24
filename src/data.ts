/* ------------------------------------------------------------------ */
/*  Forex Analyzer — Blueprint v1.0 · бүх төлөвлөгөөний өгөгдөл        */
/* ------------------------------------------------------------------ */

export interface NavItem {
  id: string;
  num: string;
  label: string;
}

export const NAV: NavItem[] = [
  { id: "arch", num: "01", label: "Системийн архитектур" },
  { id: "folders", num: "02", label: "Folder бүтэц" },
  { id: "flow", num: "03", label: "Өгөгдлийн урсгал" },
  { id: "api", num: "04", label: "API төлөвлөгөө" },
  { id: "data", num: "05", label: "Market data эх сурвалж" },
  { id: "scoring", num: "06", label: "Scoring алгоритм" },
  { id: "db", num: "07", label: "Database схем" },
  { id: "phases", num: "08", label: "Хөгжүүлэлтийн үе шат" },
  { id: "security", num: "09", label: "Аюулгүй байдал" },
];

/* ---------------- ticker (жишээ котировка) ---------------- */

export interface TickerPair {
  s: string;
  p: string;
  d: number; // хувь, сөрөг = уналт
}

export const TICKER: TickerPair[] = [
  { s: "EUR/USD", p: "1.0865", d: 0.32 },
  { s: "GBP/USD", p: "1.2712", d: -0.11 },
  { s: "USD/JPY", p: "149.82", d: 0.45 },
  { s: "AUD/USD", p: "0.6541", d: -0.08 },
  { s: "USD/CAD", p: "1.3576", d: 0.05 },
  { s: "USD/CHF", p: "0.8823", d: -0.19 },
  { s: "NZD/USD", p: "0.5988", d: 0.12 },
  { s: "DXY", p: "104.21", d: -0.21 },
  { s: "XAU/USD", p: "2384.50", d: 0.67 },
];

/* ---------------- 02 · folder tree ---------------- */

export interface FolderNode {
  n: string; // нэр
  t: "d" | "f"; // dir | file
  note?: string;
  c?: FolderNode[];
}

export const TREE: FolderNode = {
  n: "forex-analyzer/",
  t: "d",
  note: "monorepo үндэс",
  c: [
    { n: ".github/", t: "d", c: [{ n: "workflows/ci.yml", t: "f", note: "lint + test + build" }] },
    {
      n: "frontend/",
      t: "d",
      note: "Next.js 15 · App Router",
      c: [
        {
          n: "src/",
          t: "d",
          c: [
            {
              n: "app/",
              t: "d",
              c: [
                { n: "layout.tsx", t: "f" },
                { n: "page.tsx", t: "f", note: "dashboard · pair сонгох" },
                { n: "analysis/[symbol]/page.tsx", t: "f", note: "pair бүрийн шинжилгээ" },
              ],
            },
            {
              n: "components/",
              t: "d",
              c: [
                { n: "charts/CandleChart.tsx", t: "f", note: "TradingView Lightweight Charts" },
                { n: "charts/IndicatorOverlay.tsx", t: "f", note: "EMA 20/50/200 шугам" },
                { n: "panels/SignalPanel.tsx", t: "f", note: "BUY/SELL/WAIT оноо" },
                { n: "panels/TradePlanCard.tsx", t: "f", note: "Entry · SL · TP · RR" },
                { n: "panels/IndicatorTable.tsx", t: "f" },
                { n: "panels/MtfMatrix.tsx", t: "f", note: "5m·15m·1H·4H·1D" },
                { n: "panels/AIExplanation.tsx", t: "f", note: "Qwen тайлбар · AI label" },
                { n: "ui/", t: "d", note: "skeleton, toast, button…" },
              ],
            },
            {
              n: "lib/",
              t: "d",
              c: [
                { n: "api.ts", t: "f", note: "typed fetch · timeout 10s · retry 2" },
                { n: "query.ts", t: "f", note: "TanStack Query keys + options" },
                { n: "format.ts", t: "f", note: "pip / үнэ / хувь формат" },
              ],
            },
            { n: "hooks/", t: "d", note: "useAnalysis, usePairs…" },
            { n: "types/index.ts", t: "f", note: "AnalysisResponse, Candle…" },
            { n: "styles/globals.css", t: "f" },
          ],
        },
        { n: ".env.local", t: "f", note: "зөвхөн NEXT_PUBLIC_API_URL" },
        { n: "next.config.ts", t: "f" },
        { n: "tsconfig.json", t: "f", note: "strict: true" },
      ],
    },
    {
      n: "backend/",
      t: "d",
      note: "Python 3.12 · FastAPI",
      c: [
        {
          n: "app/",
          t: "d",
          c: [
            { n: "main.py", t: "f", note: "FastAPI app + middleware" },
            {
              n: "api/",
              t: "d",
              c: [
                { n: "deps.py", t: "f", note: "auth · db session dependency" },
                { n: "routes/analysis.py", t: "f", note: "/analysis/{symbol} ⭐" },
                { n: "routes/candles.py", t: "f" },
                { n: "routes/pairs.py", t: "f" },
                { n: "routes/news.py", t: "f" },
                { n: "routes/health.py", t: "f" },
              ],
            },
            {
              n: "core/",
              t: "d",
              c: [
                { n: "config.py", t: "f", note: "pydantic-settings · .env" },
                { n: "security.py", t: "f", note: "JWT · password hashing" },
                { n: "logging.py", t: "f", note: "structured log" },
              ],
            },
            {
              n: "services/",
              t: "d",
              note: "изнес логик",
              c: [
                { n: "market_data.py", t: "f", note: "Twelve Data adapter · retry/backoff" },
                { n: "indicator_engine.py", t: "f", note: "pandas-ta: EMA·RSI·MACD·ATR·S/R" },
                { n: "scoring_engine.py", t: "f", note: "deterministic дүрэм · pure function" },
                { n: "risk.py", t: "f", note: "Entry/SL/TP/RR · confidence" },
                { n: "ai_explainer.py", t: "f", note: "Qwen · зөвхөн тайлбар · fallback" },
                { n: "news_calendar.py", t: "f", note: "эдийн засгийн хуанли" },
              ],
            },
            {
              n: "db/",
              t: "d",
              c: [
                { n: "models.py", t: "f", note: "SQLAlchemy ORM" },
                { n: "session.py", t: "f", note: "async engine" },
              ],
            },
            { n: "schemas/", t: "d", note: "Pydantic request/response" },
            { n: "utils/", t: "d", note: "retry · circuit breaker · time" },
          ],
        },
        { n: "alembic/", t: "d", note: "DB migration" },
        { n: "tests/", t: "d", c: [{ n: "test_scoring.py", t: "f", note: "deterministic engine тест" }] },
        { n: ".env", t: "f", note: "⚠ DB_URL · MARKET_DATA_KEY · QWEN_KEY — server only" },
        { n: "pyproject.toml", t: "f", note: "type hints · mypy strict" },
      ],
    },
    { n: "docker-compose.yml", t: "f", note: "postgres + backend + frontend" },
    { n: ".env.example", t: "f", note: "commit хийгдэнэ · нууц утгагүй" },
    { n: "README.md", t: "f" },
  ],
};

/* ---------------- 03 · өгөгдлийн урсгал ---------------- */

export interface FlowStep {
  n: number;
  title: string;
  desc: string;
  tags: string[];
}

export const FLOW: FlowStep[] = [
  {
    n: 1,
    title: "Хэрэглэгч pair сонгоно",
    desc: "Next.js dashboard дээр EUR/USD гэх мэт pair сонгогдоно. Хүсэлтийг TanStack Query удирдана (cache, stale-time 60s).",
    tags: ["frontend", "pair whitelist"],
  },
  {
    n: 2,
    title: "GET /api/v1/analysis/EURUSD",
    desc: "Typed fetch клиент хүсэлт илгээнэ. Timeout 10 сек, амжилтгүй бол 2 удаа retry, exponential backoff.",
    tags: ["HTTPS", "timeout 10s", "retry ×2"],
  },
  {
    n: 3,
    title: "FastAPI input validation",
    desc: "Pydantic v2: symbol зөвхөн whitelist-ээс, timeframe enum (5m,15m,1H,4H,1D), limit ≤ 500. Буруу утга → 422 + нэгдсэн error contract.",
    tags: ["Pydantic v2", "422"],
  },
  {
    n: 4,
    title: "Cache шалгалт (PostgreSQL)",
    desc: "Сүүлийн 5 минутын candles DB-д байна уу? Тийм бол provider руу дахин хандахгүй — rate limit хэмнэнэ.",
    tags: ["SQL", "TTL 5 мин"],
  },
  {
    n: 5,
    title: "Market data татах",
    desc: "Twelve Data-аас 5 timeframe-ийн OHLCV-г async-оор авна. Timeout 5s, retry 3, 429 авахад exponential backoff. Амжилтгүй бол yfinance fallback. Candles-ийг DB-д хадгална.",
    tags: ["Twelve Data", "retry ×3", "fallback"],
  },
  {
    n: 6,
    title: "Indicator engine (pandas + pandas-ta)",
    desc: "Timeframe тус бүрд: EMA 20/50/200, RSI 14, MACD(12,26,9), ATR 14, support/resistance (swing high/low), price action pattern (engulfing, pin bar, HH/HL бүтэц).",
    tags: ["pandas-ta", "10 indicator"],
  },
  {
    n: 7,
    title: "Scoring engine — DETERMINISTIC",
    desc: "Цэвэр функц: indicator утгууд → онооны дүрмүүд → BUY/SELL/WAIT оноо + entry/SL/TP/RR + confidence + reasons[]. Үр дүн signals хүснэгтэд бичигдэнэ. Энд AI оролцохгүй.",
    tags: ["pure function", "no AI"],
  },
  {
    n: 8,
    title: "Qwen тайлбарлагч",
    desc: "Scoring JSON-г Qwen API руу илгээж хүнд уншигданаар хэлбэртэй тайлбар авна. Timeout 8s, амжилтгүй бол template fallback. Signal-ийг өөрчлөх эрхгүй — зөвхөн text.",
    tags: ["Qwen API", "explain-only", "fallback"],
  },
  {
    n: 9,
    title: "Frontend рэндэр",
    desc: "JSON хариу ирнэ: Lightweight Charts дээр лаа + EMA overlay, SignalPanel оноо, TradePlanCard, “Яагаад?” шалтгаанууд, AI тайлбар. Loading skeleton + error state бэлэн.",
    tags: ["SSR", "skeleton", "error state"],
  },
];

/* ---------------- 04 · API endpoints ---------------- */

export interface Endpoint {
  m: "GET" | "POST";
  p: string;
  d: string;
  extra?: string;
  phase: string;
  star?: boolean;
}

export const ENDPOINTS: Endpoint[] = [
  { m: "GET", p: "/api/v1/health", d: "Системийн төлөв", extra: "→ { status, db, version, latency_ms }", phase: "P0" },
  { m: "GET", p: "/api/v1/pairs", d: "Дэмжигдсэн pair жагсаалт + pip size", extra: "→ Pair[] · frontend selector үүгээр дүүргэнэ", phase: "P1" },
  {
    m: "GET",
    p: "/api/v1/candles/{symbol}",
    d: "OHLCV лаанууд",
    extra: "?timeframe=1H&limit=300 (≤500) → Candle[]",
    phase: "P1",
  },
  {
    m: "GET",
    p: "/api/v1/analysis/{symbol}",
    d: "БҮРЭН ШИНЖИЛГЭЭ + SIGNAL",
    extra: "5 timeframe, бүх indicator, оноо, trade plan, reasons, тайлбар",
    phase: "P2–5",
    star: true,
  },
  { m: "POST", p: "/api/v1/analysis/{symbol}/explain", d: "AI тайлбарыг дахин үүсгэх", extra: "scoring өөрчлөгдөхгүй, зөвхөн шинэ text", phase: "P6" },
  { m: "GET", p: "/api/v1/news", d: "Эдийн засгийн үйл явдлууд", extra: "?symbol=EURUSD&hours=48 → high-impact filter", phase: "P7" },
  { m: "GET", p: "/api/v1/signals/history", d: "Хадгалагдсан signal түүх", extra: "?symbol=&limit=20 · онооны өөрчлөлтийг харах", phase: "P7" },
  { m: "POST", p: "/api/v1/auth/register", d: "Бүртгэл үүсгэх", extra: "email + password (bcrypt hash)", phase: "P8" },
  { m: "POST", p: "/api/v1/auth/login", d: "JWT авах", extra: "access 15 мин + refresh 7 хоног", phase: "P8" },
];

export const RESPONSE_JSON = `{
  "symbol": "EURUSD",
  "timeframe": "1H",
  "generated_at": "2026-02-11T09:30:00Z",
  "signal": "BUY",
  "scores": { "buy": 78, "sell": 12, "wait": 10 },
  "confidence": 82,
  "trend": "bullish",
  "levels": { "support": 1.0842, "resistance": 1.0921 },
  "trade": {
    "entry": 1.0865,
    "stop_loss": 1.0821,
    "take_profit": 1.0941,
    "rr_ratio": 1.73
  },
  "indicators": {
    "ema20": 1.0858, "ema50": 1.0841, "ema200": 1.0799,
    "rsi14": 58.4,
    "macd": { "line": 0.0012, "signal": 0.0004, "hist": 0.0008 },
    "atr14": 0.0042
  },
  "timeframes": {
    "5m": "bearish", "15m": "bullish", "1H": "bullish",
    "4H": "bullish", "1D": "neutral"
  },
  "reasons": [
    "EMA 50 нь EMA 200-аас дээш (golden cross)",
    "MACD bullish огтлолцол + histogram өсөлттэй",
    "Үнэ support 1.0842-оос дээш байна",
    "RSI 58.4 — 30–70 бүсэд, хэт халгаагүй",
    "1H болон 4H trend bullish"
  ],
  "warnings": [
    "ECB хүүгийн шийдвэр 2 өдрийн дараа — эрсдэл өндөр"
  ],
  "explanation": {
    "source": "qwen",
    "text": "EUR/USD нь 1.0842 support-оос …"
  }
}`;

export const ERROR_JSON = `// Нэгдсэн error contract — бүх endpoint
// 400 · 404 · 422 · 429 · 502 · 504
{
  "detail": {
    "code": "SYMBOL_NOT_SUPPORTED",
    "message": "BTC/USD дэмжигдэхгүй. Зөвхөн Forex pair.",
    "hint": "GET /api/v1/pairs жагсаалтыг харна уу"
  }
}`;

/* ---------------- 05 · market data эх сурвалж ---------------- */

export interface Provider {
  name: string;
  type: string;
  free: string;
  speed: string;
  role: string;
  rec: "primary" | "fallback" | "no" | "viz";
}

export const PROVIDERS: Provider[] = [
  {
    name: "Twelve Data",
    type: "OHLCV · Forex · 8 TF",
    free: "800 credit/өдөр · 8/мин",
    speed: "1–5 мин хоцрогдол",
    role: "PRIMARY — MVP үеийн үндсэн эх сурвалж",
    rec: "primary",
  },
  {
    name: "OANDA v20",
    type: "Real-time stream + REST",
    free: "Practice account үнэгүй",
    speed: "Бодит цаг",
    role: "Production-д шилжих үндсэн эх сурвалж (WebSocket stream)",
    rec: "primary",
  },
  {
    name: "Alpha Vantage",
    type: "OHLCV",
    free: "25 хүсэлт/өдөр",
    speed: "1–15 мин",
    role: "Тохиромжгүй — 5 TF × хэдэн pair-д quota хүрэлцэхгүй",
    rec: "no",
  },
  {
    name: "Yahoo Finance",
    type: "OHLCV (албан бус)",
    free: "Үнэгүй, хязгааргүй",
    speed: "Хоцрогдолтой",
    role: "Яаралтай FALLBACK — Twelve Data унасан үед л",
    rec: "fallback",
  },
  {
    name: "TradingView Lightweight Charts",
    type: "JS chart номын сан",
    free: "Үнэгүй (Apache 2.0)",
    speed: "—",
    role: "Зөвхөн ВИЗУАЛИЗАЦИ — data source биш! Өгөгдлөө өөрөө өгнө.",
    rec: "viz",
  },
];

export const ADAPTER_PY = `# backend/app/services/market_data.py
from typing import Protocol

class MarketDataProvider(Protocol):
    async def get_candles(
        self, symbol: str, timeframe: str, limit: int
    ) -> list[Candle]: ...

# Гинжин хэлхээ: primary → fallback → DB cache
provider = FallbackChain(
    primary=TwelveDataClient(timeout=5, retries=3),
    fallback=YFinanceClient(timeout=8, retries=1),
)
# 429 → exponential backoff · 3 удаа унавал circuit breaker нээгдэнэ`;

/* ---------------- 06 · scoring engine ---------------- */

export interface ScoringRule {
  id: string;
  name: string;
  weight: number;
  bull: string;
  bear: string;
}

export const RULES: ScoringRule[] = [
  {
    id: "R1",
    name: "EMA stack (trend)",
    weight: 20,
    bull: "Үнэ > EMA20 > EMA50 > EMA200",
    bear: "Үнэ < EMA20 < EMA50 < EMA200",
  },
  {
    id: "R2",
    name: "EMA50/200 cross",
    weight: 10,
    bull: "Golden cross — EMA50 > EMA200",
    bear: "Death cross — EMA50 < EMA200",
  },
  {
    id: "R3",
    name: "MACD(12,26,9)",
    weight: 15,
    bull: "MACD > signal + histogram өсөж байна",
    bear: "MACD < signal + histogram уруудаж байна",
  },
  {
    id: "R4",
    name: "RSI 14",
    weight: 15,
    bull: "50–70 бүс + дээш хандлага (>70 бол зөвхөн сануулга)",
    bear: "30–50 бүс + доош хандлага (<30 бол зөвхөн сануулга)",
  },
  {
    id: "R5",
    name: "Support / Resistance",
    weight: 15,
    bull: "Үнэ support-оос дээш, resistance-аас хол",
    bear: "Үнэ resistance-аас доош, support руу ойртож байна",
  },
  {
    id: "R6",
    name: "Price action",
    weight: 10,
    bull: "HH/HL бүтэц, bullish engulfing / pin bar",
    bear: "LH/LL бүтэц, bearish engulfing / shooting star",
  },
  {
    id: "R7",
    name: "Multi-timeframe нийцэл",
    weight: 15,
    bull: "15m·1H·4H·1D дийлэнх нь bullish",
    bear: "15m·1H·4H·1D дийлэнх нь bearish",
  },
];

export const FORMULA_TXT = `# Оноо хуваарилалт (нийт жин = 100)
BUY  = Σ bullish цэгүүд        # дүрэм бүр жингээ хуваарилна
SELL = Σ bearish цэгүүд
WAIT = 100 − BUY − SELL        # саармаг дүрмүүдийн жин

# Шийдвэрийн босго — 3 нөхцөл ЗЭРЭГ биелнэ
signal = BUY   if BUY  ≥ 55 and (BUY − SELL)  ≥ 25 and RR ≥ 1.5
signal = SELL  if SELL ≥ 55 and (SELL − BUY) ≥ 25 and RR ≥ 1.5
signal = WAIT  otherwise

# Эрсдэлийн тооцоо (BUY жишээ)
SL = support − 1.0 × ATR14
TP = entry + (1.5 … 2.0) × ATR14   # эсвэл resistance
RR = |TP − entry| / |entry − SL|   # RR < 1.5 бол WAIT + шалтгаан

# Итгэл (confidence 0–100)
confidence = margin(0–60) + MTF нийцэл(0–25) + ATR горим(0–15)
confidence −= 15   # 6 цагийн дотор high-impact news байвал (+ warning)`;

/* --- interactive demo: жишээ өгөгдөл + ижил дүрэм --- */

export interface DemoRule {
  key: string;
  name: string;
  w: number;
  bull: number;
  bear: number;
  neutral: number;
  note: string;
}

export interface DemoPair {
  sym: string;
  pair: string;
  tf: string;
  trend: string;
  confidence: number;
  support: string;
  resistance: string;
  trade: { entry: string; sl: string; tp: string; rr: number } | null;
  warnings: string[];
  rules: DemoRule[];
}

export const DEMO_PAIRS: DemoPair[] = [
  {
    sym: "EURUSD",
    pair: "EUR/USD",
    tf: "1H",
    trend: "bullish",
    confidence: 82,
    support: "1.0842",
    resistance: "1.0921",
    trade: { entry: "1.0865", sl: "1.0821", tp: "1.0941", rr: 1.73 },
    warnings: ["ECB хүүгийн шийдвэр 2 өдрийн дараа — байрлалын хэмжээг багасга"],
    rules: [
      { key: "R1", name: "EMA stack", w: 20, bull: 20, bear: 0, neutral: 0, note: "Үнэ > EMA20 > EMA50 > EMA200 — цэвэр bullish stack" },
      { key: "R2", name: "EMA50/200", w: 10, bull: 10, bear: 0, neutral: 0, note: "Golden cross: EMA50 1.0841 > EMA200 1.0799" },
      { key: "R3", name: "MACD", w: 15, bull: 15, bear: 0, neutral: 0, note: "MACD 0.0012 > signal 0.0004, histogram +0.0008 өсөлттэй" },
      { key: "R4", name: "RSI 14", w: 15, bull: 11, bear: 4, neutral: 0, note: "RSI 58.4 — 50–70 бүсэд, дээш хандлагатай ч хүч сул" },
      { key: "R5", name: "S/R байрлал", w: 15, bull: 12, bear: 0, neutral: 3, note: "Support 1.0842-оос дээш; resistance 1.0921 руу ойртож буй тул бага зэрэг саармаг" },
      { key: "R6", name: "Price action", w: 10, bull: 5, bear: 2, neutral: 3, note: "Bullish engulfing + HL бүтэц; гэхдээ дээд сүүдэр урт" },
      { key: "R7", name: "MTF нийцэл", w: 15, bull: 5, bear: 6, neutral: 4, note: "1H·4H bullish ↔ 5m bearish — богино хугацаанд зөрчилтэй" },
    ],
  },
  {
    sym: "GBPUSD",
    pair: "GBP/USD",
    tf: "1H",
    trend: "range / холимог",
    confidence: 41,
    support: "1.2684",
    resistance: "1.2748",
    trade: null,
    warnings: ["Range зах дээр байна — breakout хүлээх нь зүйтэй"],
    rules: [
      { key: "R1", name: "EMA stack", w: 20, bull: 8, bear: 7, neutral: 5, note: "EMA20/50 холилдсон — тодорхой trend алга" },
      { key: "R2", name: "EMA50/200", w: 10, bull: 10, bear: 0, neutral: 0, note: "EMA50 > EMA200 хэвээр (урт хугацааны bullish суурь)" },
      { key: "R3", name: "MACD", w: 15, bull: 4, bear: 8, neutral: 3, note: "MACD доош огтолсон, histogram сөрөг болж эхэлсэн" },
      { key: "R4", name: "RSI 14", w: 15, bull: 2, bear: 1, neutral: 12, note: "RSI 49.1 — яг дунд, чиглэлгүй" },
      { key: "R5", name: "S/R байрлал", w: 15, bull: 3, bear: 3, neutral: 9, note: "Range-ийн дунд: 1.2684–1.2748 завсар" },
      { key: "R6", name: "Price action", w: 10, bull: 3, bear: 4, neutral: 3, note: "Doji дараалал — хүлээлтийн бүтэц" },
      { key: "R7", name: "MTF нийцэл", w: 15, bull: 4, bear: 5, neutral: 6, note: "TF-ууд зөрүүтэй: 15m bearish, 4H bullish, 1D саармаг" },
    ],
  },
  {
    sym: "USDJPY",
    pair: "USD/JPY",
    tf: "1H",
    trend: "bearish",
    confidence: 79,
    support: "148.90",
    resistance: "150.40",
    trade: { entry: "149.85", sl: "150.42", tp: "148.92", rr: 1.63 },
    warnings: ["BoJ мэдэгдэл энэ долоо хоногт — JPY хөдөлгөөн ихсэж болно"],
    rules: [
      { key: "R1", name: "EMA stack", w: 20, bull: 0, bear: 15, neutral: 5, note: "Үнэ < EMA20 < EMA50 — bearish stack, гэхдээ EMA200-аас дээгүүр" },
      { key: "R2", name: "EMA50/200", w: 10, bull: 0, bear: 10, neutral: 0, note: "Death cross: EMA50 < EMA200" },
      { key: "R3", name: "MACD", w: 15, bull: 0, bear: 15, neutral: 0, note: "MACD < signal, histogram −0.15 гүнзгийрч байна" },
      { key: "R4", name: "RSI 14", w: 15, bull: 3, bear: 12, neutral: 0, note: "RSI 38.2 — 30–50 бүсэд, доош хандлага" },
      { key: "R5", name: "S/R байрлал", w: 15, bull: 0, bear: 10, neutral: 5, note: "Resistance 150.40-өөс буцагдсан, support 148.90 руу чиглэж байна" },
      { key: "R6", name: "Price action", w: 10, bull: 2, bear: 6, neutral: 2, note: "Bearish engulfing + LH бүтэц; жижиг bullish залруулга байна" },
      { key: "R7", name: "MTF нийцэл", w: 15, bull: 3, bear: 8, neutral: 4, note: "1H·4H·1D bearish; 15m-д жижиг bullish divergence" },
    ],
  },
];

/* --- жишээ задалгаа (78/12/10) --- */

export interface ExampleRow {
  rule: string;
  w: number;
  bull: number;
  bear: number;
  neutral: number;
  detail: string;
}

export const EXAMPLE_78: ExampleRow[] = [
  { rule: "R1 · EMA stack", w: 20, bull: 20, bear: 0, neutral: 0, detail: "Цэвэр bullish stack → бүх жин BUY талд" },
  { rule: "R2 · Golden cross", w: 10, bull: 10, bear: 0, neutral: 0, detail: "EMA50 > EMA200 баталгаатай" },
  { rule: "R3 · MACD", w: 15, bull: 15, bear: 0, neutral: 0, detail: "Bullish огтлолцол + momentum" },
  { rule: "R4 · RSI", w: 15, bull: 11, bear: 4, neutral: 0, detail: "58.4 — bullish бүс, гэхдээ 70-д ойртох эрсдэл бага зэрэг" },
  { rule: "R5 · S/R", w: 15, bull: 12, bear: 0, neutral: 3, detail: "Support дээр, resistance хол биш → бага зэрэг саармаг" },
  { rule: "R6 · Price action", w: 10, bull: 5, bear: 2, neutral: 3, detail: "Bullish pattern давамгай, бүрэн итгэлгүй" },
  { rule: "R7 · MTF", w: 15, bull: 5, bear: 6, neutral: 4, detail: "Дунд TF bullish, богино TF зөрчилтэй" },
];

/* ---------------- 07 · DB schema ---------------- */

export interface ColumnDef {
  c: string;
  t: string;
  b?: string[];
}

export interface TableDef {
  name: string;
  desc: string;
  cols: ColumnDef[];
}

export const TABLES: TableDef[] = [
  {
    name: "users",
    desc: "Хэрэглэгчийн бүртгэл (Phase 8)",
    cols: [
      { c: "id", t: "UUID", b: ["PK"] },
      { c: "email", t: "CITEXT", b: ["UQ"] },
      { c: "password_hash", t: "TEXT" },
      { c: "created_at", t: "TIMESTAMPTZ" },
    ],
  },
  {
    name: "pairs",
    desc: "Дэмжигдсэн валютын хосууд",
    cols: [
      { c: "id", t: "SERIAL", b: ["PK"] },
      { c: "symbol", t: "VARCHAR(7)", b: ["UQ"] },
      { c: "base_currency", t: "CHAR(3)" },
      { c: "quote_currency", t: "CHAR(3)" },
      { c: "pip_size", t: "NUMERIC(8,5)" },
      { c: "is_active", t: "BOOL" },
    ],
  },
  {
    name: "candles",
    desc: "OHLCV лаа — pair × timeframe × ts unique. Сар бүрээр partition хийнэ.",
    cols: [
      { c: "id", t: "BIGSERIAL", b: ["PK"] },
      { c: "pair_id", t: "INT", b: ["FK"] },
      { c: "timeframe", t: "VARCHAR(3)" },
      { c: "ts", t: "TIMESTAMPTZ" },
      { c: "open / high / low / close", t: "NUMERIC(12,5)" },
      { c: "volume", t: "NUMERIC" },
      { c: "(pair_id, timeframe, ts)", t: "—", b: ["UQ", "IDX"] },
    ],
  },
  {
    name: "indicators_cache",
    desc: "Тооцоолсон indicator-ийн cache — дахин тооцоолохгүй",
    cols: [
      { c: "id", t: "BIGSERIAL", b: ["PK"] },
      { c: "pair_id", t: "INT", b: ["FK"] },
      { c: "timeframe / ts", t: "…" },
      { c: "ema20 · ema50 · ema200", t: "NUMERIC(12,5)" },
      { c: "rsi14", t: "NUMERIC(6,2)" },
      { c: "macd · macd_signal · macd_hist", t: "NUMERIC(12,6)" },
      { c: "atr14 · support · resistance", t: "NUMERIC(12,5)" },
      { c: "(pair_id, timeframe, ts)", t: "—", b: ["UQ"] },
    ],
  },
  {
    name: "signals",
    desc: "Scoring engine-ийн гаргасан signal бүр — бүх шалтгаан, snapshot-тай",
    cols: [
      { c: "id", t: "BIGSERIAL", b: ["PK"] },
      { c: "pair_id", t: "INT", b: ["FK"] },
      { c: "timeframe", t: "VARCHAR(3)" },
      { c: "direction", t: "ENUM(buy,sell,wait)" },
      { c: "buy_score · sell_score · wait_score", t: "SMALLINT" },
      { c: "confidence", t: "SMALLINT" },
      { c: "trend", t: "VARCHAR(10)" },
      { c: "entry_price · stop_loss · take_profit", t: "NUMERIC(12,5)" },
      { c: "rr_ratio", t: "NUMERIC(5,2)" },
      { c: "support · resistance", t: "NUMERIC(12,5)" },
      { c: "reasons · warnings · indicator_snapshot", t: "JSONB" },
      { c: "explanation_source", t: "VARCHAR(10)", b: [] },
      { c: "explanation", t: "TEXT" },
      { c: "created_at", t: "TIMESTAMPTZ", b: ["IDX"] },
    ],
  },
  {
    name: "economic_events",
    desc: "Эдийн засгийн хуанли (news risk)",
    cols: [
      { c: "id", t: "BIGSERIAL", b: ["PK"] },
      { c: "currency", t: "CHAR(3)" },
      { c: "impact", t: "VARCHAR(6)", b: ["IDX"] },
      { c: "title", t: "TEXT" },
      { c: "event_time", t: "TIMESTAMPTZ", b: ["IDX"] },
      { c: "source", t: "VARCHAR(20)" },
    ],
  },
];

export const DDL_SQL = `-- candles: хамгийн их уншигддаг хүснэгт
CREATE TABLE candles (
    id          BIGSERIAL PRIMARY KEY,
    pair_id     INT NOT NULL REFERENCES pairs(id),
    timeframe   VARCHAR(3) NOT NULL,          -- 5m 15m 1H 4H 1D
    ts          TIMESTAMPTZ NOT NULL,
    open        NUMERIC(12,5) NOT NULL,
    high        NUMERIC(12,5) NOT NULL,
    low         NUMERIC(12,5) NOT NULL,
    close       NUMERIC(12,5) NOT NULL,
    volume      NUMERIC,
    UNIQUE (pair_id, timeframe, ts)
) PARTITION BY RANGE (ts);                    -- сар бүр partition

CREATE INDEX idx_candles_lookup
    ON candles (pair_id, timeframe, ts DESC);

-- signals: JSONB нь шалтгаан + snapshot-ийг уян хадгална
CREATE TABLE signals (
    id                  BIGSERIAL PRIMARY KEY,
    pair_id             INT NOT NULL REFERENCES pairs(id),
    timeframe           VARCHAR(3) NOT NULL,
    direction           trade_direction NOT NULL,   -- ENUM(buy,sell,wait)
    buy_score           SMALLINT NOT NULL,
    sell_score          SMALLINT NOT NULL,
    wait_score          SMALLINT NOT NULL,
    confidence          SMALLINT NOT NULL,
    entry_price         NUMERIC(12,5),
    stop_loss           NUMERIC(12,5),
    take_profit         NUMERIC(12,5),
    rr_ratio            NUMERIC(5,2),
    reasons             JSONB NOT NULL DEFAULT '[]',
    warnings            JSONB NOT NULL DEFAULT '[]',
    indicator_snapshot  JSONB NOT NULL,
    explanation_source  VARCHAR(10),                -- qwen | template
    explanation         TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_signals_recent
    ON signals (pair_id, created_at DESC);`;

/* ---------------- 08 · phases ---------------- */

export interface Phase {
  n: number;
  title: string;
  days: string;
  goal: string;
  tasks: string[];
}

export const PHASES: Phase[] = [
  {
    n: 0,
    title: "Суурь бэлтгэл",
    days: "2 өдөр",
    goal: "Monorepo + орчин + CI — хөгжүүлэлтийн суурь",
    tasks: [
      "GitHub repo: forex-analyzer (monorepo: /frontend, /backend)",
      "docker-compose: PostgreSQL 15 + healthcheck",
      ".env.example + git-secrets scan",
      "GitHub Actions CI: lint → test → build",
      "Branch стратеги: main / dev / feature-*",
    ],
  },
  {
    n: 1,
    title: "Өгөгдлийн давхарга",
    days: "4 өдөр",
    goal: "Market data service + candles API + DB model",
    tasks: [
      "MarketDataProvider protocol + Twelve Data adapter",
      "Timeout 5s · retry 3 · exponential backoff · circuit breaker",
      "SQLAlchemy model + Alembic migration (6 хүснэгт)",
      "GET /candles endpoint + 5 мин DB cache",
      "yfinance fallback холболт",
    ],
  },
  {
    n: 2,
    title: "Шинжилгээний engine",
    days: "6 өдөр",
    goal: "Системийн зүрх — 100% deterministic",
    tasks: [
      "indicator_engine: EMA 20/50/200, RSI 14, MACD, ATR 14",
      "Support/Resistance илрүүлэлт (swing high/low + clustering)",
      "Price action: engulfing, pin bar, HH/HL–LH/LL бүтэц",
      "scoring_engine + risk.py (Entry/SL/TP/RR/confidence)",
      "pytest: 40+ тохиолдол, ижил оролт → ижил гаралт баталгаа",
    ],
  },
  {
    n: 3,
    title: "API давхарга",
    days: "3 өдөр",
    goal: "FastAPI route + validation + error contract",
    tasks: [
      "Pydantic v2 schema: symbol whitelist, timeframe enum",
      "Нэгдсэн error contract + HTTP статус convention",
      "Rate limit (30 req/мин/IP) + CORS whitelist",
      "Structured logging (JSON) + request_id trace",
      "Integration тест: /health, /pairs, /candles, /analysis",
    ],
  },
  {
    n: 4,
    title: "Frontend суурь",
    days: "6 өдөр",
    goal: "Next.js 15 + chart + pair сонгогч",
    tasks: [
      "App Router: dashboard + /analysis/[symbol] хуудас",
      "CandleChart (Lightweight Charts) + EMA overlay",
      "TanStack Query: timeout/retry/cache + prefetch",
      "Loading skeleton, error boundary, empty state",
      "Tailwind design system + responsive layout",
    ],
  },
  {
    n: 5,
    title: "Signal UI",
    days: "4 өдөр",
    goal: "Шинжилгээний самбарууд",
    tasks: [
      "SignalPanel: BUY/SELL/WAIT оноо + gauge",
      "TradePlanCard: Entry · SL · TP · RR + pip зай",
      "IndicatorTable + MTF matrix (5m–1D)",
      "“Яагаад?” — reasons accordion + warnings",
    ],
  },
  {
    n: 6,
    title: "AI тайлбарлагч",
    days: "3 өдөр",
    goal: "Qwen — зөвхөн тайлбар, signal биш",
    tasks: [
      "ai_explainer: scoring JSON → тайлбар text (system prompt fixed)",
      "Timeout 8s → template fallback (тайлбар хэзээ ч дутахгүй)",
      "Frontend-д “AI-ийн тайлбар” label + regenerate товч",
      "Prompt injection хамгаалалт: хэрэглэгчийн текст орохгүй",
    ],
  },
  {
    n: 7,
    title: "MTF + News",
    days: "4 өдөр",
    goal: "Олон timeframe + эдийн засгийн хуанли",
    tasks: [
      "5 TF-ийн нэгдсэн шинжилгээ + нийцлийн оноо",
      "economic_events ingest (RSS/API, 15 мин тутам)",
      "High-impact news → confidence −15 + warning",
      "Signal түүх + онооны өөрчлөлтийн график",
    ],
  },
  {
    n: 8,
    title: "Production хатуужил",
    days: "5 өдөр",
    goal: "Security + deploy + хяналт",
    tasks: [
      "JWT auth (access 15 мин + refresh) — Phase 8",
      "OWASP Top 10 аудит + dependabot",
      "Deploy: Vercel (FE) + VPS/Railway (API) + managed PostgreSQL",
      "Sentry + log мониторинг, uptime alert",
      "Load тест: /analysis p95 < 2s (cache-тай)",
    ],
  },
];

/* ---------------- 09 · security checklist ---------------- */

export const SECURITY: string[] = [
  "TypeScript strict: true · Python type hints + mypy strict",
  "Бүх API key backend-ийн .env-д; зөвхөн .env.example commit хийгдэнэ",
  "NEXT_PUBLIC_*-д нууц утга ХЭЗЭЭ Ч орохгүй — зөвхөн API URL",
  "Qwen + Twelve Data дуудлага зөвхөн server-side (FastAPI)",
  "Input validation: Pydantic (backend) + Zod (frontend), symbol whitelist",
  "CORS origin whitelist · HTTPS only · security headers",
  "Rate limit: IP бүрт 30 req/мин, 429 + Retry-After header",
  "SQLAlchemy parameterized query — raw SQL бичихгүй",
  "Timeout 5–10s · retry exponential backoff · circuit breaker",
  "Бүх төлөвт: loading skeleton / error / empty state",
  "pytest + GitHub Actions CI — scoring engine тест deterministic",
  "git-secrets scan + dependabot + log-д PII бичихгүй",
];

export const DISCLAIMER =
  "Энэ систем баталгаатай ашиг амлахгүй. Forex зах зээл өндөр эрсдэлтэй бөгөөд signal бүр зөвхөн техник дүн шинжилгээний мэдээлэл юм. Хүчтэй economic news (NFP, FOMC, CPI) гарах үед систем эрсдэлийн сануулга нэмж, confidence-ийг бууруулна — гэхдээ эцсийн шийдвэр хэрэглэгчийнх.";

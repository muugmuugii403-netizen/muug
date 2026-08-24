# Forex Analyzer — Зах зээлийн дүн шинжилгээний систем

Forex pair сонгоход систем market data авч, deterministic scoring engine-ээр
BUY / SELL / WAIT signal гаргадаг веб систем. AI (Qwen) нь **зөвхөн тайлбар**
бичих ба шийдвэрт хэзээ ч оролцохгүй.

| давхарга | технологи |
| --- | --- |
| Frontend | Next.js 15 · React 19 · TypeScript strict · Tailwind 4 · Lightweight Charts |
| Backend | Python · FastAPI · Pydantic v2 · httpx |
| Market data | Twelve Data API (`/time_series`, `/quote`) |
| Тест | pytest (backend) · tsc strict (frontend) |

**Одоогийн байдал:** Step 2 — Market data layer дууссан (5min/15min candles +
quote, 7 pair, timeout/retry/rate-limit/validation/тест). Indicator болон
scoring engine дараагийн алхамд нэмэгдэнэ.

---

## 1. Бүтэц

```
forex-analyzer/
├── Makefile                      # нэгдсэн команд
├── README.md
├── frontend/                     # Next.js 15
│   ├── .env.example              # NEXT_PUBLIC_API_BASE_URL
│   └── src/
│       ├── app/page.tsx          # Market Data хуудас
│       ├── components/           # CandleChart, QuotePanel
│       └── lib/                  # api.ts (timeout/retry), market.ts (typed client)
└── backend/                      # FastAPI
    ├── .env.example              # TWELVE_DATA_API_KEY гэх мэт (commit хийгдэхгүй)
    ├── requirements.txt
    ├── app/
    │   ├── main.py               # app factory · CORS · error handler-үүд
    │   ├── core/                 # config.py (env→typed), errors.py (domain алдаа)
    │   ├── api/                  # routes.py (/api/v1), forex.py (/api/forex)
    │   ├── schemas/              # Pydantic: market.py, analysis.py
    │   └── services/
    │       ├── analysis_service.py            # engine-ийн байр (Step 3-4)
    │       └── market_data/                   # ★ Step 2
    │           ├── symbols.py    # 7 pair registry + typical spread
    │           ├── providers.py  # TwelveDataProvider, SampleDataProvider
    │           └── service.py    # validation · TTL cache · bid/ask синтез
    └── tests/test_market.py      # 20 гаруй тест, гадаад дуудлагагүй
```

Давхаргын хариуцлага: **router** (HTTP contract) → **service** (бизнес логик,
cache, validation) → **provider** (гадаад API: timeout, retry, error mapping).

## 2. Шаардлагатай зүйлс

- Python 3.11+, Node.js 20+, GNU Make (Windows: WSL/Git Bash)
- Twelve Data API key (үнэгүй: https://twelvedata.com/account/api-keys) —
  **заавал биш**: keyгүй үед детерминист *sample* өгөгдлөөр ажиллана

## 3. Ажиллуулах

```bash
make setup      # venv + pip + npm install + .env файлууд
make dev-api    # backend  → http://localhost:8000  (docs: /docs)
make dev-web    # frontend → http://localhost:3000
```

Гараар (makeгүй):

```bash
# backend
cd backend && python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
cp .env.example .env        # TWELVE_DATA_API_KEY-ээ оруул
.venv/bin/uvicorn app.main:app --reload --port 8000

# frontend
cd frontend && npm install && cp .env.example .env.local && npm run dev
```

## 4. Environment хувьсагч

| хувьсагч | байршил | тайлбар |
| --- | --- | --- |
| `TWELVE_DATA_API_KEY` | backend/.env | Provider key — **зөвхөн backend** |
| `TWELVE_DATA_BASE_URL` | backend/.env | default: `https://api.twelvedata.com` |
| `SAMPLE_FALLBACK_ENABLED` | backend/.env | key хоосон үед sample горим (default true) |
| `MARKET_DATA_TIMEOUT_S` | backend/.env | provider timeout (default 8с) |
| `MARKET_DATA_RETRIES` | backend/.env | retry тоо (default 3, exponential backoff) |
| `MARKET_DATA_CACHE_CANDLES_S` | backend/.env | candles TTL (default 30с) |
| `MARKET_DATA_CACHE_QUOTE_S` | backend/.env | quote TTL (default 15с) |
| `CORS_ORIGINS` | backend/.env | зөвшөөрөгдөх origin-ууд |
| `NEXT_PUBLIC_API_BASE_URL` | frontend/.env.local | `http://localhost:8000/api/v1` |

> **Аюулгүй байдал:** `.env` файл git-д хэзээ ч commit хийгдэхгүй (`.env.example`
> л орно). API key frontend bundle-д хэзээ ч орохгүй — гадаад дуудлага зөвхөн
> backend-ээс явна. `NEXT_PUBLIC_*`-д зөвхөн API URL байна.

## 5. Market Data API (Step 2)

Дэмжих pair: `EUR/USD · GBP/USD · USD/JPY · AUD/USD · USD/CAD · USD/CHF · NZD/USD`
Дэмжих interval: **зөвхөн** `5min`, `15min` · outputsize: 1–5000 (default 200)

### GET /api/forex/quote/{symbol}

```bash
curl -s localhost:8000/api/forex/quote/EUR%2FUSD
```

```json
{
  "symbol": "EUR/USD",
  "price": 1.08575,
  "bid": 1.08572,
  "ask": 1.08578,
  "spread": 0.00006,
  "timestamp": "2026-02-14T08:12:01Z",
  "source": "twelvedata"
}
```

> Twelve Data-ийн Forex quote bid/ask буцаадаггүй тул bid/ask нь mid price дээр
> pair-ийн typical retail spread-ийг нэмж/хасч тооцогдоно (symbols.py).

### GET /api/forex/candles/{symbol}?interval=5min&outputsize=200

```bash
curl -s "localhost:8000/api/forex/candles/EUR%2FUSD?interval=5min&outputsize=200"
curl -s "localhost:8000/api/forex/candles/USD%2FJPY?interval=15min&outputsize=200"
```

```json
{
  "symbol": "EUR/USD",
  "interval": "5min",
  "count": 200,
  "source": "twelvedata",
  "candles": [
    { "timestamp": "2026-02-13T12:00:00Z", "open": 1.085, "high": 1.0856, "low": 1.0847, "close": 1.0854 }
  ]
}
```

Лаанууд үргэлж **цагаар өсөх** эрэмбэтэй, OHLC эрүүл байдал нь Pydantic-аар
шалгагдана (`high ≥ max(o,c)`, `low ≤ min(o,c)`).

### Алдааны код (нэгдсэн формат)

| HTTP | code | учир |
| --- | --- | --- |
| 404 | `SYMBOL_NOT_SUPPORTED` | дэмжигдэхгүй pair |
| 422 | `validation_error` | буруу interval/outputsize |
| 429 | `MARKET_DATA_RATE_LIMITED` | Twelve Data credit дууссан (+ `Retry-After`) |
| 502 | `MARKET_DATA_UNAVAILABLE` / `MARKET_DATA_AUTH_ERROR` | provider доошилсон / key буруу |
| 503 | `MARKET_DATA_NOT_CONFIGURED` | key байхгүй, sample унтраалттай |
| 504 | `MARKET_DATA_TIMEOUT` | provider timeout (retry-ийн дараа) |

```json
{ "error": "SYMBOL_NOT_SUPPORTED", "detail": "'BTC/USD' дэмжигдэхгүй…", "path": "/api/forex/quote/BTC%2FUSD", "utc_now": "…" }
```

## 6. Тест

```bash
make test        # backend pytest (гадаад дуудлагагүй — MockTransport/DI override)
make typecheck   # frontend tsc --noEmit
make lint        # ruff + mypy
```

`tests/test_market.py`-д: Twelve Data хариуны parse, 500→retry→амжилт,
429 + Retry-After, буруу symbol/key, timeout, OHLC validation, endpoint
contract (200/404/422/429/502), sample горим — бүгд детерминист.

## 7. Дараагийн алхамууд

1. ~~Project scaffold~~ ✓
2. ~~Market data layer (Twelve Data, 5min/15min)~~ ✓
3. **Indicator layer** — pandas + pandas-ta: EMA 20/50/200, RSI, MACD, ATR, S/R
4. **Deterministic scoring engine** — 7 дүрэм, нийт жин 100 → BUY/SELL/WAIT + SL/TP/RR
5. **Qwen тайлбар** — зөвхөн scoring үр дүнг тайлбарлана
6. UI: chart давхарга (EMA/S-R), multi-timeframe самбар
7. Хатуужуулалт (rate limit, monitoring, CI) · 8. Deploy

> ⚠ Энэ систем баталгаатай ашиг амлахгүй. Signal нь зөвхөн техникийн дүн
> шинжилгээний мэдээлэл бөгөөд эцсийн шийдвэр хэрэглэгчийнх.

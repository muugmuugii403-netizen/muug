# Forex AI Analyzer

Forex зах зээлийн дүн шинжилгээний систем: **5M/15M** candle дээр ажиллах
**deterministic signal engine** (BUY / SELL / WAIT), realtime мониторинг,
alert систем (browser + Telegram), backtesting, Qwen AI тайлбар.

> ⚠ **Зарчим**: BUY/SELL шийдвэрийг ЗӨВХӨН deterministic engine гаргана
> (market data → indicator → онооны дүрэм). Qwen AI signal-д хэзээ ч
> нөлөөлөхгүй — зөвхөн бэлэн үр дүнг монгол хэлээр тайлбарлана.
> Систем баталгаатай ашиг амлахгүй.

## Дэмжигдэх instrument (8)

| Symbol | Нэр | Pip | Нарийвчлал |
|---|---|---|---|
| EUR/USD | Euro / US Dollar | 0.0001 | 5 |
| GBP/USD | British Pound / US Dollar | 0.0001 | 5 |
| USD/JPY | US Dollar / Japanese Yen | 0.01 | 3 |
| AUD/USD | Australian Dollar / US Dollar | 0.0001 | 5 |
| USD/CAD | US Dollar / Canadian Dollar | 0.0001 | 5 |
| USD/CHF | US Dollar / Swiss Franc | 0.0001 | 5 |
| NZD/USD | New Zealand Dollar / US Dollar | 0.0001 | 5 |
| **XAU/USD** | **Gold / US Dollar** | **0.10** | **2** |

Шинэ instrument нэмэхэд **цорын ганц** `backend/app/services/market_data/symbols.py`
registry-д нэмнэ (frontend mirror нь `frontend/src/lib/market.ts`). Twelve Data-ийн
Gold symbol нь бодитоор `XAU/USD` (Commodity aggregate) болохыг албан docs-оор баталгаажуулсан.

## Архитектур

```
Forex API (Twelve Data)
   ↓  timeout · retry · rate-limit handling · TTL cache
FastAPI (backend)
   ↓  5M/15M candle-close илрүүлэлт (look-ahead bias үгүй)
Technical Indicators (pandas: EMA20/50, RSI14, MACD 12/26/9, ATR14, S/R)
   ↓
Deterministic Signal Engine (6 дүрэм · жин 100 · босго 65)
   ↓  BUY / SELL / WAIT + Entry/SL/TP (ATR × 1.5, RR 1:2)
   ├→ Dashboard (SSE realtime)      ├→ Browser notification
   ├→ Telegram Bot (server-side)    └→ Qwen тайлбар (зөвхөн signal өөрчлөгдөхөд)
   └→ Backtest (түүхэн өгөгдөл, ижил engine)
```

**Давхаргууд** (backend): `api/` → `services/` → `schemas/` (Pydantic) —
market data (`services/market_data/`), analysis (`services/analysis/`),
AI (`services/ai/`), alerts (`services/alerts/`), monitor (`services/monitor/`),
backtest (`services/backtest/`).

## Шаардлага

- Node.js ≥ 20 · Python ≥ 3.11 · (сонголттой) PostgreSQL 15, Redis

## Шуурхай эхлэл

```bash
make setup      # venv + pip + npm install + .env файлууд (хоосон загвараас)
make dev-api    # backend  → http://localhost:8000/docs
make dev-web    # frontend → http://localhost:3000
```

Гараар:

```bash
# Backend
cd backend
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
cp .env.example .env          # дараа нь API key-үүдээ оруулна
.venv/bin/uvicorn app.main:app --reload --port 8000

# Frontend
cd frontend
npm install
cp .env.example .env.local
npm run dev
```

## Environment хувьсагчид (`backend/.env`)

| Хувьсагч | Заавал? | Тайлбар |
|---|---|---|
| `TWELVE_DATA_API_KEY` | Үгүй | Хоосон бол детерминист **sample** өгөгдөл (dev) |
| `QWEN_API_KEY` | Үгүй | Хоосон бол AI тайлбар унтраалттай, signal хэвийн |
| `TELEGRAM_BOT_TOKEN` / `TELEGRAM_CHAT_ID` | Үгүй | Alert илгээлт; алдаа нь системийг зогсоохгүй |
| `CORS_ORIGINS` | Тийм | Prod-д зөвхөн бодит domain (`*` блоклогдоно) |
| `SECRET_KEY` | Тийм (prod) | Prod-д default утгыг config блоклож validate хийнэ |
| `MONITOR_PAIRS` | Үгүй | Хоосон = бүх 8 instrument (Gold ороод); `"EUR/USD,XAU/USD"` гэж хязгаарлаж болно |
| `RATE_LIMIT_*` | Үгүй | Групп тус бүрийн минутын хязгаар (IP бүрт) |

**Нууцууд зөвхөн backend-ийн `.env`-д** хадгалагдана. Frontend-ээс зөвхөн
`NEXT_PUBLIC_API_BASE_URL` (нууц биш) ашиглагдана. `.env` файлууд
`.gitignore`-д бүртгэлтэй — GitHub-д хэзээ ч орохгүй.

## API

| Endpoint | Тайлбар |
|---|---|
| `GET /api/v1/health` · `/health/detailed` | Liveness / readiness (нууцгүй) |
| `GET /api/forex/quote/{symbol}` | Үнэ, bid, ask, spread |
| `GET /api/forex/candles/{symbol}?interval=5min\|15min&outputsize=200` | OHLC |
| `GET /api/forex/signal/{symbol}` | Deterministic signal + оноо + SL/TP |
| `GET /api/forex/analysis/{symbol}` | Signal + Qwen тайлбар (монгол) |
| `GET /api/stream/events` | SSE: price / signal / alert / status |
| `GET · POST /api/alerts/settings` | Alert тохиргоо |
| `GET /api/alerts/history` | Alert түүх |
| `POST /api/backtest` | Түүхэн backtest (ижил engine, AI үгүй) |

## Тест ба шалгалт

```bash
make test        # backend pytest (unit + API + security тестүүд)
make lint        # ruff + mypy
make typecheck   # frontend tsc --noEmit
cd frontend && npm run build   # production build
```

Тестүүд гадны API дуудлага хийхгүй (HTTP mock + sample provider) тул
`TWELVE_DATA_API_KEY`гүйгээр бүгд ажиллана.

## Production

1. `APP_ENV=prod` — default `SECRET_KEY` болон wildcard/хоосон CORS блоклогдоно
2. `CORS_ORIGINS=https://your-frontend.domain` — зөвхөн бодит domain
3. Бүх API key-г `.env`-д (CI/CD secret store-оос тархана)
4. Reverse proxy (nginx): TLS, `X-Accel-Buffering: no` SSE-д хэдийнэ тохируулсан
5. `MONITOR_STAGGER_S` / `QUOTE_POLL_S`-аар provider credit-ээ хэмнэнэ
6. DB хэрэгтэй бол `psql $DATABASE_URL -f database/migrations/001_init.sql`
   (symbol+timestamp+signal index-үүд бэлэн)

## Аюулгүй байдал (Step 8 audit)

- ✅ Secret scan: hardcoded key/token үгүй; `.env` git-д орохгүй
- ✅ Rate limiting: forex 120/мин, analysis 60/мин, backtest 10/мин (IP бүрт, 429 + Retry-After)
- ✅ Security headers: nosniff, DENY frame, Referrer-Policy, Permissions-Policy
- ✅ CORS whitelist; prod-д `*` боломжгүй
- ✅ Лог-д нууц устгагдана (scrubbing formatter)
- ✅ Дотоод алдааны stack trace client руу гарахгүй (нэгдсэн ErrorResponse)
- ✅ AI хариу Pydantic-аар validate; signal өөрчлөх оролдлого илэрвэл тайлбар устгагдана
- ✅ Telegram token зөвхөн server-side; илгээлтийн алдаа мониторингийг зогсоохгүй
- ✅ SSE heartbeat + disconnect cleanup (memory leak үгүй); reconnect үед ID-гаар duplicate хамгаалалт

## Хязгаарлалт

- Alert store in-memory (DB migration бэлэн, Step 9-д холбогдоно)
- Telegram/хэрэглэгчийн multi-tenant auth одоогоор үгүй (нэг server instance)
- Twelve Data free plan: 8 credit/мин — cache + poll давтамжаар хэмнэгдэнэ

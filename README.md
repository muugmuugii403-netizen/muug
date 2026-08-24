# Forex Analyzer — Deterministic зах зээлийн дүн шинжилгээ

> Хэрэглэгч Forex pair (EUR/USD, GBP/USD, USD/JPY…) сонгоход систем OHLCV өгөгдөл авч,
> 10 техникийн indicator тооцоолж, **deterministic scoring engine**-ээр BUY / SELL / WAIT
> signal гаргана. **AI (Qwen) зөвхөн тайлбар үүсгэнэ — шийдвэрт хэзээ ч оролцохгүй.**

⚠️ **Анхааруулга:** Энэ систем баталгаатай ашиг амлахгүй. Энэ нь судалгааны хэрэгсэл болохоос
хөрөнгө оруулалтын зөвлөгөө биш.

**Одоогийн байдал: Step 1 (Project scaffold) ✅** — үндсэн бүтэц, frontend↔backend холболт,
error handling, validation. Market data, AI болон scoring алгоритм дараагийн алхмуудад.

---

## 1. Технологи

| Давхарга   | Технологи                                    |
| ---------- | ------------------------------------------- |
| Frontend   | Next.js 15 (App Router) · React 19 · TypeScript strict · Tailwind CSS 4 |
| Backend    | Python 3.11+ · FastAPI · Pydantic v2 · pydantic-settings |
| Database   | PostgreSQL 15 (Step 2-оос) · Redis cache    |
| Chart      | TradingView Lightweight Charts (Step 6)     |
| Analysis   | pandas + pandas-ta (Step 3)                 |
| AI         | Qwen API — зөвхөн тайлбар (Step 5)          |
| Тест/CI    | pytest · ruff · mypy · tsc · GitHub Actions |

## 2. Урьдчилсан шаардлага

- **Node.js 20+**, npm 10+
- **Python 3.11+**
- **GNU Make** (Windows дээр WSL эсвэл Git Bash ашиглана уу; эсвэл доорх командуудыг гараар гүйцэтгэ)

## 3. Хурдан эхлэх

```bash
# 1. Бүх орчинг бэлдэх (venv, pip install, npm install, __init__.py, .env)
make setup

# 2. Backend ажиллуулах (http://localhost:8000)
make dev-api

# 3. Өөр terminal дээр frontend ажиллуулах (http://localhost:3000)
make dev-web
```

Шалгах:

- Backend Swagger: <http://localhost:8000/docs>
- Health check: <http://localhost:8000/api/v1/health> → `{"status": "ok", ...}`
- Frontend: <http://localhost:3000> — хуудас нээгмэгц `/health`-ийг дуудаж холболтын статусыг харуулна.

### Makeгүйгээр (гараар)

```bash
# Backend
cd backend
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt      # Windows: .venv\Scripts\pip
cp .env.example .env                           # шаардлагатай бол утгуудыг өөрчил
.venv/bin/uvicorn app.main:app --reload --port 8000

# Frontend
cd frontend
npm install
cp .env.example .env.local
npm run dev
```

> Тэмдэглэл: `make setup` нь Python package-уудын `__init__.py` файлуудыг автоматаар үүсгэдэг.

## 4. Төслийн бүтэц

```
forex-analyzer/
├── Makefile                          # make setup / dev-api / dev-web / test / lint
├── README.md
├── frontend/                         # Next.js 15 — App Router
│   ├── .env.example                  # NEXT_PUBLIC_API_BASE_URL
│   ├── next.config.ts
│   ├── package.json
│   ├── postcss.config.mjs            # Tailwind CSS v4
│   ├── tsconfig.json                 # strict: true
│   └── src/
│       ├── app/
│       │   ├── globals.css
│       │   ├── layout.tsx
│       │   └── page.tsx              # холболтын статус + pair сонголт
│       ├── components/
│       │   └── PairSelector.tsx      # zod validation-тай сонгогч
│       └── lib/
│           ├── api.ts                # timeout / retry / ApiError
│           └── types.ts              # API contract төрлүүд
└── backend/                          # FastAPI
    ├── .env.example                  # бүх secret эндээс, .env-д
    ├── requirements.txt
    ├── app/
    │   ├── main.py                   # app factory, CORS, error handlers
    │   ├── core/config.py            # pydantic-settings (env → typed)
    │   ├── api/routes.py             # /health · /pairs · /analysis (stub)
    │   ├── schemas/analysis.py       # Pydantic: request/response/error
    │   └── services/analysis_service.py  # engine-ийн байр (Step 2+)
    └── tests/test_health.py          # smoke тестүүд
```

## 5. Environment хувьсагчид

**Backend** (`backend/.env` — `.env.example`-аас хуулна):

| Хувьсагч              | Тодорхойлолт                        | Step 1-д |
| --------------------- | ----------------------------------- | -------- |
| `APP_ENV`             | `dev` / `staging` / `prod`          | ✅ ашиглана |
| `DEBUG`               | log түвшин                          | ✅ |
| `SECRET_KEY`          | Нууц түлхүүр (prod-д заавал өөрчил) | ✅ validate |
| `CORS_ORIGINS`        | Зөвшөөрөгдөх origin-ууд (`,`-аар)   | ✅ |
| `DATABASE_URL`        | PostgreSQL async DSN                | Step 2   |
| `REDIS_URL`           | Cache                               | Step 2   |
| `TWELVE_DATA_API_KEY` | Market data (одоохондоо **хоосон**) | Step 2   |
| `QWEN_API_KEY`        | AI тайлбар (одоохондоо **хоосон**)  | Step 5   |

**Frontend** (`frontend/.env.local`):

| Хувьсагч                   | Тодорхойлолт                  |
| -------------------------- | ----------------------------- |
| `NEXT_PUBLIC_API_BASE_URL` | `http://localhost:8000/api/v1` |

> 🔒 **Дүрэм:** `NEXT_PUBLIC_` эхлэлтэй хувьсагч client bundle-д орно — API key/secret
> **хэзээ ч** битгий тавь. Бүх гадаад API дуудлага зөвхөн backend-ээс явна.

## 6. API contract (Step 1)

| Method | Path                 | Хариу        | Тайлбар                                        |
| ------ | -------------------- | ------------ | ---------------------------------------------- |
| GET    | `/api/v1/health`     | 200          | Liveness, version, env                          |
| GET    | `/api/v1/pairs`      | 200          | Дэмжигдэх pair жагсаалт (одоогоор static)       |
| POST   | `/api/v1/analysis`   | 422 / **501** | Оролтыг validate хийнэ; engine Step 2-т ирнэ    |

Нэгдсэн алдааны формат (бүх endpoint):

```json
{ "error": "validation_error", "detail": "Буруу оролт: body.symbol", "path": "/api/v1/analysis", "utc_now": "2026-02-14T08:31:12Z" }
```

## 7. Тест ба шалгуур

```bash
make test        # pytest smoke тест (health 200, pairs 200, analysis 501, validation 422)
make lint        # ruff + mypy (backend)
make typecheck   # tsc --noEmit (frontend)
```

## 8. Аюулгүй байдлын зарчим

- API key/secret зөвхөн `.env`-д; `.env` хэзээ ч commit хийгдэхгүй (`.gitignore`)
- Нууцууд `SecretStr` төрлөөр — log-д хэвлэгдэхгүй
- `APP_ENV=prod` үед default `SECRET_KEY`-тэй эхлэхийг `config.py` **блоклоно**
- Бүх оролт Pydantic (backend) + zod (frontend) validation-тай
- CORS зөвхөн whitelist origin-д
- Timeout (AbortController/httpx) + retry зөвхөн 5xx/сүлжээний алдаанд

## 9. Хөгжүүлэлтийн зам

| Алхам  | Агуулга                                    | Статус |
| ------ | ------------------------------------------ | ------ |
| Step 1 | Project scaffold, API холболт, validation  | ✅     |
| Step 2 | Market data adapter (Twelve Data + fallback, cache) | ⏳ |
| Step 3 | Indicator layer (pandas-ta: EMA/RSI/MACD/ATR/S/R)   | — |
| Step 4 | Deterministic scoring engine (7 дүрэм, жин 100)     | — |
| Step 5 | Qwen тайлбар давхарга (explain-only)                | — |
| Step 6 | UI: Lightweight Charts + signal хуудас              | — |
| Step 7 | Хатуужуулалт (rate limit, CI, test, Sentry)         | — |
| Step 8 | Deploy (Docker, Nginx+TLS, prod env)                | — |

## 10. Түгээмэл асуудал

| Асуудал                        | Шийдэл                                                            |
| ------------------------------ | ----------------------------------------------------------------- |
| Frontend "Сүлжээний алдаа"     | Backend ажиллаж байна уу? `CORS_ORIGINS`-д `http://localhost:3000` бий юу? |
| `address already in use :8000` | Өөр uvicorn гаргаж: `lsof -i :8000`                               |
| Windows + `make` алга          | WSL/Git Bash ашигла, эсвэл §3-ын "гараар" командыг гүйцэтгэ       |
| `ModuleNotFoundError: app`     | `backend/` дотроос ажиллуулж байгаа эсэх, эсвэл `make setup` дахин |

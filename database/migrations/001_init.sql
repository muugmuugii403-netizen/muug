-- Forex Analyzer — анхны DB схем (Step 8: production бэлтгэл)
-- Одоогоор backend in-memory store ашиглаж байгаа; энэ схем нь Step 9-д
-- persistence рүү шилжихэд бэлэн суурь. Index-үүд нь query хэв маягт
-- (symbol + timestamp range, alert түүх) зориулагдсан.
--
-- Хэрэглэх:  psql $DATABASE_URL -f database/migrations/001_init.sql

BEGIN;

-- Хүснэгт байгаа эсэхийг хөтлөх (migration tracking)
CREATE TABLE IF NOT EXISTS schema_migrations (
    version     TEXT PRIMARY KEY,
    applied_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Дэмжигдэх Forex pair-ууд
CREATE TABLE IF NOT EXISTS pairs (
    id            SERIAL PRIMARY KEY,
    symbol        VARCHAR(10)  NOT NULL UNIQUE,          -- 'EUR/USD'
    name          VARCHAR(80)  NOT NULL,
    pip_decimals  SMALLINT     NOT NULL CHECK (pip_decimals BETWEEN 0 AND 6),
    typical_spread NUMERIC(12,7) NOT NULL CHECK (typical_spread >= 0)
);

-- Түүхэн OHLC лаанууд (symbol + timestamp range query-д index)
CREATE TABLE IF NOT EXISTS candles (
    pair_id     INTEGER NOT NULL REFERENCES pairs(id) ON DELETE CASCADE,
    interval    VARCHAR(5)  NOT NULL CHECK (interval IN ('5min','15min')),
    ts          TIMESTAMPTZ NOT NULL,
    open        NUMERIC(12,6) NOT NULL CHECK (open  > 0),
    high        NUMERIC(12,6) NOT NULL CHECK (high  > 0),
    low         NUMERIC(12,6) NOT NULL CHECK (low   > 0),
    close       NUMERIC(12,6) NOT NULL CHECK (close > 0),
    PRIMARY KEY (pair_id, interval, ts)
);
-- Backtest мужийн query: WHERE pair_id=? AND interval=? AND ts BETWEEN ? AND ?
CREATE INDEX IF NOT EXISTS idx_candles_range
    ON candles (pair_id, interval, ts DESC);

-- Deterministic signal engine-ийн гаралт (аудит + түүх)
CREATE TABLE IF NOT EXISTS signals (
    id           BIGSERIAL PRIMARY KEY,
    symbol       VARCHAR(10) NOT NULL,
    signal       VARCHAR(4)  NOT NULL CHECK (signal IN ('BUY','SELL','WAIT')),
    buy_score    SMALLINT NOT NULL CHECK (buy_score BETWEEN 0 AND 100),
    sell_score   SMALLINT NOT NULL CHECK (sell_score BETWEEN 0 AND 100),
    wait_score   SMALLINT NOT NULL CHECK (wait_score BETWEEN 0 AND 100),
    confidence   SMALLINT NOT NULL CHECK (confidence BETWEEN 0 AND 100),
    entry        NUMERIC(12,6),
    stop_loss    NUMERIC(12,6),
    take_profit  NUMERIC(12,6),
    risk_reward  NUMERIC(4,2),
    reasons      JSONB NOT NULL DEFAULT '[]',
    warnings     JSONB NOT NULL DEFAULT '[]',
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Тухайн pair-ийн сүүлийн signal хурдан авах + цагаар шүүх
CREATE INDEX IF NOT EXISTS idx_signals_symbol_created
    ON signals (symbol, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_signals_signal
    ON signals (signal);

-- Alert түүх (Step 7-ийн InMemoryAlertStore-ийн байнгын хувилбар)
CREATE TABLE IF NOT EXISTS alerts (
    id                        BIGSERIAL PRIMARY KEY,
    symbol                    VARCHAR(10) NOT NULL,
    signal                    VARCHAR(4)  NOT NULL CHECK (signal IN ('BUY','SELL','WAIT')),
    confidence                SMALLINT NOT NULL,
    buy_score                 SMALLINT NOT NULL,
    sell_score                SMALLINT NOT NULL,
    wait_score                SMALLINT NOT NULL,
    entry                     NUMERIC(12,6),
    stop_loss                 NUMERIC(12,6),
    take_profit               NUMERIC(12,6),
    risk_reward               NUMERIC(4,2),
    reasons                   JSONB NOT NULL DEFAULT '[]',
    browser_notification_sent BOOLEAN NOT NULL DEFAULT FALSE,
    telegram_notification_sent BOOLEAN NOT NULL DEFAULT FALSE,
    created_at                TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- "Сүүлийн N alert" + symbol-аар шүүх
CREATE INDEX IF NOT EXISTS idx_alerts_created ON alerts (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_alerts_symbol  ON alerts (symbol, created_at DESC);

-- Backtest бүртгэл (хэрэглэгчийн ажиллуулсан тестүүдийн аудит)
CREATE TABLE IF NOT EXISTS backtests (
    id             BIGSERIAL PRIMARY KEY,
    symbol         VARCHAR(10) NOT NULL,
    start_date     DATE NOT NULL,
    end_date       DATE NOT NULL CHECK (end_date > start_date),
    initial_balance NUMERIC(14,2) NOT NULL CHECK (initial_balance > 0),
    risk_per_trade NUMERIC(4,2)  NOT NULL CHECK (risk_per_trade > 0 AND risk_per_trade <= 10),
    summary        JSONB NOT NULL,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_backtests_symbol ON backtests (symbol, created_at DESC);

INSERT INTO schema_migrations (version) VALUES ('001_init')
ON CONFLICT (version) DO NOTHING;

COMMIT;

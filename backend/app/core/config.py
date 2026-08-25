"""Төвийн тохиргоо — бүх утга environment / .env файлаас ирнэ.

Дүрэм: нууцууд (API key, DB DSN, secret key) зөвхөн `SecretStr`-ээр хадгалагдана,
лог-д хэзээ ч хэвлэгдэхгүй, код дотор hardcode хийгдэхгүй.
"""

from __future__ import annotations

from enum import Enum
from functools import lru_cache

from pydantic import Field, SecretStr, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

_DEFAULT_SECRET = "dev-only-secret-change-me"


class AppEnv(str, Enum):
    """Deployment орчин."""

    DEV = "dev"
    STAGING = "staging"
    PROD = "prod"


class Settings(BaseSettings):
    """Environment-д суурилсан typed тохиргоо."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # --- App ---
    app_name: str = "Forex Analyzer API"
    app_env: AppEnv = AppEnv.DEV
    debug: bool = False
    api_version: str = "v1"
    secret_key: SecretStr = SecretStr(_DEFAULT_SECRET)
    api_host: str = "0.0.0.0"  # noqa: S104 — dev default, prod-д reverse proxy ард ажиллана
    api_port: int = Field(default=8000, ge=1, le=65535)
    cors_origins: str = "http://localhost:3000"

    # --- Storage (Step 2+) ---
    database_url: SecretStr = SecretStr(
        "postgresql+asyncpg://postgres:postgres@localhost:5432/forex_analyzer"
    )
    redis_url: str = "redis://localhost:6379/0"

    # --- Гадаад сервисүүд (Step 2 / Step 5-д .env-д бөглөнө) ---
    twelve_data_api_key: SecretStr = SecretStr("")
    twelve_data_base_url: str = "https://api.twelvedata.com"
    # Key хоосон үед локал dev-д детерминист sample өгөгдөл хэрэглэх эсэх
    sample_fallback_enabled: bool = True
    # In-memory TTL cache (credit хэмнэлт: Twelve Data 8 credit/мин)
    market_data_cache_candles_s: float = Field(default=30.0, ge=0)
    market_data_cache_quote_s: float = Field(default=15.0, ge=0)
    qwen_api_key: SecretStr = SecretStr("")
    qwen_base_url: str = "https://dashscope-intl.aliyuncs.com/compatible-mode/v1"
    qwen_model: str = "qwen-plus"
    qwen_timeout_s: float = Field(default=20.0, gt=0)
    # Ижил signal-д дахин AI дуудахгүй байх TTL fingerprint cache (секунд)
    qwen_cache_ttl_s: float = Field(default=900.0, ge=0)

    # --- Realtime monitor (Step 7) ---
    # Байнгын мониторинг асаалттай эсэх (test/dev-д унтрааж болно)
    monitor_enabled: bool = True
    # Loop-ийн тик давтамж (секунд) — candle хаагдсан эсэхийг шалгана
    monitor_tick_s: float = Field(default=5.0, ge=1)
    # Quote (одоогийн үнэ) poll давтамж — секунд тутам биш, credit хэмнэнэ
    quote_poll_s: float = Field(default=20.0, ge=5)
    # Pair хоорондын зай (rate limit-д зөөлөн)
    monitor_stagger_s: float = Field(default=0.4, ge=0)
    # Монитор хийх pair-ууд (хоосон = бүх дэмжигдэх pair). Жишээ: "EUR/USD,GBP/USD"
    monitor_pairs: str = ""
    # Signal өөрчлөгдөхөд Qwen тайлбар авах эсэх (AI-г tick бүрд дуудахгүй!)
    ai_on_signal_change: bool = True

    # --- Telegram (Step 7) — server-side ONLY, frontend-д хэзээ ч гарахгүй ---
    telegram_bot_token: SecretStr = SecretStr("")
    telegram_chat_id: str = ""
    telegram_timeout_s: float = Field(default=8.0, gt=0)

    # --- Alert түүх ---
    alert_history_max: int = Field(default=200, ge=10, le=5000)

    # --- Rate limiting (Step 8) — IP + групп бүрт, минутанд ---
    rate_limit_enabled: bool = True
    rate_limit_forex_per_min: int = Field(default=120, ge=1)
    rate_limit_analysis_per_min: int = Field(default=60, ge=1)
    rate_limit_backtest_per_min: int = Field(default=10, ge=1)
    rate_limit_alerts_per_min: int = Field(default=60, ge=1)

    # --- Тэсвэртэй байдал ---
    market_data_timeout_s: float = Field(default=8.0, gt=0)
    market_data_retries: int = Field(default=3, ge=0, le=10)

    # --- Backtest (Step 6) ---
    backtest_max_range_days: int = Field(default=31, ge=1, le=365)
    backtest_min_candles_5m: int = Field(default=120, ge=60)
    backtest_min_candles_15m: int = Field(default=60, ge=55)

    @field_validator("cors_origins")
    @classmethod
    def _strip_origins(cls, v: str) -> str:
        """`a, b ,c` → `a,b,c` болгож цэвэрлэнэ."""
        return ",".join(o.strip() for o in v.split(",") if o.strip())

    @model_validator(mode="after")
    def _enforce_prod_secrets(self) -> Settings:
        """Production-д default secret + сул CORS-той эхлэхийг хатуу блоклож validate хийнэ."""
        if self.app_env is AppEnv.PROD and self.secret_key.get_secret_value() == _DEFAULT_SECRET:
            raise ValueError("APP_ENV=prod үед SECRET_KEY-г заавал солих ёстой")
        if self.app_env is AppEnv.PROD:
            origins = [o.strip() for o in self.cors_origins.split(",") if o.strip()]
            if not origins or "*" in origins:
                raise ValueError(
                    "APP_ENV=prod үед CORS_ORIGINS-д бодит frontend domain заавал заах ёстой ('*' хориотой)"
                )
        return self

    @property
    def cors_origin_list(self) -> list[str]:
        return [o for o in self.cors_origins.split(",") if o]

    @property
    def is_prod(self) -> bool:
        return self.app_env is AppEnv.PROD


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Тохиргоог нэг удаа уншиж, process-ийн хэмжээнд cache-лна."""
    return Settings()

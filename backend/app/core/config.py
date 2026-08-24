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
    qwen_api_key: SecretStr = SecretStr("")
    qwen_model: str = "qwen-plus"
    qwen_timeout_s: float = Field(default=20.0, gt=0)

    # --- Тэсвэртэй байдал ---
    market_data_timeout_s: float = Field(default=8.0, gt=0)
    market_data_retries: int = Field(default=3, ge=0, le=10)

    @field_validator("cors_origins")
    @classmethod
    def _strip_origins(cls, v: str) -> str:
        """`a, b ,c` → `a,b,c` болгож цэвэрлэнэ."""
        return ",".join(o.strip() for o in v.split(",") if o.strip())

    @model_validator(mode="after")
    def _enforce_prod_secrets(self) -> Settings:
        """Production-д default secret-тэй эхлэхийг хатуу блоклож validate хийнэ."""
        if self.app_env is AppEnv.PROD and self.secret_key.get_secret_value() == _DEFAULT_SECRET:
            raise ValueError("APP_ENV=prod үед SECRET_KEY-г заавал солих ёстой")
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

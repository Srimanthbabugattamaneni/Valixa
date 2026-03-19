"""
Centralised settings loaded from environment variables / .env file.
All config is validated at startup via pydantic-settings.
"""
from functools import lru_cache
from typing import List

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env.local",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    # ------------------------------------------------------------------
    # App metadata
    # ------------------------------------------------------------------
    APP_NAME: str = "Valixa"
    APP_VERSION: str = "1.0.0"
    ENV: str = Field(default="development", pattern="^(development|staging|production)$")

    # ------------------------------------------------------------------
    # PostgreSQL
    # ------------------------------------------------------------------
    DATABASE_URL: str = Field(
        ...,
        description="asyncpg DSN, e.g. postgresql://user:pass@localhost:5432/dbname",
    )
    DB_POOL_MIN: int = Field(default=2, ge=1)
    DB_POOL_MAX: int = Field(default=10, ge=2)

    # ------------------------------------------------------------------
    # Anthropic / Claude settings
    # ------------------------------------------------------------------
    ANTHROPIC_API_KEY: str = Field(..., description="Anthropic API key (required).")
    AI_MODEL: str = "claude-sonnet-4-6"
    AI_MAX_TOKENS: int = Field(default=6144, ge=256, le=8192)
    AI_TEMPERATURE: float = Field(default=0.3, ge=0.0, le=1.0)
    AI_TIMEOUT_SECONDS: int = Field(default=180, ge=10, le=600)

    # How many report sections to generate in parallel
    AI_MAX_CONCURRENCY: int = Field(default=6, ge=1, le=10)

    # ------------------------------------------------------------------
    # Server
    # ------------------------------------------------------------------
    HOST: str = "0.0.0.0"
    PORT: int = Field(default=8000, ge=1024, le=65535)
    ALLOWED_ORIGINS: List[str] = ["*"]

    # ------------------------------------------------------------------
    # Market data APIs (all optional — service degrades gracefully if unset)
    # ------------------------------------------------------------------
    GOOGLE_PLACES_API_KEY: str = Field(default="", description="Google Places / Geocoding API key.")
    YELP_API_KEY: str = Field(default="", description="Yelp Fusion API key.")
    CENSUS_API_KEY: str = Field(default="", description="US Census API key (optional; increases rate limit).")
    SERP_API_KEY: str = Field(default="", description="SerpAPI key for search trend signals.")

    # ------------------------------------------------------------------
    # Service-to-service auth
    # ------------------------------------------------------------------
    API_SECRET_KEY: str = Field(..., description="Shared secret — must match AI_SERVICE_API_KEY in Next.js .env.")

    # ------------------------------------------------------------------
    # Logging
    # ------------------------------------------------------------------
    LOG_LEVEL: str = Field(default="INFO", pattern="^(DEBUG|INFO|WARNING|ERROR|CRITICAL)$")

    # ------------------------------------------------------------------
    # Validators
    # ------------------------------------------------------------------
    @field_validator("ANTHROPIC_API_KEY")
    @classmethod
    def api_key_must_not_be_empty(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("ANTHROPIC_API_KEY must not be empty.")
        return v.strip()


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Cached settings singleton — call this everywhere instead of Settings()."""
    return Settings()


# Module-level convenience alias
settings: Settings = get_settings()

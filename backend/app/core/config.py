from functools import lru_cache
import json

from pydantic import Field, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        env_prefix="SYNTRIX_",
        extra="ignore",
    )

    project_name: str = "Syntrix AI API"
    api_v1_prefix: str = "/api/v1"
    environment: str = "development"
    debug: bool = True
    sql_echo: bool = False
    database_url: str = "sqlite+aiosqlite:///./syntrix.db"
    redis_url: str = "redis://localhost:6379/0"
    cors_origins: str = "http://localhost:3000"
    openai_api_key: str | None = None
    openai_model: str = "gpt-5.4-mini"
    admin_emails: str = ""
    stripe_secret_key: str | None = None
    stripe_success_url: str = "http://localhost:3000?billing=success"
    stripe_cancel_url: str = "http://localhost:3000?billing=cancelled"
    stripe_price_free: str | None = None
    stripe_price_pro: str | None = None
    stripe_price_scale: str | None = None
    razorpay_key_id: str | None = None
    razorpay_key_secret: str | None = None
    razorpay_callback_url: str = "http://localhost:3000?billing=razorpay"
    log_level: str = "INFO"
    secret_key: str = "replace-me-in-production"
    access_token_expire_minutes: int = 60 * 24 * 7
    workspace_root: str = "workspaces"
    preview_entry_file: str = "index.html"
    max_file_bytes: int = 1_000_000
    terminal_default_timeout_seconds: int = 20

    @field_validator("cors_origins", mode="before")
    @classmethod
    def normalize_cors_origins(cls, value: str | list[str]) -> str:
        if isinstance(value, list):
            return ",".join(str(item).strip() for item in value if str(item).strip())

        return value

    @field_validator("openai_api_key", mode="before")
    @classmethod
    def normalize_openai_api_key(cls, value: str | None) -> str | None:
        if value is None:
            return None

        normalized = value.strip()
        placeholder_values = {
            "",
            "YOUR_OPENAI_API_KEY",
            "your_api_key_here",
            "YOUR_API_KEY",
        }
        if normalized in placeholder_values or normalized.upper().startswith("YOUR_"):
            return None

        return normalized

    @property
    def cors_origin_list(self) -> list[str]:
        value = self.cors_origins.strip()
        if not value:
            return []

        if value.startswith("["):
            try:
                parsed = json.loads(value)
            except json.JSONDecodeError as exc:
                raise ValueError(
                    "SYNTRIX_CORS_ORIGINS must be a comma-separated string or JSON string array."
                ) from exc
            if not isinstance(parsed, list) or not all(isinstance(item, str) for item in parsed):
                raise ValueError("SYNTRIX_CORS_ORIGINS JSON value must be a list of strings.")
            return [item.strip() for item in parsed if item.strip()]

        return [item.strip() for item in value.split(",") if item.strip()]

    @property
    def admin_email_list(self) -> list[str]:
        return [item.strip().lower() for item in self.admin_emails.split(",") if item.strip()]

    @property
    def stripe_price_map(self) -> dict[str, str]:
        return {
            key: value
            for key, value in {
                "free": self.stripe_price_free,
                "pro": self.stripe_price_pro,
                "scale": self.stripe_price_scale,
            }.items()
            if value
        }

    @model_validator(mode="after")
    def validate_production_settings(self) -> "Settings":
        if self.environment.lower() == "production" and self.secret_key == "replace-me-in-production":
            raise ValueError("SYNTRIX_SECRET_KEY must be set to a secure value in production.")
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()

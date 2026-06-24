import os
from functools import lru_cache
from pathlib import Path

from pydantic import Field, computed_field
from pydantic_settings import BaseSettings, SettingsConfigDict

from app.domain.enums import AIProvider


class Settings(BaseSettings):
    # Computed paths
    @computed_field  # type: ignore[prop-decorator]
    @property
    def db_path(self) -> Path:
        base_dir = Path(os.environ.get("APPDATA", Path.home())) / "SystemGuardian"
        base_dir.mkdir(parents=True, exist_ok=True)
        return base_dir / "data.db"

    @computed_field  # type: ignore[prop-decorator]
    @property
    def logs_dir(self) -> Path:
        logs_dir = Path(os.environ.get("APPDATA", Path.home())) / "SystemGuardian" / "logs"
        logs_dir.mkdir(parents=True, exist_ok=True)
        return logs_dir

    # App
    DEBUG: bool = False
    LOG_LEVEL: str = "INFO"

    # Backend
    BACKEND_HOST: str = "127.0.0.1"
    BACKEND_PORT: int = 8765

    # Monitoring
    METRICS_INTERVAL_SECONDS: int = 30
    EVENT_POLL_INTERVAL_SECONDS: int = 60
    ENABLED_MODULES: list[str] = Field(
        default_factory=lambda: [
            "security",
            "performance",
            "hardware",
            "network",
            "application",
            "storage",
            "driver",
            "power",
        ]
    )

    # AI
    AI_PROVIDER: AIProvider = AIProvider.OLLAMA
    OLLAMA_BASE_URL: str = "http://localhost:11434"
    OLLAMA_MODEL: str = "llama3.2"
    GEMINI_API_KEY: str = ""
    AI_TIMEOUT_SECONDS: int = 60
    AI_FALLBACK_ENABLED: bool = True  # Ollama → Gemini fallback

    # Data retention
    EVENT_RETENTION_DAYS: int = 90
    METRIC_RETENTION_DAYS: int = 30

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")


@lru_cache
def get_settings() -> Settings:
    return Settings()

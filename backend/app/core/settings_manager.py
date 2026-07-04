import structlog
from typing import Any
from sqlalchemy.ext.asyncio import async_sessionmaker, AsyncSession
from app.repositories.setting_repository import SettingRepository

logger = structlog.get_logger(__name__)

DEFAULTS = {
    "ai_provider": "ollama",
    "ollama_base_url": "http://localhost:11434",
    "ollama_model": "llama3.2",
    "gemini_api_key": "",
    "metrics_interval_seconds": "30",
    "event_poll_interval_seconds": "60",
    "notification_min_severity": "high",
    "notification_cooldown_minutes": "15",
    "event_retention_days": "90",
    "metric_retention_days": "30",
    "module_security": "true",
    "module_performance": "true",
    "module_hardware": "true",
    "module_network": "true",
    "module_storage": "true",
    "module_application": "true",
    "module_driver": "true",
    "module_power": "true",
    "onboarding_complete": "false",
}

class SettingsManager:
    """
    Global in-memory cache for database settings.
    Allows hot-reloading of configuration across the backend.
    """
    _instance = None

    def __init__(self, session_factory: async_sessionmaker[AsyncSession]):
        self._session_factory = session_factory
        self._cache: dict[str, str] = dict(DEFAULTS)

    @classmethod
    def get_instance(cls) -> "SettingsManager":
        if cls._instance is None:
            raise RuntimeError("SettingsManager is not initialized")
        return cls._instance

    @classmethod
    def initialize(cls, session_factory: async_sessionmaker[AsyncSession]) -> "SettingsManager":
        if cls._instance is None:
            cls._instance = cls(session_factory)
        return cls._instance

    async def load(self) -> None:
        """Load all settings from DB into memory."""
        async with self._session_factory() as session:
            repo = SettingRepository(session)
            all_settings = await repo.get_all(limit=500)
            
            # Reset to defaults first
            new_cache = dict(DEFAULTS)
            for s in all_settings:
                new_cache[s.key] = s.value
            
            self._cache = new_cache
            logger.debug("settings_manager.reloaded", keys=len(self._cache))

    def get(self, key: str) -> str:
        """Get a setting as string."""
        return self._cache.get(key, DEFAULTS.get(key, ""))

    def get_int(self, key: str, default: int = 0) -> int:
        """Get a setting as int."""
        val = self.get(key)
        try:
            return int(val)
        except ValueError:
            return default

    def get_bool(self, key: str, default: bool = False) -> bool:
        """Get a setting as bool."""
        val = self.get(key).lower()
        if val in ("true", "1", "yes"):
            return True
        if val in ("false", "0", "no"):
            return False
        return default

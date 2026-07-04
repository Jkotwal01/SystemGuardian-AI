"""
Settings API — read/write application configuration stored in the DB.
Allows the frontend to persist AI provider settings, monitoring intervals, etc.
"""

from __future__ import annotations

from collections.abc import AsyncGenerator

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import DatabaseManager
from app.core.settings_manager import SettingsManager
from app.models.setting import SettingModel
from app.repositories.setting_repository import SettingRepository

router = APIRouter(prefix="/settings", tags=["settings"])

# ── Default settings (used when no DB record exists) ─────────────────────────
DEFAULTS: dict[str, str] = {
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


async def get_session() -> AsyncGenerator[AsyncSession, None]:
    async with DatabaseManager.get_session_factory()() as session:
        yield session


@router.get("")
@router.get("/")
async def get_settings(db: AsyncSession = Depends(get_session)) -> dict[str, str]:
    """Return all settings, merging DB values over defaults."""
    repo = SettingRepository(db)
    all_settings = await repo.get_all(limit=500)
    result = dict(DEFAULTS)
    for s in all_settings:
        result[s.key] = s.value
    return result


class SettingsPatch(BaseModel):
    settings: dict[str, str]


@router.patch("")
@router.patch("/")
async def update_settings(
    body: SettingsPatch, db: AsyncSession = Depends(get_session)
) -> dict[str, str]:
    """Upsert one or more settings. Returns the full updated settings map."""
    repo = SettingRepository(db)
    for key, value in body.settings.items():
        existing = await repo.get_by_id(key)
        if existing:
            existing.value = value
            await repo.save(existing)
        else:
            await repo.save(SettingModel(key=key, value=value))

    # Reload hot cache
    await SettingsManager.get_instance().load()

    # Return full updated map
    all_settings = await repo.get_all(limit=500)
    result = dict(DEFAULTS)
    for s in all_settings:
        result[s.key] = s.value
    return result


@router.get("/ai-test")
async def test_ai_connection(db: AsyncSession = Depends(get_session)) -> dict[str, object]:
    """Test connectivity to the configured AI provider."""
    import httpx

    repo = SettingRepository(db)

    provider = (await repo.get_value("ai_provider")) or DEFAULTS["ai_provider"]
    status: dict[str, object] = {"provider": provider, "available": False, "error": None}

    try:
        if provider == "ollama":
            url = (await repo.get_value("ollama_base_url")) or DEFAULTS["ollama_base_url"]
            async with httpx.AsyncClient(timeout=5) as client:
                r = await client.get(f"{url.rstrip('/')}/api/tags")
                status["available"] = r.status_code == 200
        elif provider == "gemini":
            key = (await repo.get_value("gemini_api_key")) or ""
            status["available"] = bool(key and len(key) > 10)
            if not status["available"]:
                status["error"] = "No API key configured"
    except Exception as e:
        status["error"] = str(e)

    return status

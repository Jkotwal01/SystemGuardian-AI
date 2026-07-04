"""
AI Status API — reports which AI providers are currently available.

GET /api/v1/ai/status — returns {ollama: bool, gemini: bool, active_provider: str}
"""

from __future__ import annotations

from fastapi import APIRouter
from pydantic import BaseModel

from app.ai.providers.gemini import GeminiProvider
from app.ai.providers.ollama import OllamaProvider

router = APIRouter(prefix="/ai", tags=["ai"])


class AIStatusResponse(BaseModel):
    ollama_available: bool
    gemini_available: bool
    active_provider: str  # "ollama" | "gemini" | "none"
    ollama_model: str


@router.get("/status", response_model=AIStatusResponse)
async def get_ai_status() -> AIStatusResponse:
    """
    Check the availability of each configured AI provider.
    This is a lightweight probe — Ollama: GET /api/tags, Gemini: GET model metadata.
    """
    ollama = OllamaProvider()
    gemini = GeminiProvider()

    ollama_ok, gemini_ok = False, False

    try:
        ollama_ok = await ollama.is_available()
    except Exception:  # noqa: BLE001
        ollama_ok = False

    try:
        gemini_ok = await gemini.is_available()
    except Exception:  # noqa: BLE001
        gemini_ok = False

    if ollama_ok:
        active = "ollama"
    elif gemini_ok:
        active = "gemini"
    else:
        active = "none"

    from app.config import get_settings

    settings = get_settings()

    return AIStatusResponse(
        ollama_available=ollama_ok,
        gemini_available=gemini_ok,
        active_provider=active,
        ollama_model=settings.OLLAMA_MODEL,
    )

"""
Gemini Provider — calls Google Gemini REST API as fallback.

Requires GEMINI_API_KEY in settings/.env.
If the key is empty, is_available() returns False and the provider
is silently skipped by FallbackAIProvider.

Model: gemini-1.5-flash (fast + cheap, good for structured JSON)
"""

from __future__ import annotations

import json
import time
from collections.abc import AsyncGenerator

import httpx
import structlog

from app.ai.base import AIResponse, BaseAIProvider, GenerateOptions
from app.config import get_settings
from app.core.settings_manager import SettingsManager

logger = structlog.get_logger()

_GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models"
_MODEL = "gemini-1.5-flash"


class GeminiProvider(BaseAIProvider):
    """
    Fallback AI provider using Google Gemini REST API.

    Uses gemini-1.5-flash — fast, cheap, strong JSON compliance.
    Stream support is provided via server-sent events (SSE).
    """

    name = "gemini"

    def __init__(self) -> None:
        pass

    @property
    def _api_key(self) -> str:
        return SettingsManager.get_instance().get("gemini_api_key")

    @property
    def _timeout(self) -> int:
        return get_settings().AI_TIMEOUT_SECONDS

    async def is_available(self) -> bool:
        """Available only if an API key is configured."""
        if not self._api_key:
            return False
        # Lightweight model metadata probe
        try:
            async with httpx.AsyncClient(timeout=5) as client:
                r = await client.get(
                    f"{_GEMINI_BASE}/{_MODEL}",
                    params={"key": self._api_key},
                )
                return r.status_code == 200
        except Exception:  # noqa: BLE001
            return False

    async def generate(
        self,
        system_prompt: str,
        user_message: str,
        options: GenerateOptions | None = None,
    ) -> AIResponse:
        if not self._api_key:
            raise RuntimeError("GEMINI_API_KEY is not configured")

        opts = options or GenerateOptions()
        start = time.perf_counter()

        # Combine system + user into a single contents array
        # (Gemini REST API does not have a separate system-role field in v1beta)
        full_prompt = f"{system_prompt}\n\n{user_message}"

        payload = {
            "contents": [{"role": "user", "parts": [{"text": full_prompt}]}],
            "generationConfig": {
                "temperature": opts.temperature,
                "maxOutputTokens": opts.max_tokens,
                "responseMimeType": "application/json",
            },
        }

        async with httpx.AsyncClient(timeout=opts.timeout_seconds) as client:
            r = await client.post(
                f"{_GEMINI_BASE}/{_MODEL}:generateContent",
                params={"key": self._api_key},
                json=payload,
            )
            r.raise_for_status()
            data = r.json()

        latency = (time.perf_counter() - start) * 1000

        # Extract text from Gemini response structure
        content = (
            data.get("candidates", [{}])[0].get("content", {}).get("parts", [{}])[0].get("text", "")
        )
        tokens_used = data.get("usageMetadata", {}).get("totalTokenCount")

        logger.debug(
            "gemini.generate_complete",
            model=_MODEL,
            latency_ms=round(latency, 1),
            tokens=tokens_used,
        )

        return AIResponse(
            content=content,
            provider=self.name,
            model=_MODEL,
            tokens_used=tokens_used,
            latency_ms=latency,
        )

    async def stream(
        self,
        system_prompt: str,
        user_message: str,
        options: GenerateOptions | None = None,
    ) -> AsyncGenerator[str, None]:
        """
        Streaming via Gemini SSE endpoint.
        Yields individual text chunks as they arrive.
        """
        if not self._api_key:
            raise RuntimeError("GEMINI_API_KEY is not configured")

        opts = options or GenerateOptions()
        full_prompt = f"{system_prompt}\n\n{user_message}"

        payload = {
            "contents": [{"role": "user", "parts": [{"text": full_prompt}]}],
            "generationConfig": {
                "temperature": opts.temperature,
                "maxOutputTokens": opts.max_tokens,
            },
        }

        async with httpx.AsyncClient(timeout=opts.timeout_seconds) as client:
            async with client.stream(
                "POST",
                f"{_GEMINI_BASE}/{_MODEL}:streamGenerateContent",
                params={"key": self._api_key, "alt": "sse"},
                json=payload,
            ) as response:
                async for line in response.aiter_lines():
                    if line.startswith("data: "):
                        raw = line[6:]
                        try:
                            chunk = json.loads(raw)
                            text = (
                                chunk.get("candidates", [{}])[0]
                                .get("content", {})
                                .get("parts", [{}])[0]
                                .get("text", "")
                            )
                            if text:
                                yield text
                        except json.JSONDecodeError:
                            continue

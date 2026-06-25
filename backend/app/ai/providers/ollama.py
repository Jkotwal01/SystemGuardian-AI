"""
Ollama Provider — calls a locally-running Ollama instance.

Ollama must be installed separately: https://ollama.ai
Default model: llama3.2 (configurable via Settings.OLLAMA_MODEL)
"""

from __future__ import annotations

import json
import time
from typing import AsyncGenerator

import httpx
import structlog

from app.ai.base import AIResponse, BaseAIProvider, GenerateOptions
from app.config import get_settings

logger = structlog.get_logger()


class OllamaProvider(BaseAIProvider):
    """
    Primary AI provider. Calls local Ollama REST API.

    Endpoints used:
      GET  /api/tags      — availability check
      POST /api/generate  — single completion
      POST /api/generate  (stream: true) — streaming
    """

    name = "ollama"

    def __init__(self) -> None:
        settings = get_settings()
        self._base_url = settings.OLLAMA_BASE_URL.rstrip("/")
        self._model = settings.OLLAMA_MODEL
        self._timeout = settings.AI_TIMEOUT_SECONDS

    async def is_available(self) -> bool:
        """Probe Ollama's tag list endpoint — fast and cheap."""
        try:
            async with httpx.AsyncClient(timeout=5) as client:
                r = await client.get(f"{self._base_url}/api/tags")
                return r.status_code == 200
        except Exception:  # noqa: BLE001
            return False

    async def generate(
        self,
        system_prompt: str,
        user_message: str,
        options: GenerateOptions | None = None,
    ) -> AIResponse:
        opts = options or GenerateOptions()
        start = time.perf_counter()

        async with httpx.AsyncClient(timeout=opts.timeout_seconds) as client:
            r = await client.post(
                f"{self._base_url}/api/generate",
                json={
                    "model": self._model,
                    "system": system_prompt,
                    "prompt": user_message,
                    "stream": False,
                    "format": "json",
                    "options": {
                        "temperature": opts.temperature,
                        "num_predict": opts.max_tokens,
                    },
                },
            )
            r.raise_for_status()
            data = r.json()

        latency = (time.perf_counter() - start) * 1000
        logger.debug(
            "ollama.generate_complete",
            model=self._model,
            latency_ms=round(latency, 1),
            tokens=data.get("eval_count"),
        )

        return AIResponse(
            content=data["response"],
            provider=self.name,
            model=self._model,
            tokens_used=data.get("eval_count"),
            latency_ms=latency,
        )

    async def stream(
        self,
        system_prompt: str,
        user_message: str,
        options: GenerateOptions | None = None,
    ) -> AsyncGenerator[str, None]:
        opts = options or GenerateOptions()

        async with httpx.AsyncClient(timeout=opts.timeout_seconds) as client:
            async with client.stream(
                "POST",
                f"{self._base_url}/api/generate",
                json={
                    "model": self._model,
                    "system": system_prompt,
                    "prompt": user_message,
                    "stream": True,
                    "options": {
                        "temperature": opts.temperature,
                        "num_predict": opts.max_tokens,
                    },
                },
            ) as response:
                async for line in response.aiter_lines():
                    if line.strip():
                        chunk = json.loads(line)
                        if token := chunk.get("response"):
                            yield token
                        if chunk.get("done"):
                            break

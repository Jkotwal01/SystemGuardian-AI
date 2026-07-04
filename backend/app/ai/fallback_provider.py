"""
FallbackAIProvider — tries providers in order, degrades gracefully.

Design: Chain-of-responsibility. First available + successful provider wins.
Every fallback event is logged for observability.
If all providers fail, returns a structured degradation JSON response —
the app never crashes or shows a raw error to the user.
"""

from __future__ import annotations

import json
from collections.abc import AsyncGenerator

import structlog

from app.ai.base import AIResponse, BaseAIProvider, GenerateOptions

logger = structlog.get_logger()

_DEGRADED_RESPONSE = json.dumps(
    {
        "what_happened": "AI analysis is temporarily unavailable.",
        "why_it_happened": "Could not connect to any configured AI provider.",
        "severity": "unknown",
        "frequency_context": "Unable to determine.",
        "risk_assessment": "Manual review recommended.",
        "recommended_action": (
            "Ensure Ollama is running locally, or add a GEMINI_API_KEY to your settings."
        ),
        "can_ignore": True,
        "simple_summary": "AI is offline. Your system data is still being monitored normally.",
    }
)


class FallbackAIProvider(BaseAIProvider):
    """
    Meta-provider that wraps an ordered list of real providers.

    Tries each provider in sequence:
      1. Check is_available() — skip if unreachable
      2. Call generate() — catch any errors and move to next
      3. All failed → return graceful degradation JSON

    Providers list is typically [OllamaProvider, GeminiProvider].
    Order matters: first in list = highest priority.
    """

    name = "fallback"

    def __init__(self, providers: list[BaseAIProvider]) -> None:
        self._providers = providers

    async def is_available(self) -> bool:
        """True if at least one underlying provider is available."""
        for provider in self._providers:
            if await provider.is_available():
                return True
        return False

    async def generate(
        self,
        system_prompt: str,
        user_message: str,
        options: GenerateOptions | None = None,
    ) -> AIResponse:
        """Try each provider in order. Return degradation on total failure."""
        last_error: Exception | None = None

        for provider in self._providers:
            # Fast availability probe — avoids long timeouts on dead providers
            try:
                available = await provider.is_available()
            except Exception as e:  # noqa: BLE001
                logger.warning(
                    "ai.provider_probe_failed",
                    provider=provider.name,
                    error=str(e),
                )
                continue

            if not available:
                logger.info("ai.provider_skipped", provider=provider.name, reason="unavailable")
                continue

            try:
                response = await provider.generate(system_prompt, user_message, options)
                logger.info(
                    "ai.provider_success",
                    provider=provider.name,
                    latency_ms=round(response.latency_ms, 1),
                )
                return response
            except Exception as e:  # noqa: BLE001
                last_error = e
                logger.warning(
                    "ai.provider_failed",
                    provider=provider.name,
                    error=str(e),
                )

        # All providers exhausted
        logger.error(
            "ai.all_providers_failed",
            error=str(last_error),
            providers=[p.name for p in self._providers],
        )
        return AIResponse(
            content=_DEGRADED_RESPONSE,
            provider="none",
            model="none",
            latency_ms=0.0,
        )

    async def stream(
        self,
        system_prompt: str,
        user_message: str,
        options: GenerateOptions | None = None,
    ) -> AsyncGenerator[str, None]:
        """Stream from the first available provider."""
        for provider in self._providers:
            if await provider.is_available():
                async for chunk in provider.stream(system_prompt, user_message, options):
                    yield chunk
                return

        # No provider available — yield the degradation message as a single chunk
        yield _DEGRADED_RESPONSE

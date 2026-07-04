"""
AI Provider Abstractions — base types shared by all providers.

Design: Abstract Base Class pattern so every provider is interchangeable.
New providers added by subclassing BaseAIProvider — no other code changes needed.
"""

from __future__ import annotations

import time
from abc import ABC, abstractmethod
from collections.abc import AsyncGenerator
from dataclasses import dataclass


@dataclass
class AIResponse:
    """Immutable response from any AI provider."""

    content: str  # Raw text / JSON string returned by the model
    provider: str  # e.g. "ollama", "gemini", "none"
    model: str  # e.g. "llama3.2", "gemini-1.5-flash"
    tokens_used: int | None = None
    latency_ms: float = 0.0
    from_cache: bool = False


@dataclass
class GenerateOptions:
    """Optional tuning parameters forwarded to the provider."""

    temperature: float = 0.3
    max_tokens: int = 1024
    timeout_seconds: int = 60


class BaseAIProvider(ABC):
    """
    Abstract base for all AI providers.

    Subclasses implement:
      - generate()       — single completion (returns full response)
      - stream()         — streaming completion (yields chunks)
      - is_available()   — lightweight health probe
    """

    name: str  # Must be set in subclass as class variable

    @abstractmethod
    async def generate(
        self,
        system_prompt: str,
        user_message: str,
        options: GenerateOptions | None = None,
    ) -> AIResponse:
        """Return a complete AI response."""
        ...

    @abstractmethod
    async def stream(
        self,
        system_prompt: str,
        user_message: str,
        options: GenerateOptions | None = None,
    ) -> AsyncGenerator[str, None]:
        """Yield response chunks as they arrive."""
        # async generators cannot use `...` — they need a real body
        return
        yield  # makes this an async generator for subclass compatibility

    @abstractmethod
    async def is_available(self) -> bool:
        """Return True if the provider is reachable and ready."""
        ...

    # ── Helper ────────────────────────────────────────────────────────────────

    @staticmethod
    def _timed() -> Timer:
        return Timer()


class Timer:
    """Simple context-manager to measure elapsed ms."""

    def __enter__(self) -> Timer:
        self._start = time.perf_counter()
        return self

    def __exit__(self, *_: object) -> None:
        self.elapsed_ms = (time.perf_counter() - self._start) * 1000

    @property
    def ms(self) -> float:
        return getattr(self, "elapsed_ms", 0.0)

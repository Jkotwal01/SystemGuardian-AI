"""
Collector Registry — central registry for all OS data collectors.

Design Principle: Open/Closed + Decorator Registration Pattern.
New collectors register themselves with @CollectorRegistry.register.
The orchestrator discovers them automatically — no hardcoded lists.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

import structlog

if TYPE_CHECKING:
    from app.config import Settings

from app.collectors.base import BaseCollector

logger = structlog.get_logger()


class CollectorRegistry:
    """
    Central registry for all OS data collectors.

    Collectors self-register using the @CollectorRegistry.register decorator.
    The orchestrator calls get_enabled() to discover which collectors are
    active based on the current Settings.ENABLED_MODULES list.

    Example:
        @CollectorRegistry.register
        class SecurityCollector(BaseCollector, EventNormalizerMixin):
            name = "windows_security"
            module = EventCategory.SECURITY
            ...
    """

    _collectors: dict[str, type[BaseCollector]] = {}

    @classmethod
    def register(cls, collector_class: type[BaseCollector]) -> type[BaseCollector]:
        """
        Class decorator that registers a collector class.
        Idempotent — registering the same class twice is safe.
        """
        cls._collectors[collector_class.name] = collector_class
        logger.debug(
            "collector_registered",
            name=collector_class.name,
            module=str(collector_class.module),
        )
        return collector_class

    @classmethod
    def get_enabled(cls, settings: Settings) -> list[type[BaseCollector]]:
        """
        Returns collector classes whose module is in settings.ENABLED_MODULES.
        Order matches insertion order (Python 3.7+ dict guarantee).
        """
        enabled = [c for c in cls._collectors.values() if str(c.module) in settings.ENABLED_MODULES]
        logger.debug("collectors_resolved", count=len(enabled))
        return enabled

    @classmethod
    def get_all(cls) -> dict[str, type[BaseCollector]]:
        """Returns all registered collectors (enabled or not)."""
        return dict(cls._collectors)

    @classmethod
    def clear(cls) -> None:
        """
        Clear all registered collectors.
        Only for use in tests — never call in production code.
        """
        cls._collectors.clear()

    @classmethod
    def count(cls) -> int:
        """Number of registered collectors."""
        return len(cls._collectors)

"""
Collector Orchestrator — coordinates and schedules all OS data collectors.

Design Principle: Each collector runs independently. A failure in one
collector never cascades to others (asyncio.gather with return_exceptions=True).
"""

from __future__ import annotations

import asyncio

import structlog
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.collectors.base import BaseCollector, CollectorResult
from app.collectors.registry import CollectorRegistry
from app.config import Settings

logger = structlog.get_logger()


class CollectorOrchestrator:
    """
    Coordinates all registered collectors.

    Responsibilities:
    - Initialize all enabled collectors using the session factory.
    - Run all collectors concurrently via asyncio.gather.
    - Expose health_check_all() for the /health endpoint.
    - Each collector gets its own DB session per run (avoids sharing state).

    Usage:
        orchestrator = CollectorOrchestrator(settings, session_factory)
        await orchestrator.initialize()
        results = await orchestrator.run_all()
    """

    def __init__(
        self, settings: Settings, session_factory: async_sessionmaker[AsyncSession]
    ) -> None:
        self._settings = settings
        self._session_factory = session_factory
        self._collector_classes: list[type[BaseCollector]] = []
        self._initialized = False

    async def initialize(self) -> None:
        """
        Discover and store enabled collector classes from the registry.
        Called once during application startup (lifespan).
        """
        # Import all collectors to trigger @CollectorRegistry.register decorators
        from app.collectors.windows import (  # noqa: F401
            application_collector,
            driver_collector,
            hardware_collector,
            network_collector,
            performance_collector,
            power_collector,
            security_collector,
            storage_collector,
        )

        self._collector_classes = CollectorRegistry.get_enabled(self._settings)
        self._initialized = True
        logger.info(
            "orchestrator_initialized",
            collector_count=len(self._collector_classes),
            enabled_modules=self._settings.ENABLED_MODULES,
        )

    async def run_all(self) -> list[CollectorResult]:
        """
        Run all enabled collectors concurrently.

        Each collector gets a fresh DB session to avoid session-sharing bugs.
        Exceptions from individual collectors are captured (not raised) so
        one failing collector never blocks the others.

        Returns a list of CollectorResult, one per collector.
        """
        if not self._initialized:
            logger.warning("orchestrator_not_initialized")
            return []

        async def _run_one(cls: type[BaseCollector]) -> CollectorResult:
            async with self._session_factory() as session:
                collector = cls(self._settings, session)
                return await collector.run()

        tasks = [_run_one(cls) for cls in self._collector_classes]
        raw_results = await asyncio.gather(*tasks, return_exceptions=True)

        results: list[CollectorResult] = []
        for cls, result in zip(self._collector_classes, raw_results, strict=False):
            if isinstance(result, CollectorResult):
                results.append(result)
            else:
                # An unhandled exception escaped — log and create an error result
                logger.error(
                    "collector_unhandled_exception",
                    collector=cls.name,
                    error=str(result),
                    exc_info=result if isinstance(result, BaseException) else None,
                )
                results.append(
                    CollectorResult(
                        collector_name=cls.name,
                        events_collected=0,
                        errors=[str(result)],
                        duration_ms=0.0,
                        module=str(cls.module),
                    )
                )

        total_events = sum(r.events_collected for r in results)
        total_errors = sum(len(r.errors) for r in results)
        logger.info(
            "orchestrator_run_complete",
            collectors=len(results),
            total_events=total_events,
            total_errors=total_errors,
        )
        return results

    async def health_check_all(self) -> dict[str, bool]:
        """
        Run health_check() on each collector concurrently.
        Returns a mapping of collector_name → bool.
        Used by the /health API endpoint.
        """
        if not self._initialized:
            return {}

        async def _check_one(cls: type[BaseCollector]) -> tuple[str, bool]:
            try:
                async with self._session_factory() as session:
                    collector = cls(self._settings, session)
                    ok = await collector.health_check()
                    return cls.name, ok
            except Exception:  # noqa: BLE001
                return cls.name, False

        tasks = [_check_one(cls) for cls in self._collector_classes]
        pairs = await asyncio.gather(*tasks)
        return dict(pairs)

    @property
    def collector_count(self) -> int:
        """Number of enabled collectors."""
        return len(self._collector_classes)

    @property
    def is_initialized(self) -> bool:
        return self._initialized

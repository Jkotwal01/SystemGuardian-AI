"""
Base abstractions for all OS data collectors.

Design Principles Applied:
- Template Method Pattern: BaseCollector.run() handles all cross-cutting concerns.
  Subclasses only implement _collect() and health_check().
- Single Responsibility: Each class does exactly one thing.
- Open/Closed: New collectors added by subclassing, no base changes needed.
"""

from __future__ import annotations

import time
from abc import ABC, abstractmethod
from dataclasses import dataclass, field

import structlog
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import Settings
from app.domain.enums import EventCategory
from app.models.event import EventModel
from app.repositories.event_repository import EventRepository

logger = structlog.get_logger()


@dataclass
class CollectorResult:
    """
    Immutable result record for a single collector run.
    Captured after every run() call for observability.
    """

    collector_name: str
    events_collected: int
    errors: list[str]
    duration_ms: float
    module: str = ""

    @property
    def success(self) -> bool:
        """True if collector ran without any errors."""
        return len(self.errors) == 0


@dataclass
class CollectorState:
    """Mutable runtime state tracked per collector instance."""

    last_run_at: float = 0.0
    total_events: int = 0
    total_errors: list[str] = field(default_factory=list)
    run_count: int = 0


class BaseCollector(ABC):
    """
    Abstract base for all OS data collectors.

    Subclasses implement _collect() and health_check() only.
    Base class handles:
      - Timing and duration tracking
      - Structured error handling (PermissionError isolated from crashes)
      - Structured JSON logging at every step
      - Persisting results to the EventRepository
    """

    name: str  # Must define in subclass as class variable
    module: EventCategory  # EventCategory value — must define in subclass
    enabled: bool = True

    def __init__(self, settings: Settings, db_session: AsyncSession) -> None:
        self._settings = settings
        self._session = db_session
        self._repo = EventRepository(db_session)
        self._state = CollectorState()
        self._logger = logger.bind(collector=self.name, module=self.module)

    async def run(self) -> CollectorResult:
        """
        Template method — handles all cross-cutting concerns.
        1. Guard: skip if disabled.
        2. Call _collect() — subclass provides data.
        3. Persist each event via repository.
        4. Log result and return CollectorResult.
        """
        if not self.enabled:
            return CollectorResult(
                collector_name=self.name,
                events_collected=0,
                errors=[],
                duration_ms=0.0,
                module=str(self.module),
            )

        start = time.perf_counter()
        errors: list[str] = []
        count = 0

        try:
            events = await self._collect()
            for event in events:
                await self._repo.save(event)
                count += 1
        except PermissionError as e:
            # Non-fatal: user may not have admin rights for some logs
            msg = f"Permission denied: {e}"
            errors.append(msg)
            self._logger.warning("permission_error", error=str(e))
        except Exception as e:  # noqa: BLE001
            msg = str(e)
            errors.append(msg)
            self._logger.error("collection_failed", error=str(e), exc_info=True)

        duration = (time.perf_counter() - start) * 1000

        # Update state for observability
        self._state.last_run_at = time.time()
        self._state.total_events += count
        self._state.run_count += 1
        if errors:
            self._state.total_errors.extend(errors)

        result = CollectorResult(
            collector_name=self.name,
            events_collected=count,
            errors=errors,
            duration_ms=round(duration, 2),
            module=str(self.module),
        )

        self._logger.info(
            "collection_complete",
            count=count,
            duration_ms=result.duration_ms,
            errors=len(errors),
        )
        return result

    @abstractmethod
    async def _collect(self) -> list[EventModel]:
        """
        Subclass implements this.
        Must return a list of fully populated EventModel instances.
        All normalization happens here — base class only persists.
        """
        ...

    @abstractmethod
    async def health_check(self) -> bool:
        """
        Returns True if collector can successfully access its data source.
        Used by the orchestrator to report per-collector health.
        """
        ...

    @property
    def state(self) -> CollectorState:
        """Read-only view of collector runtime state."""
        return self._state

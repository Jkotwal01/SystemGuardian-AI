"""
Tests for BaseCollector and CollectorResult.

Verifies:
- Template method: run() handles timing, error capture, and persistence
- PermissionError is caught gracefully (non-fatal)
- Unhandled exceptions are caught and reported in CollectorResult
- Disabled collectors skip _collect()
- CollectorResult.success property works correctly
"""

from __future__ import annotations

from datetime import UTC
from unittest.mock import AsyncMock, MagicMock

import pytest

from app.collectors.base import BaseCollector, CollectorResult
from app.domain.enums import EventCategory, Severity
from app.models.event import EventModel

# ── Concrete test implementation ─────────────────────────────────────────────


class FakeCollector(BaseCollector):
    """Minimal concrete collector for testing BaseCollector behaviour."""

    name = "test_collector"
    module = EventCategory.PERFORMANCE

    def __init__(self, settings: MagicMock, session: AsyncMock, events: list[EventModel]) -> None:
        super().__init__(settings, session)
        self._events = events
        # Patch out the real repo
        self._repo = AsyncMock()
        self._repo.save = AsyncMock(side_effect=lambda e: e)

    async def _collect(self) -> list[EventModel]:
        return self._events

    async def health_check(self) -> bool:
        return True


class CrashingCollector(BaseCollector):
    """Collector that raises a generic exception in _collect."""

    name = "crashing_collector"
    module = EventCategory.SECURITY

    def __init__(self, settings: MagicMock, session: AsyncMock) -> None:
        super().__init__(settings, session)
        self._repo = AsyncMock()

    async def _collect(self) -> list[EventModel]:
        raise ValueError("Simulated crash")

    async def health_check(self) -> bool:
        return False


class PermissionDeniedCollector(BaseCollector):
    """Collector that raises PermissionError in _collect."""

    name = "permission_denied_collector"
    module = EventCategory.SECURITY

    def __init__(self, settings: MagicMock, session: AsyncMock) -> None:
        super().__init__(settings, session)
        self._repo = AsyncMock()

    async def _collect(self) -> list[EventModel]:
        raise PermissionError("Access denied to Security log")

    async def health_check(self) -> bool:
        return False


# ── Fixtures ──────────────────────────────────────────────────────────────────


def _make_event() -> EventModel:
    import uuid
    from datetime import datetime

    return EventModel(
        id=uuid.uuid4().hex,
        source="test",
        category=EventCategory.PERFORMANCE,
        severity=Severity.INFO,
        title="Test Event",
        raw_data={},
        normalized_data={},
        occurred_at=datetime.now(UTC),
    )


# ── Tests ─────────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_collector_result_success_property() -> None:
    result = CollectorResult("test", 5, [], 100.0)
    assert result.success is True

    result_with_errors = CollectorResult("test", 0, ["err1", "err2"], 10.0)
    assert result_with_errors.success is False


@pytest.mark.asyncio
async def test_base_collector_run_persists_events(
    mock_settings: MagicMock, mock_db_session: AsyncMock
) -> None:
    """run() should call repo.save() for each event returned by _collect()."""
    events = [_make_event(), _make_event(), _make_event()]
    collector = FakeCollector(mock_settings, mock_db_session, events)

    result = await collector.run()

    assert result.events_collected == 3
    assert result.success is True
    assert result.duration_ms >= 0
    assert collector._repo.save.call_count == 3


@pytest.mark.asyncio
async def test_base_collector_run_empty_events(
    mock_settings: MagicMock, mock_db_session: AsyncMock
) -> None:
    """run() with no events returns CollectorResult with 0 count."""
    collector = FakeCollector(mock_settings, mock_db_session, [])
    result = await collector.run()

    assert result.events_collected == 0
    assert result.success is True


@pytest.mark.asyncio
async def test_base_collector_disabled_skips_collect(
    mock_settings: MagicMock, mock_db_session: AsyncMock
) -> None:
    """Disabled collectors must not call _collect() at all."""
    collector = FakeCollector(mock_settings, mock_db_session, [_make_event()])
    collector.enabled = False

    result = await collector.run()

    assert result.events_collected == 0
    assert collector._repo.save.call_count == 0


@pytest.mark.asyncio
async def test_base_collector_captures_permission_error(
    mock_settings: MagicMock, mock_db_session: AsyncMock
) -> None:
    """PermissionError must be captured non-fatally and reported in errors."""
    collector = PermissionDeniedCollector(mock_settings, mock_db_session)
    result = await collector.run()

    assert result.events_collected == 0
    assert len(result.errors) == 1
    assert "Permission denied" in result.errors[0]
    assert result.success is False


@pytest.mark.asyncio
async def test_base_collector_captures_generic_exception(
    mock_settings: MagicMock, mock_db_session: AsyncMock
) -> None:
    """Generic exceptions must be captured and not re-raised."""
    collector = CrashingCollector(mock_settings, mock_db_session)
    result = await collector.run()

    assert result.events_collected == 0
    assert len(result.errors) == 1
    assert "Simulated crash" in result.errors[0]


@pytest.mark.asyncio
async def test_base_collector_updates_state_after_run(
    mock_settings: MagicMock, mock_db_session: AsyncMock
) -> None:
    """State tracking increments correctly after each run()."""
    events = [_make_event()]
    collector = FakeCollector(mock_settings, mock_db_session, events)

    await collector.run()
    await collector.run()

    assert collector.state.run_count == 2
    assert collector.state.total_events == 2
    assert collector.state.last_run_at > 0


@pytest.mark.asyncio
async def test_collector_result_module_field(
    mock_settings: MagicMock, mock_db_session: AsyncMock
) -> None:
    """CollectorResult.module is set from collector.module."""
    collector = FakeCollector(mock_settings, mock_db_session, [])
    result = await collector.run()
    assert result.module == str(EventCategory.PERFORMANCE)

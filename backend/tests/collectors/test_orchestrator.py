"""
Tests for CollectorOrchestrator.

Verifies:
- initialize() discovers all enabled collectors
- run_all() runs collectors concurrently and returns results
- One collector crashing doesn't stop others
- health_check_all() aggregates per-collector health
- Uninitialized orchestrator returns empty list from run_all()
"""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.collectors.base import BaseCollector, CollectorResult
from app.collectors.orchestrator import CollectorOrchestrator
from app.collectors.registry import CollectorRegistry
from app.domain.enums import EventCategory
from app.models.event import EventModel

# ── Stub collectors ───────────────────────────────────────────────────────────


class GoodCollector(BaseCollector):
    name = "good_collector"
    module = EventCategory.PERFORMANCE

    async def _collect(self) -> list[EventModel]:
        return []

    async def health_check(self) -> bool:
        return True


class BadCollector(BaseCollector):
    name = "bad_collector"
    module = EventCategory.SECURITY

    async def _collect(self) -> list[EventModel]:
        raise RuntimeError("Simulated failure")

    async def health_check(self) -> bool:
        return False


# ── Fixtures ──────────────────────────────────────────────────────────────────


@pytest.fixture(autouse=True)
def clean_registry() -> None:
    CollectorRegistry.clear()
    yield
    CollectorRegistry.clear()


@pytest.fixture()
def mock_settings() -> MagicMock:
    s = MagicMock()
    s.ENABLED_MODULES = ["performance", "security"]
    s.EVENT_POLL_INTERVAL_SECONDS = 60
    s.METRICS_INTERVAL_SECONDS = 30
    return s


@pytest.fixture()
def mock_session_factory() -> MagicMock:
    session = AsyncMock()
    session.add = MagicMock()
    session.commit = AsyncMock()
    session.refresh = AsyncMock()

    factory = MagicMock()
    # __aenter__ returns the mock session, __aexit__ does nothing
    factory.return_value.__aenter__ = AsyncMock(return_value=session)
    factory.return_value.__aexit__ = AsyncMock(return_value=False)
    return factory


# ── Tests ──────────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_orchestrator_not_initialized_returns_empty(
    mock_settings: MagicMock, mock_session_factory: MagicMock
) -> None:
    orch = CollectorOrchestrator(mock_settings, mock_session_factory)
    results = await orch.run_all()
    assert results == []


@pytest.mark.asyncio
async def test_orchestrator_initialize_discovers_enabled(
    mock_settings: MagicMock, mock_session_factory: MagicMock
) -> None:
    CollectorRegistry.register(GoodCollector)
    orch = CollectorOrchestrator(mock_settings, mock_session_factory)

    with patch(
        "app.collectors.orchestrator.CollectorRegistry.get_enabled", return_value=[GoodCollector]
    ):
        # Mock the import so it doesn't try to import Windows modules in Linux CI
        with patch("builtins.__import__"):
            await orch.initialize()

    assert orch.is_initialized
    assert orch.collector_count == 1


@pytest.mark.asyncio
async def test_orchestrator_run_all_returns_results(
    mock_settings: MagicMock, mock_session_factory: MagicMock
) -> None:
    """run_all() should return one CollectorResult per enabled collector."""
    orch = CollectorOrchestrator(mock_settings, mock_session_factory)
    orch._collector_classes = [GoodCollector]
    orch._initialized = True

    results = await orch.run_all()

    assert len(results) == 1
    assert isinstance(results[0], CollectorResult)
    assert results[0].collector_name == "good_collector"


@pytest.mark.asyncio
async def test_orchestrator_isolates_failing_collector(
    mock_settings: MagicMock, mock_session_factory: MagicMock
) -> None:
    """A crashing collector must produce an error result, not kill others."""
    orch = CollectorOrchestrator(mock_settings, mock_session_factory)
    orch._collector_classes = [GoodCollector, BadCollector]
    orch._initialized = True

    results = await orch.run_all()

    assert len(results) == 2
    names = {r.collector_name for r in results}
    assert "good_collector" in names
    assert "bad_collector" in names

    bad_result = next(r for r in results if r.collector_name == "bad_collector")
    assert len(bad_result.errors) > 0


@pytest.mark.asyncio
async def test_orchestrator_health_check_all(
    mock_settings: MagicMock, mock_session_factory: MagicMock
) -> None:
    """health_check_all() returns per-collector bool dict."""
    orch = CollectorOrchestrator(mock_settings, mock_session_factory)
    orch._collector_classes = [GoodCollector, BadCollector]
    orch._initialized = True

    health = await orch.health_check_all()

    assert health["good_collector"] is True
    assert health["bad_collector"] is False


@pytest.mark.asyncio
async def test_orchestrator_health_check_uninitialized(
    mock_settings: MagicMock, mock_session_factory: MagicMock
) -> None:
    orch = CollectorOrchestrator(mock_settings, mock_session_factory)
    result = await orch.health_check_all()
    assert result == {}

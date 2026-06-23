"""
Tests for CollectorRegistry.

Verifies:
- @CollectorRegistry.register decorator adds class to registry
- get_enabled() filters by settings.ENABLED_MODULES
- get_all() returns all registered collectors regardless of enabled state
- clear() resets the registry (used between tests)
- count() reflects current registered count
- Registering same class twice is idempotent
"""

from __future__ import annotations

from unittest.mock import MagicMock

import pytest

from app.collectors.base import BaseCollector
from app.collectors.registry import CollectorRegistry
from app.domain.enums import EventCategory
from app.models.event import EventModel

# ── Test collector stubs ───────────────────────────────────────────────────────


def _make_stub(name: str, module: EventCategory) -> type[BaseCollector]:
    """Dynamically create a minimal BaseCollector subclass."""

    class StubCollector(BaseCollector):
        async def _collect(self) -> list[EventModel]:
            return []

        async def health_check(self) -> bool:
            return True

    StubCollector.name = name  # type: ignore[attr-defined]
    StubCollector.module = module  # type: ignore[attr-defined]
    return StubCollector  # type: ignore[return-value]


# ── Fixtures ───────────────────────────────────────────────────────────────────


@pytest.fixture(autouse=True)
def clear_registry() -> None:
    """Ensure each test starts with a clean registry."""
    CollectorRegistry.clear()
    yield
    CollectorRegistry.clear()


@pytest.fixture()
def mock_settings_all_enabled() -> MagicMock:
    s = MagicMock()
    s.ENABLED_MODULES = [
        "security",
        "performance",
        "hardware",
        "network",
        "application",
        "storage",
        "driver",
        "power",
    ]
    return s


@pytest.fixture()
def mock_settings_only_security() -> MagicMock:
    s = MagicMock()
    s.ENABLED_MODULES = ["security"]
    return s


# ── Tests ──────────────────────────────────────────────────────────────────────


def test_register_decorator_adds_to_registry() -> None:
    stub = _make_stub("test_security", EventCategory.SECURITY)
    CollectorRegistry.register(stub)
    assert "test_security" in CollectorRegistry.get_all()


def test_register_returns_class_unchanged() -> None:
    stub = _make_stub("test_perf", EventCategory.PERFORMANCE)
    returned = CollectorRegistry.register(stub)
    assert returned is stub


def test_register_idempotent() -> None:
    """Registering same class twice must not duplicate it."""
    stub = _make_stub("test_dup", EventCategory.SECURITY)
    CollectorRegistry.register(stub)
    CollectorRegistry.register(stub)
    assert CollectorRegistry.count() == 1


def test_get_all_returns_all_registered() -> None:
    sec = _make_stub("sec", EventCategory.SECURITY)
    perf = _make_stub("perf", EventCategory.PERFORMANCE)
    CollectorRegistry.register(sec)
    CollectorRegistry.register(perf)
    all_collectors = CollectorRegistry.get_all()
    assert "sec" in all_collectors
    assert "perf" in all_collectors
    assert len(all_collectors) == 2


def test_get_enabled_filters_by_modules(
    mock_settings_only_security: MagicMock,
) -> None:
    sec = _make_stub("sec2", EventCategory.SECURITY)
    perf = _make_stub("perf2", EventCategory.PERFORMANCE)
    CollectorRegistry.register(sec)
    CollectorRegistry.register(perf)

    enabled = CollectorRegistry.get_enabled(mock_settings_only_security)
    assert len(enabled) == 1
    assert enabled[0].name == "sec2"


def test_get_enabled_returns_all_when_all_enabled(
    mock_settings_all_enabled: MagicMock,
) -> None:
    for cat in EventCategory:
        CollectorRegistry.register(_make_stub(f"col_{cat}", cat))

    enabled = CollectorRegistry.get_enabled(mock_settings_all_enabled)
    # Should have at least one collector for each enabled module
    assert len(enabled) >= 8


def test_get_enabled_empty_when_no_modules(mock_settings_all_enabled: MagicMock) -> None:
    mock_settings_all_enabled.ENABLED_MODULES = []
    CollectorRegistry.register(_make_stub("lone_sec", EventCategory.SECURITY))
    enabled = CollectorRegistry.get_enabled(mock_settings_all_enabled)
    assert enabled == []


def test_clear_resets_registry() -> None:
    CollectorRegistry.register(_make_stub("to_clear", EventCategory.SECURITY))
    assert CollectorRegistry.count() == 1
    CollectorRegistry.clear()
    assert CollectorRegistry.count() == 0


def test_count_reflects_registration() -> None:
    assert CollectorRegistry.count() == 0
    CollectorRegistry.register(_make_stub("a", EventCategory.SECURITY))
    assert CollectorRegistry.count() == 1
    CollectorRegistry.register(_make_stub("b", EventCategory.PERFORMANCE))
    assert CollectorRegistry.count() == 2

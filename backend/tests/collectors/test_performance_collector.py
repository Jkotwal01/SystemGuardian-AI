"""
Tests for PerformanceCollector.

Verifies psutil data collection, severity thresholds, and process list
extraction — all using mocked psutil calls.
"""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.collectors.windows.performance_collector import (
    CPU_THRESHOLDS,
    RAM_THRESHOLDS,
    PerformanceCollector,
    _classify_by_threshold,
)
from app.domain.enums import Severity


@pytest.fixture()
def mock_settings() -> MagicMock:
    s = MagicMock()
    s.EVENT_POLL_INTERVAL_SECONDS = 60
    s.METRICS_INTERVAL_SECONDS = 30
    return s


@pytest.fixture()
def mock_session() -> AsyncMock:
    return AsyncMock()


@pytest.fixture()
def collector(mock_settings: MagicMock, mock_session: AsyncMock) -> PerformanceCollector:
    c = PerformanceCollector(mock_settings, mock_session)
    c._repo = AsyncMock()
    c._repo.save = AsyncMock(side_effect=lambda e: e)
    return c


# ── Threshold classification ──────────────────────────────────────────────────


def test_classify_cpu_critical() -> None:
    assert _classify_by_threshold(96.0, CPU_THRESHOLDS) == Severity.CRITICAL


def test_classify_cpu_high() -> None:
    assert _classify_by_threshold(87.0, CPU_THRESHOLDS) == Severity.HIGH


def test_classify_cpu_medium() -> None:
    assert _classify_by_threshold(72.0, CPU_THRESHOLDS) == Severity.MEDIUM


def test_classify_cpu_info() -> None:
    assert _classify_by_threshold(50.0, CPU_THRESHOLDS) == Severity.INFO


def test_classify_ram_critical() -> None:
    assert _classify_by_threshold(96.0, RAM_THRESHOLDS) == Severity.CRITICAL


# ── _collect() ────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_performance_collector_collect_returns_one_event(
    collector: PerformanceCollector,
) -> None:
    """_collect() must produce exactly one event per cycle."""
    with (
        patch("app.collectors.windows.performance_collector.psutil.cpu_percent", return_value=45.0),
        patch("app.collectors.windows.performance_collector.psutil.cpu_count", return_value=8),
        patch("app.collectors.windows.performance_collector.psutil.virtual_memory") as mock_mem,
        patch("app.collectors.windows.performance_collector.psutil.swap_memory") as mock_swap,
        patch("app.collectors.windows.performance_collector.psutil.process_iter", return_value=[]),
    ):
        mock_mem.return_value = MagicMock(
            percent=60.0, total=16 * 1024**3, available=6 * 1024**3, used=10 * 1024**3
        )
        mock_swap.return_value = MagicMock(percent=10.0, total=8 * 1024**3)

        events = await collector._collect()

    assert len(events) == 1
    event = events[0]
    assert event.raw_data["cpu_percent"] == 45.0
    assert event.raw_data["ram_percent"] == 60.0


@pytest.mark.asyncio
async def test_performance_collector_critical_cpu_severity(
    collector: PerformanceCollector,
) -> None:
    """CPU at 97% → CRITICAL event."""
    with (
        patch("app.collectors.windows.performance_collector.psutil.cpu_percent", return_value=97.0),
        patch("app.collectors.windows.performance_collector.psutil.cpu_count", return_value=4),
        patch("app.collectors.windows.performance_collector.psutil.virtual_memory") as mock_mem,
        patch("app.collectors.windows.performance_collector.psutil.swap_memory") as mock_swap,
        patch("app.collectors.windows.performance_collector.psutil.process_iter", return_value=[]),
    ):
        mock_mem.return_value = MagicMock(
            percent=50.0, total=8 * 1024**3, available=4 * 1024**3, used=4 * 1024**3
        )
        mock_swap.return_value = MagicMock(percent=5.0, total=4 * 1024**3)

        events = await collector._collect()

    assert events[0].severity == Severity.CRITICAL


@pytest.mark.asyncio
async def test_performance_collector_health_check(
    collector: PerformanceCollector,
) -> None:
    with patch(
        "app.collectors.windows.performance_collector.psutil.cpu_percent", return_value=10.0
    ):
        assert await collector.health_check() is True


# ── Top process extraction ────────────────────────────────────────────────────


def test_get_top_processes_returns_n_entries() -> None:
    mock_proc = MagicMock()
    mock_proc.info = {"pid": 1, "name": "python.exe", "cpu_percent": 55.0, "memory_percent": 5.0}

    with patch(
        "app.collectors.windows.performance_collector.psutil.process_iter",
        return_value=[mock_proc] * 10,
    ):
        result = PerformanceCollector._get_top_processes(n=3)

    assert len(result) <= 3


def test_get_top_processes_skips_access_denied() -> None:
    import psutil as ps

    bad_proc = MagicMock()
    type(bad_proc).info = property(lambda self: (_ for _ in ()).throw(ps.AccessDenied(0)))

    with patch(
        "app.collectors.windows.performance_collector.psutil.process_iter",
        return_value=[bad_proc],
    ):
        result = PerformanceCollector._get_top_processes()
    assert result == []

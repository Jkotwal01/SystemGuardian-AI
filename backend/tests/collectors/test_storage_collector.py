"""
Tests for StorageCollector.

Verifies:
- _classify_disk_severity returns correct severity based on thresholds
- _collect() returns metrics and calculates the worst-case severity
- health_check() works
"""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.collectors.windows.storage_collector import (
    DISK_CRITICAL_PERCENT,
    DISK_WARN_PERCENT,
    StorageCollector,
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
def collector(mock_settings: MagicMock, mock_session: AsyncMock) -> StorageCollector:
    c = StorageCollector(mock_settings, mock_session)
    c._repo = AsyncMock()
    c._repo.save = AsyncMock(side_effect=lambda e: e)
    return c


# ── Severity classification ───────────────────────────────────────────────────


def test_classify_disk_severity_critical() -> None:
    assert StorageCollector._classify_disk_severity(DISK_CRITICAL_PERCENT + 1) == Severity.CRITICAL
    assert StorageCollector._classify_disk_severity(DISK_CRITICAL_PERCENT) == Severity.CRITICAL


def test_classify_disk_severity_warn() -> None:
    assert StorageCollector._classify_disk_severity(DISK_WARN_PERCENT + 1) == Severity.HIGH
    assert StorageCollector._classify_disk_severity(DISK_WARN_PERCENT) == Severity.HIGH


def test_classify_disk_severity_medium() -> None:
    assert StorageCollector._classify_disk_severity(65.0) == Severity.MEDIUM
    assert StorageCollector._classify_disk_severity(79.0) == Severity.MEDIUM


def test_classify_disk_severity_info() -> None:
    assert StorageCollector._classify_disk_severity(50.0) == Severity.INFO
    assert StorageCollector._classify_disk_severity(64.9) == Severity.INFO


# ── _collect() ────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_storage_collector_collect_healthy(collector: StorageCollector) -> None:
    mock_part = MagicMock()
    mock_part.device = "C:\\"
    mock_part.mountpoint = "C:\\"
    mock_part.fstype = "NTFS"

    mock_usage = MagicMock()
    mock_usage.percent = 50.0
    mock_usage.total = 100 * 1024**3
    mock_usage.used = 50 * 1024**3
    mock_usage.free = 50 * 1024**3

    with (
        patch(
            "app.collectors.windows.storage_collector.psutil.disk_partitions",
            return_value=[mock_part],
        ),
        patch(
            "app.collectors.windows.storage_collector.psutil.disk_usage", return_value=mock_usage
        ),
        patch(
            "app.collectors.windows.storage_collector.psutil.disk_io_counters", return_value=None
        ),
    ):
        events = await collector._collect()

    assert len(events) == 1
    event = events[0]
    assert event.severity == Severity.INFO
    assert event.title == "Storage Healthy — 1 partitions, avg 50% used"
    assert event.raw_data["partition_count"] == 1


@pytest.mark.asyncio
async def test_storage_collector_collect_critical(collector: StorageCollector) -> None:
    mock_part1 = MagicMock()
    mock_part1.device = "C:\\"
    mock_part1.mountpoint = "C:\\"
    mock_usage1 = MagicMock(percent=50.0, total=100, used=50, free=50)

    mock_part2 = MagicMock()
    mock_part2.device = "D:\\"
    mock_part2.mountpoint = "D:\\"
    mock_usage2 = MagicMock(percent=98.0, total=100, used=98, free=2)

    with (
        patch(
            "app.collectors.windows.storage_collector.psutil.disk_partitions",
            return_value=[mock_part1, mock_part2],
        ),
        patch(
            "app.collectors.windows.storage_collector.psutil.disk_usage",
            side_effect=[mock_usage1, mock_usage2],
        ),
        patch(
            "app.collectors.windows.storage_collector.psutil.disk_io_counters", return_value=None
        ),
    ):
        events = await collector._collect()

    assert len(events) == 1
    event = events[0]
    assert event.severity == Severity.CRITICAL
    assert "Storage CRITICAL" in event.title
    assert "D:\\" in event.title


# ── health_check() ────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_health_check_success(collector: StorageCollector) -> None:
    with patch("app.collectors.windows.storage_collector.psutil.disk_partitions", return_value=[]):
        assert await collector.health_check() is True


@pytest.mark.asyncio
async def test_health_check_failure(collector: StorageCollector) -> None:
    with patch(
        "app.collectors.windows.storage_collector.psutil.disk_partitions",
        side_effect=OSError("test error"),
    ):
        assert await collector.health_check() is False

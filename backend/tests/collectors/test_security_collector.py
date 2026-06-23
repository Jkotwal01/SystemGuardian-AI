"""
Tests for SecurityCollector.

Uses mocked win32evtlog so tests pass in CI (no Windows Security log needed).
Verifies:
- event 4625 (failed login) → MEDIUM severity
- event 4732 (admin group add) → CRITICAL severity
- event 1102 (audit log cleared) → CRITICAL severity
- Old events (beyond poll window) are skipped
- Unknown event IDs are skipped
- health_check() returns False on non-Windows
"""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.collectors.windows.security_collector import SecurityCollector
from app.domain.enums import EventCategory, Severity
from tests.collectors.conftest import make_fake_win32_event


@pytest.fixture()
def mock_settings() -> MagicMock:
    s = MagicMock()
    s.EVENT_POLL_INTERVAL_SECONDS = 60
    s.METRICS_INTERVAL_SECONDS = 30
    return s


@pytest.fixture()
def mock_session() -> AsyncMock:
    session = AsyncMock()
    session.add = MagicMock()
    session.commit = AsyncMock()
    session.refresh = AsyncMock()
    return session


@pytest.fixture()
def collector(mock_settings: MagicMock, mock_session: AsyncMock) -> SecurityCollector:
    c = SecurityCollector(mock_settings, mock_session)
    c._repo = AsyncMock()
    c._repo.save = AsyncMock(side_effect=lambda e: e)
    return c


# ── Non-Windows guard ─────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_security_collector_returns_empty_on_non_windows(
    collector: SecurityCollector,
) -> None:
    with patch("app.collectors.windows.security_collector.sys") as mock_sys:
        mock_sys.platform = "linux"
        events = await collector._collect()
    assert events == []


@pytest.mark.asyncio
async def test_health_check_returns_false_on_non_windows(
    collector: SecurityCollector,
) -> None:
    with patch("app.collectors.windows.security_collector.sys") as mock_sys:
        mock_sys.platform = "linux"
        result = await collector.health_check()
    assert result is False


# ── Event normalization ───────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_failed_login_4625_maps_to_medium(collector: SecurityCollector) -> None:
    ev = make_fake_win32_event(event_id=4625, seconds_ago=5)
    raw = collector._win32_event_to_dict(ev)
    model = collector.normalize_windows_event(
        raw=raw,
        category=EventCategory.SECURITY,
        title="Failed Logon Attempt",
        severity=SecurityCollector.EVENT_MAP[4625][1],
        source="windows_security_log",
        source_id="4625",
    )
    assert model.severity == Severity.MEDIUM
    assert model.category == EventCategory.SECURITY
    assert model.title == "Failed Logon Attempt"


@pytest.mark.asyncio
async def test_admin_group_add_4732_maps_to_critical(collector: SecurityCollector) -> None:
    _, severity = SecurityCollector.EVENT_MAP[4732]
    assert severity == Severity.CRITICAL


@pytest.mark.asyncio
async def test_audit_log_cleared_1102_maps_to_critical(collector: SecurityCollector) -> None:
    _, severity = SecurityCollector.EVENT_MAP[1102]
    assert severity == Severity.CRITICAL


@pytest.mark.asyncio
async def test_successful_login_4624_maps_to_info(collector: SecurityCollector) -> None:
    _, severity = SecurityCollector.EVENT_MAP[4624]
    assert severity == Severity.INFO


# ── Win32 event dict conversion ───────────────────────────────────────────────


def test_win32_event_to_dict_extracts_all_fields(collector: SecurityCollector) -> None:
    ev = make_fake_win32_event(event_id=4625, string_inserts=["user1", "DOMAIN"])
    result = collector._win32_event_to_dict(ev)

    assert result["EventID"] == 4625
    assert result["SourceName"] == "Microsoft-Windows-Security-Auditing"
    assert result["ComputerName"] == "TEST-PC"
    assert result["StringInserts"] == ["user1", "DOMAIN"]


def test_win32_event_to_dict_handles_no_inserts(collector: SecurityCollector) -> None:
    ev = make_fake_win32_event(event_id=4625)
    ev.StringInserts = None
    result = collector._win32_event_to_dict(ev)
    assert result["StringInserts"] == []


# ── Old event detection ───────────────────────────────────────────────────────


def test_is_old_event_recent_returns_false(collector: SecurityCollector) -> None:
    ev = make_fake_win32_event(seconds_ago=5)
    assert collector._is_old_event(ev) is False


def test_is_old_event_old_returns_true(collector: SecurityCollector) -> None:
    ev = make_fake_win32_event(seconds_ago=3600)  # 1 hour old
    assert collector._is_old_event(ev) is True


# ── Windows mock integration ──────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_security_collector_collects_known_events_via_mock(
    collector: SecurityCollector,
) -> None:
    """Full _collect() via mocked win32evtlog returning known event IDs."""
    ev_4625 = make_fake_win32_event(event_id=4625, seconds_ago=5)
    ev_4624 = make_fake_win32_event(event_id=4624, seconds_ago=10)
    ev_unknown = make_fake_win32_event(event_id=9999, seconds_ago=5)

    mock_handle = MagicMock()

    with (
        patch("app.collectors.windows.security_collector.sys") as mock_sys,
        patch("app.collectors.windows.security_collector.win32evtlog") as mock_evtlog,
    ):
        mock_sys.platform = "win32"
        mock_evtlog.OpenEventLog.return_value = mock_handle
        mock_evtlog.CloseEventLog = MagicMock()
        mock_evtlog.EVENTLOG_BACKWARDS_READ = 8
        mock_evtlog.EVENTLOG_SEQUENTIAL_READ = 1
        # First call returns events; second call returns empty to end loop
        mock_evtlog.ReadEventLog.side_effect = [
            [ev_4625, ev_4624, ev_unknown],
            [],
        ]

        events = await collector._collect()

    # Only known event IDs should be collected (9999 skipped)
    assert len(events) == 2
    titles = {e.title for e in events}
    assert "Failed Logon Attempt" in titles
    assert "Successful Logon" in titles


@pytest.mark.asyncio
async def test_security_health_check_succeeds_via_mock(
    collector: SecurityCollector,
) -> None:
    mock_handle = MagicMock()
    with (
        patch("app.collectors.windows.security_collector.sys") as mock_sys,
        patch("app.collectors.windows.security_collector.win32evtlog") as mock_evtlog,
    ):
        mock_sys.platform = "win32"
        mock_evtlog.OpenEventLog.return_value = mock_handle
        mock_evtlog.CloseEventLog = MagicMock()

        result = await collector.health_check()

    assert result is True

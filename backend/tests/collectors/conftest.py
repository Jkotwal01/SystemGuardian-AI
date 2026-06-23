"""
Shared fixtures for all collector tests.

Key design:
- mock_db_session: An async mock session that satisfies EventRepository.save()
- mock_settings: A minimal Settings instance with fast poll intervals for testing
- collector_factory: A factory that constructs any collector with mocked deps
"""

from __future__ import annotations

from datetime import UTC, datetime
from unittest.mock import AsyncMock, MagicMock

import pytest

from app.config import Settings


@pytest.fixture()
def mock_settings() -> Settings:
    """Settings instance tuned for fast test cycles."""
    s = MagicMock(spec=Settings)
    s.EVENT_POLL_INTERVAL_SECONDS = 60
    s.METRICS_INTERVAL_SECONDS = 30
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
    return s  # type: ignore[return-value]


@pytest.fixture()
def mock_db_session() -> AsyncMock:
    """Async mock SQLAlchemy session. save() just returns the entity."""
    session = AsyncMock()
    session.add = MagicMock()
    session.commit = AsyncMock()
    session.refresh = AsyncMock()
    session.get = AsyncMock(return_value=None)
    return session


def make_fake_win32_event(
    event_id: int = 4625,
    source: str = "Microsoft-Windows-Security-Auditing",
    event_type: int = 5,
    string_inserts: list[str] | None = None,
    seconds_ago: int = 10,
) -> MagicMock:
    """
    Create a fake win32evtlog event record for testing.
    seconds_ago controls how old the event appears.
    """
    ev = MagicMock()
    ev.EventID = event_id
    ev.SourceName = source
    ev.EventType = event_type
    ev.StringInserts = string_inserts or ["test_user", "DOMAIN"]
    ev.ComputerName = "TEST-PC"

    # TimeGenerated is a pywintypes.Time-like object
    from datetime import timedelta

    now = datetime.now(UTC) - timedelta(seconds=seconds_ago)
    ts = MagicMock()
    ts.year = now.year
    ts.month = now.month
    ts.day = now.day
    ts.hour = now.hour
    ts.minute = now.minute
    ts.second = now.second
    ev.TimeGenerated = ts

    return ev

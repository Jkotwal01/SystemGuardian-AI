"""
Tests for EventNormalizerMixin.

Verifies:
- normalize_windows_event produces valid EventModel with correct fields
- normalize_metric_event works for psutil-style data
- _extract_normalized_fields extracts expected keys
- map_event_id_to_severity returns correct severity and handles unknown IDs
"""

from __future__ import annotations

from datetime import UTC, datetime

import pytest

from app.collectors.normalizer import EventNormalizerMixin
from app.domain.enums import EventCategory, Severity
from app.models.event import EventModel


class ConcreteNormalizer(EventNormalizerMixin):
    """Concrete subclass to test the mixin in isolation."""

    pass


@pytest.fixture()
def normalizer() -> ConcreteNormalizer:
    return ConcreteNormalizer()


# ── normalize_windows_event ───────────────────────────────────────────────────


def test_normalize_windows_event_returns_event_model(normalizer: ConcreteNormalizer) -> None:
    raw = {
        "EventID": 4625,
        "TimeGenerated": "2024-01-01T00:00:00",
        "SourceName": "Microsoft-Windows-Security-Auditing",
        "EventType": 5,
        "StringInserts": ["test_user"],
        "ComputerName": "TEST-PC",
    }
    event = normalizer.normalize_windows_event(
        raw=raw,
        category=EventCategory.SECURITY,
        title="Failed Logon Attempt",
        severity=Severity.MEDIUM,
        source_id="4625",
    )

    assert isinstance(event, EventModel)
    assert event.category == EventCategory.SECURITY
    assert event.severity == Severity.MEDIUM
    assert event.title == "Failed Logon Attempt"
    assert event.source == "windows_event_log"
    assert event.source_id == "4625"
    assert event.raw_data == raw
    assert event.id is not None and len(event.id) == 32  # UUID hex


def test_normalize_windows_event_uses_provided_occurred_at(
    normalizer: ConcreteNormalizer,
) -> None:
    ts = datetime(2024, 6, 15, 12, 0, 0, tzinfo=UTC)
    event = normalizer.normalize_windows_event(
        raw={},
        category=EventCategory.SECURITY,
        title="Test",
        severity=Severity.INFO,
        occurred_at=ts,
    )
    assert event.occurred_at == ts


def test_normalize_windows_event_defaults_occurred_at_to_now(
    normalizer: ConcreteNormalizer,
) -> None:
    before = datetime.now(UTC)
    event = normalizer.normalize_windows_event(
        raw={},
        category=EventCategory.SECURITY,
        title="Test",
        severity=Severity.INFO,
    )
    after = datetime.now(UTC)
    assert before <= event.occurred_at <= after


def test_normalize_windows_event_each_call_unique_id(normalizer: ConcreteNormalizer) -> None:
    e1 = normalizer.normalize_windows_event(
        raw={}, category=EventCategory.SECURITY, title="T", severity=Severity.INFO
    )
    e2 = normalizer.normalize_windows_event(
        raw={}, category=EventCategory.SECURITY, title="T", severity=Severity.INFO
    )
    assert e1.id != e2.id


# ── normalize_metric_event ────────────────────────────────────────────────────


def test_normalize_metric_event_returns_event_model(normalizer: ConcreteNormalizer) -> None:
    metrics = {"cpu_percent": 42.5, "ram_percent": 60.0}
    event = normalizer.normalize_metric_event(
        metrics=metrics,
        category=EventCategory.PERFORMANCE,
        title="CPU snapshot",
        severity=Severity.INFO,
    )

    assert isinstance(event, EventModel)
    assert event.category == EventCategory.PERFORMANCE
    assert event.raw_data == metrics
    assert event.normalized_data == metrics
    assert event.source == "psutil"


# ── _extract_normalized_fields ────────────────────────────────────────────────


def test_extract_normalized_fields_standard_keys(normalizer: ConcreteNormalizer) -> None:
    raw = {
        "EventID": 4625,
        "TimeGenerated": "2024-01-01T00:00:00",
        "SourceName": "TestSource",
        "EventType": 5,
        "StringInserts": ["user1", "domain"],
        "ComputerName": "PC01",
    }
    result = normalizer._extract_normalized_fields(raw)  # noqa: SLF001

    assert result["event_id"] == 4625  # EventID & 0xFFFF
    assert result["source_name"] == "TestSource"
    assert result["event_type"] == 5
    assert result["string_inserts"] == ["user1", "domain"]
    assert result["computer_name"] == "PC01"


def test_extract_normalized_fields_handles_missing_keys(normalizer: ConcreteNormalizer) -> None:
    raw: dict = {}
    result = normalizer._extract_normalized_fields(raw)
    assert result == {}


def test_extract_normalized_fields_strips_high_bits(normalizer: ConcreteNormalizer) -> None:
    """EventID with high bits set must be masked to lower 16 bits."""
    raw = {"EventID": 0x8000_4625}
    result = normalizer._extract_normalized_fields(raw)
    assert result["event_id"] == 0x4625


# ── map_event_id_to_severity ──────────────────────────────────────────────────


def test_map_event_id_to_severity_known_id(normalizer: ConcreteNormalizer) -> None:
    severity_map = {4625: Severity.MEDIUM, 1102: Severity.CRITICAL}
    assert normalizer.map_event_id_to_severity(4625, severity_map) == Severity.MEDIUM
    assert normalizer.map_event_id_to_severity(1102, severity_map) == Severity.CRITICAL


def test_map_event_id_to_severity_unknown_id_returns_default(
    normalizer: ConcreteNormalizer,
) -> None:
    assert normalizer.map_event_id_to_severity(9999, {}) == Severity.INFO


def test_map_event_id_to_severity_custom_default(normalizer: ConcreteNormalizer) -> None:
    result = normalizer.map_event_id_to_severity(9999, {}, default=Severity.LOW)
    assert result == Severity.LOW

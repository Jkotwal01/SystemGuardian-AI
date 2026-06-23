"""
Event normalization mixin for Windows data collectors.

Design Principle: Mixin pattern provides shared normalization logic
injected into collectors via multiple inheritance — no code duplication.
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime
from typing import Any

from app.domain.enums import EventCategory, Severity
from app.models.event import EventModel


def _generate_uuid() -> str:
    return uuid.uuid4().hex


class EventNormalizerMixin:
    """
    Shared normalization logic for all collectors.
    Converts OS-specific raw data into a unified EventModel.

    Usage:
        class SecurityCollector(BaseCollector, EventNormalizerMixin):
            ...
            def _make_event(self, raw):
                return self.normalize_windows_event(raw, ...)
    """

    def normalize_windows_event(
        self,
        raw: dict[str, Any],
        category: EventCategory,
        title: str,
        severity: Severity,
        source: str = "windows_event_log",
        source_id: str | None = None,
        occurred_at: datetime | None = None,
    ) -> EventModel:
        """
        Produces a fully populated EventModel from a raw Windows event dict.

        Args:
            raw: The raw event data as returned by win32evtlog or similar.
            category: Which EventCategory this event belongs to.
            title: Human-readable title for the event.
            severity: Calculated Severity for this event.
            source: The data source name (default: windows_event_log).
            source_id: The external ID (e.g., Windows Event ID as string).
            occurred_at: Override for event timestamp. Defaults to now(UTC).
        """
        return EventModel(
            id=_generate_uuid(),
            source=source,
            source_id=source_id,
            category=category,
            severity=severity,
            title=title,
            raw_data=raw,
            normalized_data=self._extract_normalized_fields(raw),
            occurred_at=occurred_at or datetime.now(UTC),
        )

    def normalize_metric_event(
        self,
        metrics: dict[str, Any],
        category: EventCategory,
        title: str,
        severity: Severity,
        source: str = "psutil",
    ) -> EventModel:
        """
        Produces an EventModel from a psutil-style metrics dict.
        Used by performance, hardware, network, storage collectors.
        """
        return EventModel(
            id=_generate_uuid(),
            source=source,
            source_id=None,
            category=category,
            severity=severity,
            title=title,
            raw_data=metrics,
            normalized_data=metrics,  # already normalized for metric events
            occurred_at=datetime.now(UTC),
        )

    @staticmethod
    def _extract_normalized_fields(raw: dict[str, Any]) -> dict[str, Any]:
        """
        Extract a standardized subset of fields from a raw Windows event dict.
        Keys preserved: EventID, TimeGenerated, SourceName, EventType, StringInserts.
        """
        normalized: dict[str, Any] = {}

        if "EventID" in raw:
            normalized["event_id"] = int(raw["EventID"]) & 0xFFFF
        if "TimeGenerated" in raw:
            ts = raw["TimeGenerated"]
            normalized["time_generated"] = ts.isoformat() if hasattr(ts, "isoformat") else str(ts)
        if "SourceName" in raw:
            normalized["source_name"] = raw["SourceName"]
        if "EventType" in raw:
            normalized["event_type"] = raw["EventType"]
        if "StringInserts" in raw:
            inserts = raw["StringInserts"]
            normalized["string_inserts"] = list(inserts) if inserts else []
        if "ComputerName" in raw:
            normalized["computer_name"] = raw["ComputerName"]

        return normalized

    @staticmethod
    def map_event_id_to_severity(
        event_id: int,
        severity_map: dict[int, Severity],
        default: Severity = Severity.INFO,
    ) -> Severity:
        """Look up the severity for a Windows Event ID."""
        return severity_map.get(event_id, default)

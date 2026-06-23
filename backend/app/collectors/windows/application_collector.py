"""
Application Collector — reads Windows Application Event Log.

Monitors: application crashes, .NET errors, Windows Installer events,
Service Control Manager events, and user-space application errors.
"""

from __future__ import annotations

import sys
from datetime import UTC, datetime
from typing import Any

import structlog

from app.collectors.base import BaseCollector
from app.collectors.normalizer import EventNormalizerMixin
from app.collectors.registry import CollectorRegistry
from app.domain.enums import EventCategory, Severity
from app.models.event import EventModel

if sys.platform == "win32":
    import win32evtlog

logger = structlog.get_logger()


@CollectorRegistry.register
class ApplicationCollector(BaseCollector, EventNormalizerMixin):
    """
    Reads from the Windows Application Event Log.
    Focuses on application crashes, .NET exceptions, and installer events.
    """

    name = "windows_application"
    module = EventCategory.APPLICATION

    # Windows Application Event IDs of interest
    EVENT_MAP: dict[int, tuple[str, Severity]] = {
        # Windows Error Reporting / Application crash
        1000: ("Application Crash", Severity.HIGH),
        1001: ("Windows Error Reporting", Severity.MEDIUM),
        1002: ("Application Hang", Severity.HIGH),
        # .NET Runtime
        1026: (".NET Runtime Exception", Severity.HIGH),
        1023: (".NET Runtime Upgrade Warning", Severity.LOW),
        # MSI / Installer
        1033: ("MSI Installation Completed", Severity.INFO),
        1034: ("MSI Application Removed", Severity.INFO),
        # Generic Error / Warning (EventType 1=Error, 2=Warning)
        # These are covered dynamically below
    }

    # EventType values in win32evtlog
    WIN32_EVENT_TYPE_ERROR = 1
    WIN32_EVENT_TYPE_WARNING = 2

    async def _collect(self) -> list[EventModel]:
        if sys.platform != "win32":
            logger.debug("application_collector_skip_non_windows")
            return []

        events: list[EventModel] = []
        hand = win32evtlog.OpenEventLog(None, "Application")

        try:
            flags = win32evtlog.EVENTLOG_BACKWARDS_READ | win32evtlog.EVENTLOG_SEQUENTIAL_READ

            while True:
                batch = win32evtlog.ReadEventLog(hand, flags, 0)
                if not batch:
                    break
                for ev in batch:
                    if self._is_old_event(ev):
                        return events

                    event_id = int(ev.EventID) & 0xFFFF

                    if event_id in self.EVENT_MAP:
                        title, severity = self.EVENT_MAP[event_id]
                    elif ev.EventType == self.WIN32_EVENT_TYPE_ERROR:
                        title = f"Application Error — {ev.SourceName}"
                        severity = Severity.MEDIUM
                    elif ev.EventType == self.WIN32_EVENT_TYPE_WARNING:
                        title = f"Application Warning — {ev.SourceName}"
                        severity = Severity.LOW
                    else:
                        continue  # Skip informational events not in EVENT_MAP

                    raw = self._win32_event_to_dict(ev)
                    model = self.normalize_windows_event(
                        raw=raw,
                        category=EventCategory.APPLICATION,
                        title=title,
                        severity=severity,
                        source="windows_application_log",
                        source_id=str(event_id),
                        occurred_at=self._parse_event_time(ev),
                    )
                    events.append(model)
        finally:
            win32evtlog.CloseEventLog(hand)

        return events

    async def health_check(self) -> bool:
        if sys.platform != "win32":
            return False
        try:
            hand = win32evtlog.OpenEventLog(None, "Application")
            win32evtlog.CloseEventLog(hand)
            return True
        except Exception:  # noqa: BLE001
            return False

    def _win32_event_to_dict(self, ev: Any) -> dict[str, Any]:
        inserts: list[str] = []
        if ev.StringInserts:
            inserts = [str(s) for s in ev.StringInserts]
        return {
            "EventID": int(ev.EventID) & 0xFFFF,
            "TimeGenerated": str(ev.TimeGenerated),
            "SourceName": ev.SourceName,
            "EventType": ev.EventType,
            "StringInserts": inserts,
            "ComputerName": ev.ComputerName,
        }

    def _parse_event_time(self, ev: Any) -> datetime:
        try:
            ts = ev.TimeGenerated
            return datetime(
                ts.year,
                ts.month,
                ts.day,
                ts.hour,
                ts.minute,
                ts.second,
                tzinfo=UTC,
            )
        except Exception:  # noqa: BLE001
            return datetime.now(UTC)

    def _is_old_event(self, ev: Any) -> bool:
        try:
            ts = ev.TimeGenerated
            event_time = datetime(
                ts.year,
                ts.month,
                ts.day,
                ts.hour,
                ts.minute,
                ts.second,
                tzinfo=UTC,
            )
            age = (datetime.now(UTC) - event_time).total_seconds()
            return age > self._settings.EVENT_POLL_INTERVAL_SECONDS
        except Exception:  # noqa: BLE001
            return True

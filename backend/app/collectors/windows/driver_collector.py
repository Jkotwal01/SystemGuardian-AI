"""
Driver Collector — reads Windows System Event Log for driver events.

Monitors: driver failures to start, driver crashes, service failures,
and service state changes that indicate driver-level problems.
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
    import win32evtlog  # pyright: ignore[reportMissingModuleSource]

logger = structlog.get_logger()


@CollectorRegistry.register
class DriverCollector(BaseCollector, EventNormalizerMixin):
    """
    Reads from the Windows System Event Log, focusing on Service Control
    Manager (source: "Service Control Manager") driver/service events.
    """

    name = "windows_driver"
    module = EventCategory.DRIVER

    # Service Control Manager event IDs
    EVENT_MAP: dict[int, tuple[str, Severity]] = {
        7000: ("Service/Driver Failed to Start", Severity.HIGH),
        7001: ("Service Dependency Failure", Severity.MEDIUM),
        7009: ("Service Timeout on Connect", Severity.MEDIUM),
        7011: ("Service Timeout on Transaction", Severity.MEDIUM),
        7022: ("Service Hung on Start", Severity.HIGH),
        7023: ("Service Terminated with Error", Severity.HIGH),
        7024: ("Service Terminated with Service-Specific Error", Severity.HIGH),
        7026: ("Boot-Start or System-Start Driver Failed to Load", Severity.CRITICAL),
        7031: ("Service Terminated Unexpectedly", Severity.HIGH),
        7032: ("Service Recovery Action Failed", Severity.MEDIUM),
        7034: ("Service Terminated Unexpectedly (nth time)", Severity.HIGH),
        7045: ("New Service Installed", Severity.MEDIUM),
        # BSOD / critical system failure
        1001: ("Windows Error Recovery — System Crash", Severity.CRITICAL),
        6008: ("Unexpected System Shutdown / Power Loss", Severity.CRITICAL),
        41: ("Kernel Power — System Reboot without Clean Shutdown", Severity.CRITICAL),
    }

    async def _collect(self) -> list[EventModel]:
        if sys.platform != "win32":
            logger.debug("driver_collector_skip_non_windows")
            return []

        events: list[EventModel] = []
        hand = win32evtlog.OpenEventLog(None, "System")

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
                    if event_id not in self.EVENT_MAP:
                        continue

                    title, severity = self.EVENT_MAP[event_id]
                    raw = self._win32_event_to_dict(ev)
                    model = self.normalize_windows_event(
                        raw=raw,
                        category=EventCategory.DRIVER,
                        title=title,
                        severity=severity,
                        source="windows_system_log",
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
            hand = win32evtlog.OpenEventLog(None, "System")
            win32evtlog.CloseEventLog(hand)
            return True
        except Exception:  # noqa: BLE001
            return False

    def _win32_event_to_dict(self, ev: Any) -> dict[str, Any]:  # noqa: ANN401
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

    def _parse_event_time(self, ev: Any) -> datetime:  # noqa: ANN401
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

    def _is_old_event(self, ev: Any) -> bool:  # noqa: ANN401
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

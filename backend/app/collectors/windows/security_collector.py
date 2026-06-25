"""
Security Collector — reads Windows Security Event Log.

Monitors: login events, account changes, privilege escalations,
scheduled task manipulation, and audit log tampering.
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
class SecurityCollector(BaseCollector, EventNormalizerMixin):
    """
    Reads from the Windows Security Event Log.
    Requires admin privileges or SeSecurityPrivilege.
    Gracefully handles PermissionError (base class catches it).
    """

    name = "windows_security"
    module = EventCategory.SECURITY

    # Windows Event ID → (human title, Severity)
    # Only events in this map are collected — all others are skipped.
    EVENT_MAP: dict[int, tuple[str, Severity]] = {
        4624: ("Successful Logon", Severity.INFO),
        4625: ("Failed Logon Attempt", Severity.MEDIUM),
        4634: ("Logoff", Severity.INFO),
        4647: ("User Initiated Logoff", Severity.INFO),
        4648: ("Logon with Explicit Credentials", Severity.MEDIUM),
        4672: ("Special Privileges Assigned to Logon", Severity.MEDIUM),
        4698: ("Scheduled Task Created", Severity.HIGH),
        4699: ("Scheduled Task Deleted", Severity.MEDIUM),
        4702: ("Scheduled Task Updated", Severity.MEDIUM),
        4720: ("User Account Created", Severity.MEDIUM),
        4722: ("User Account Enabled", Severity.LOW),
        4724: ("Password Reset Attempted", Severity.MEDIUM),
        4725: ("User Account Disabled", Severity.LOW),
        4728: ("User Added to Global Security Group", Severity.HIGH),
        4732: ("User Added to Local Administrators Group", Severity.CRITICAL),
        4740: ("Account Locked Out", Severity.HIGH),
        4756: ("User Added to Universal Security Group", Severity.HIGH),
        4767: ("Account Unlocked", Severity.LOW),
        4776: ("Domain Credential Validation", Severity.INFO),
        1102: ("Audit Log Cleared", Severity.CRITICAL),
    }

    # Track whether we've already warned about missing privileges so we
    # don't flood the log on every scheduler tick.
    _privilege_warned: bool = False

    async def _collect(self) -> list[EventModel]:
        if sys.platform != "win32":
            logger.debug("security_collector_skip_non_windows")
            return []

        # ── Privilege pre-check ───────────────────────────────────────────────
        # win32evtlog.OpenEventLog raises pywintypes.error(1314, …) when the
        # process lacks SeSecurityPrivilege / admin rights. We detect this up
        # front so we can emit one clean message instead of a raw traceback.
        if not self._has_security_log_access():
            if not SecurityCollector._privilege_warned:
                SecurityCollector._privilege_warned = True
                self._logger.warning(
                    "security_collector_no_privilege",
                    hint=(
                        "Run SystemGuardian as Administrator to enable "
                        "Windows Security Event Log collection."
                    ),
                )
            return []

        events: list[EventModel] = []
        try:
            hand = win32evtlog.OpenEventLog(None, "Security")
        except Exception as exc:  # noqa: BLE001
            # Catch any residual open error (e.g. race after privilege check)
            err_code = getattr(exc, "winerror", None) or getattr(exc, "args", [None])[0]
            if err_code == 1314:  # ERROR_PRIVILEGE_NOT_HELD
                if not SecurityCollector._privilege_warned:
                    SecurityCollector._privilege_warned = True
                    self._logger.warning(
                        "security_collector_no_privilege",
                        hint=(
                            "Run SystemGuardian as Administrator to enable "
                            "Windows Security Event Log collection."
                        ),
                    )
                return []
            raise  # Re-raise unexpected errors so base class can log them

        try:
            flags = win32evtlog.EVENTLOG_BACKWARDS_READ | win32evtlog.EVENTLOG_SEQUENTIAL_READ

            while True:
                batch = win32evtlog.ReadEventLog(hand, flags, 0)
                if not batch:
                    break
                for ev in batch:
                    # Collect only the last N minutes of events
                    if self._is_old_event(ev):
                        return events

                    event_id = int(ev.EventID) & 0xFFFF
                    if event_id in self.EVENT_MAP:
                        title, severity = self.EVENT_MAP[event_id]
                        raw = self._win32_event_to_dict(ev)
                        model = self.normalize_windows_event(
                            raw=raw,
                            category=EventCategory.SECURITY,
                            title=title,
                            severity=severity,
                            source="windows_security_log",
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
        return self._has_security_log_access()

    # ── Private helpers ──────────────────────────────────────────────────────

    def _has_security_log_access(self) -> bool:
        """Return True if this process can open the Windows Security Event Log.

        Does a cheap probe open/close — much lighter than a full privilege
        token inspection and works without ctypes or extra imports.
        """
        try:
            hand = win32evtlog.OpenEventLog(None, "Security")
            win32evtlog.CloseEventLog(hand)
            return True
        except Exception as exc:  # noqa: BLE001
            err_code = getattr(exc, "winerror", None) or getattr(exc, "args", [None])[0]
            if err_code == 1314:  # ERROR_PRIVILEGE_NOT_HELD
                return False
            # Unexpected error — let it surface as True so _collect() raises it
            return True

    def _win32_event_to_dict(self, ev: Any) -> dict[str, Any]:  # noqa: ANN401
        """Convert a win32evtlog record to a JSON-serialisable dict."""
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
        """Parse win32 SYSTEMTIME into an aware UTC datetime."""
        try:
            # pywintypes.Time is a COM date type
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
        """True if event is older than EVENT_POLL_INTERVAL_SECONDS."""
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
            now = datetime.now(UTC)
            age_seconds = (now - event_time).total_seconds()
            return age_seconds > self._settings.EVENT_POLL_INTERVAL_SECONDS
        except Exception:  # noqa: BLE001
            return True

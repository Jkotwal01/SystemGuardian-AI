"""
Security Engine — real-time threat detection subscriber.

Subscribes to Events.EVENT_PROCESSED and Events.INCIDENT_CREATED on the EventBus.
Detects threat patterns:
  - Brute-force: N failed logins in a short window
  - Admin escalation: user added to Administrators group
  - Audit log cleared: potential cover-up
  - Scheduled task persistence: new scheduled task

When a threat is detected, publishes Events.THREAT_DETECTED.
"""

from __future__ import annotations

import structlog
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.core.event_bus import EventBus
from app.domain.enums import EventCategory, Severity
from app.models.event import EventModel
from app.processors.pipeline import Events
from app.repositories.event_repository import EventRepository

logger = structlog.get_logger()


# ── Threat Definitions ────────────────────────────────────────────────────────

BRUTE_FORCE_THRESHOLD = 5          # failed logins within window
BRUTE_FORCE_WINDOW_MINUTES = 10

# Windows Security event IDs that are always immediate threats
IMMEDIATE_THREAT_EVENT_IDS = {
    "1102",  # Audit log cleared
    "4732",  # Added to Administrators group
    "4698",  # Scheduled task created
    "4719",  # System audit policy changed
}


# ── Threat payload ────────────────────────────────────────────────────────────

class ThreatDetected:
    """Payload published on Events.THREAT_DETECTED."""

    def __init__(
        self,
        threat_type: str,
        severity: Severity,
        trigger_event: EventModel,
        description: str,
    ) -> None:
        self.threat_type = threat_type
        self.severity = severity
        self.trigger_event = trigger_event
        self.description = description


# ── Security Engine ───────────────────────────────────────────────────────────

class SecurityEngine:
    """
    Async subscriber to the EventBus.
    Analyses each incoming event for security threat patterns.
    """

    def __init__(
        self,
        event_bus: EventBus,
        session_factory: async_sessionmaker[AsyncSession],
    ) -> None:
        self._bus = event_bus
        self._session_factory = session_factory

        # Register as subscriber
        event_bus.subscribe(Events.EVENT_PROCESSED, self.on_event_processed)

    async def on_event_processed(self, event: EventModel) -> None:
        """Called for every processed event. Detects threats in O(1) or O(small query)."""
        if event.category != EventCategory.SECURITY:
            return

        threats: list[ThreatDetected] = []

        # Pattern 1: Immediate threat by Event ID
        if event.source_id in IMMEDIATE_THREAT_EVENT_IDS:
            threat_descriptions = {
                "1102": "Audit log was cleared — possible evidence tampering",
                "4732": "A user was added to the Administrators group",
                "4698": "A new scheduled task was created — possible persistence",
                "4719": "System audit policy was changed",
            }
            threats.append(ThreatDetected(
                threat_type="immediate_threat",
                severity=event.severity,
                trigger_event=event,
                description=threat_descriptions.get(event.source_id or "", "Suspicious activity"),
            ))

        # Pattern 2: Brute-force detection (failed logins)
        if event.source_id == "4625":  # Failed login
            brute_force = await self._check_brute_force(event)
            if brute_force:
                threats.append(brute_force)

        for threat in threats:
            logger.warning(
                "security.threat_detected",
                threat_type=threat.threat_type,
                severity=threat.severity,
                event_id=event.id,
                description=threat.description,
            )
            await self._bus.publish(Events.THREAT_DETECTED, threat)

    async def _check_brute_force(self, event: EventModel) -> ThreatDetected | None:
        """
        Query recent failed logins. If count >= threshold → brute force threat.
        """
        async with self._session_factory() as session:
            repo = EventRepository(session)
            recent = await repo.get_since_minutes(minutes=BRUTE_FORCE_WINDOW_MINUTES)
            failed_logins = [
                e for e in recent
                if e.source_id == "4625" and e.category == EventCategory.SECURITY
            ]

            if len(failed_logins) >= BRUTE_FORCE_THRESHOLD:
                return ThreatDetected(
                    threat_type="brute_force",
                    severity=Severity.HIGH,
                    trigger_event=event,
                    description=(
                        f"Brute-force detected: {len(failed_logins)} failed login attempts "
                        f"in the last {BRUTE_FORCE_WINDOW_MINUTES} minutes."
                    ),
                )
        return None

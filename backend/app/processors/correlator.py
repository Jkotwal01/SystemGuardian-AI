"""
Event Correlator — groups related events into Incidents.

Design:
  - Pluggable CorrelationRule strategy — each rule defines what "related" means
  - EventCorrelator applies all rules to find related events within a time window
  - When enough related events exist, it builds or updates an IncidentModel

Correlation window: 15 minutes (configurable)
Minimum events to form an incident: 2
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from datetime import timedelta, timezone
from datetime import datetime as dt

import structlog

from app.domain.enums import IncidentStatus
from app.models.event import EventModel
from app.models.incident import IncidentModel

logger = structlog.get_logger()


# ── Correlation Rules ─────────────────────────────────────────────────────────

class CorrelationRule(ABC):
    """
    One correlation rule. Returns True if `event` and `candidate` are related.
    Each rule is independently testable.
    """

    @abstractmethod
    def matches(self, event: EventModel, candidate: EventModel) -> bool: ...


class SameSourceIdRule(CorrelationRule):
    """Events with identical source_id (same Windows Event ID) are related."""

    def matches(self, event: EventModel, candidate: EventModel) -> bool:
        return (
            event.source_id is not None
            and event.source_id == candidate.source_id
            and candidate.id != event.id
        )


class SameCategoryHighSeverityRule(CorrelationRule):
    """
    Two HIGH/CRITICAL events in the same category within the window
    indicate a potential incident.
    """

    from app.domain.enums import Severity

    HIGH_SEVERITIES = {Severity.HIGH, Severity.CRITICAL}

    def matches(self, event: EventModel, candidate: EventModel) -> bool:
        from app.domain.enums import Severity

        return (
            event.category == candidate.category
            and event.severity in {Severity.HIGH, Severity.CRITICAL}
            and candidate.severity in {Severity.HIGH, Severity.CRITICAL}
            and candidate.id != event.id
        )


class SameUserRule(CorrelationRule):
    """
    Events sharing the same user_name in their normalized_data are related
    (e.g. brute-force pattern from the same account).
    """

    def matches(self, event: EventModel, candidate: EventModel) -> bool:
        user = event.normalized_data.get("user_name")
        cand_user = candidate.normalized_data.get("user_name")
        return bool(
            user
            and user == cand_user
            and event.category == candidate.category
            and candidate.id != event.id
        )


class SameProcessRule(CorrelationRule):
    """Events tied to the same process_name are related."""

    def matches(self, event: EventModel, candidate: EventModel) -> bool:
        proc = event.normalized_data.get("process_name")
        cand_proc = candidate.normalized_data.get("process_name")
        return bool(
            proc
            and proc == cand_proc
            and candidate.id != event.id
        )


# ── Incident Builder ──────────────────────────────────────────────────────────

def _build_incident_title(event: EventModel, related_count: int) -> str:
    category = event.category.value.capitalize()
    return f"{category} Incident: {event.title} (+{related_count} related)"


def _build_incident_description(event: EventModel, related: list[EventModel]) -> str:
    sources = ", ".join({e.source_id or e.source for e in related[:5]})
    return (
        f"Auto-detected incident from {len(related)} related {event.category.value} events. "
        f"Triggering event: {event.title}. Related event IDs: {sources}."
    )


# ── Event Correlator ──────────────────────────────────────────────────────────

class EventCorrelator:
    """
    Groups related events into Incidents using configurable CorrelationRules.

    Algorithm:
      1. Fetch all events within the last WINDOW_MINUTES from the repository.
      2. Filter to candidates that match at least one rule against `event`.
      3. If ≥ MIN_EVENTS_FOR_INCIDENT candidates found, build an Incident.
      4. Return the new Incident, or None if no correlation found.
    """

    WINDOW_MINUTES: int = 15
    MIN_EVENTS_FOR_INCIDENT: int = 2

    def __init__(self, rules: list[CorrelationRule] | None = None) -> None:
        self._rules: list[CorrelationRule] = rules or [
            SameSourceIdRule(),
            SameCategoryHighSeverityRule(),
            SameUserRule(),
            SameProcessRule(),
        ]

    def _is_related(self, event: EventModel, candidate: EventModel) -> bool:
        """Return True if any rule considers these events related."""
        return any(rule.matches(event, candidate) for rule in self._rules)

    async def correlate(
        self,
        event: EventModel,
        recent_events: list[EventModel],
    ) -> IncidentModel | None:
        """
        Given the new event and a pre-fetched list of recent events,
        attempt to create a correlated Incident.

        `recent_events` should cover at least the last WINDOW_MINUTES.
        """
        cutoff = dt.now(tz=timezone.utc) - timedelta(minutes=self.WINDOW_MINUTES)

        candidates = [
            e for e in recent_events
            if e.occurred_at.replace(tzinfo=timezone.utc) >= cutoff
            and e.id != event.id
        ]

        related = [c for c in candidates if self._is_related(event, c)]

        if len(related) < self.MIN_EVENTS_FOR_INCIDENT:
            return None

        # Use the highest severity among all related events + the trigger event
        all_events = [event, *related]
        from app.processors.severity import SEVERITY_ORDER
        max_severity = max(all_events, key=lambda e: SEVERITY_ORDER[e.severity]).severity

        incident = IncidentModel(
            title=_build_incident_title(event, len(related)),
            description=_build_incident_description(event, related),
            severity=max_severity,
            status=IncidentStatus.OPEN,
            metadata_={
                "trigger_event_id": event.id,
                "related_event_ids": [e.id for e in related],
                "correlation_window_minutes": self.WINDOW_MINUTES,
            },
        )

        logger.info(
            "incident.created",
            trigger_event=event.id,
            related_count=len(related),
            severity=max_severity,
        )
        return incident

"""
Severity Classification — Strategy Pattern

Three interchangeable strategies:
  1. WindowsEventIdSeverityStrategy — maps known Windows Event IDs
  2. CategoryBaseSeverityStrategy   — uses the event's existing severity as base
  3. FrequencyEscalationStrategy    — escalates when the same event repeats quickly

CompositeSeverityClassifier runs all strategies and returns the highest severity.
"""

from __future__ import annotations

import asyncio
from abc import ABC, abstractmethod
from datetime import UTC, datetime, timedelta

import structlog

from app.domain.enums import EventCategory, Severity
from app.models.event import EventModel

logger = structlog.get_logger()

# Ordered list for comparison (index = rank, lower index = less severe)
SEVERITY_ORDER: dict[Severity, int] = {
    Severity.INFO: 0,
    Severity.LOW: 1,
    Severity.MEDIUM: 2,
    Severity.HIGH: 3,
    Severity.CRITICAL: 4,
}


def escalate_severity(base: Severity, steps: int = 1) -> Severity:
    """Escalate severity by `steps` levels (capped at CRITICAL)."""
    levels = list(SEVERITY_ORDER.keys())
    current_idx = SEVERITY_ORDER[base]
    new_idx = min(current_idx + steps, len(levels) - 1)
    return levels[new_idx]


# ── Base Strategy ─────────────────────────────────────────────────────────────

class SeverityStrategy(ABC):
    """Abstract base for all severity classification strategies."""

    @abstractmethod
    async def classify(self, event: EventModel) -> Severity:
        """Return the severity for the given event."""
        ...


# ── Strategy 1: Windows Event ID Map ─────────────────────────────────────────

class WindowsEventIdSeverityStrategy(SeverityStrategy):
    """
    Maps well-known Windows Security/System Event IDs to severity levels.
    Falls back to the event's existing severity when ID is not in the map.
    """

    EVENT_SEVERITY_MAP: dict[str, Severity] = {
        # ── Security ──────────────────────────────────────────────────────────
        "1102": Severity.CRITICAL,   # Audit log cleared — potential cover-up
        "4719": Severity.CRITICAL,   # System audit policy changed
        "4732": Severity.CRITICAL,   # Added to Administrators group
        "4698": Severity.HIGH,       # Scheduled task created (persistence)
        "4720": Severity.HIGH,       # User account created
        "4728": Severity.HIGH,       # User added to security group
        "4740": Severity.HIGH,       # Account locked out
        "4756": Severity.HIGH,       # Added to Universal group
        "4648": Severity.MEDIUM,     # Explicit credential login
        "4672": Severity.MEDIUM,     # Admin privileges assigned
        "4699": Severity.MEDIUM,     # Scheduled task deleted
        "4724": Severity.MEDIUM,     # Password reset attempt
        "4625": Severity.MEDIUM,     # Failed login
        "4722": Severity.LOW,        # Account enabled
        "4767": Severity.LOW,        # Account unlocked
        "4624": Severity.INFO,       # Successful login
        "4634": Severity.INFO,       # Logoff
        # ── System / Stability ────────────────────────────────────────────────
        "41":   Severity.CRITICAL,   # Unexpected reboot (Kernel-Power)
        "1001": Severity.HIGH,       # Windows Error Reporting (BSOD)
        "6008": Severity.HIGH,       # Unexpected shutdown
        "7045": Severity.HIGH,       # New service installed
        "7034": Severity.HIGH,       # Service crashed
        "7031": Severity.HIGH,       # Service terminated unexpectedly
        "7023": Severity.MEDIUM,     # Service terminated with error
        "7000": Severity.MEDIUM,     # Service failed to start
    }

    async def classify(self, event: EventModel) -> Severity:
        if event.source_id and event.source_id in self.EVENT_SEVERITY_MAP:
            return self.EVENT_SEVERITY_MAP[event.source_id]
        return event.severity  # preserve existing severity as default


# ── Strategy 2: Category Base Severity ───────────────────────────────────────

class CategoryBaseSeverityStrategy(SeverityStrategy):
    """
    Returns a minimum severity floor based on event category.
    E.g. any SECURITY event should be at least LOW.
    """

    CATEGORY_FLOOR: dict[EventCategory, Severity] = {
        EventCategory.SECURITY: Severity.LOW,
        EventCategory.HARDWARE: Severity.LOW,
        EventCategory.STABILITY: Severity.MEDIUM,
        EventCategory.DRIVER: Severity.LOW,
        EventCategory.PERFORMANCE: Severity.INFO,
        EventCategory.NETWORK: Severity.INFO,
        EventCategory.APPLICATION: Severity.INFO,
        EventCategory.STORAGE: Severity.INFO,
        EventCategory.POWER: Severity.INFO,
        EventCategory.INFORMATIONAL: Severity.INFO,
    }

    async def classify(self, event: EventModel) -> Severity:
        floor = self.CATEGORY_FLOOR.get(event.category, Severity.INFO)
        # Return the higher of floor vs existing severity
        if SEVERITY_ORDER[event.severity] < SEVERITY_ORDER[floor]:
            return floor
        return event.severity


# ── Strategy 3: Frequency Escalation ─────────────────────────────────────────

class FrequencyEscalationStrategy(SeverityStrategy):
    """
    Escalates severity when the same source_id event fires repeatedly
    within a short window:
      ≥ 10 occurrences in 10 min  →  escalate 2 levels
      ≥  5 occurrences in 10 min  →  escalate 1 level
    """

    WINDOW_MINUTES: int = 10
    HIGH_THRESHOLD: int = 10
    MED_THRESHOLD: int = 5

    def __init__(self, recent_events: list[EventModel] | None = None) -> None:
        # Injected list of recent events (avoids DB call inside strategy)
        self._recent_events: list[EventModel] = recent_events or []

    async def classify(self, event: EventModel) -> Severity:
        cutoff = datetime.now(tz=UTC) - timedelta(minutes=self.WINDOW_MINUTES)

        # Count events with same source_id within the window
        count = sum(
            1
            for e in self._recent_events
            if (
                e.source_id == event.source_id
                and e.source_id is not None
                and e.occurred_at.replace(tzinfo=UTC) >= cutoff
            )
        )

        if count >= self.HIGH_THRESHOLD:
            return escalate_severity(event.severity, steps=2)
        if count >= self.MED_THRESHOLD:
            return escalate_severity(event.severity, steps=1)
        return event.severity


# ── Composite Classifier ──────────────────────────────────────────────────────

class CompositeSeverityClassifier:
    """
    Runs all severity strategies concurrently and returns the highest severity.
    Adding a new strategy = instantiate it and add to `strategies` list.
    """

    def __init__(self, recent_events: list[EventModel] | None = None) -> None:
        self.strategies: list[SeverityStrategy] = [
            WindowsEventIdSeverityStrategy(),
            CategoryBaseSeverityStrategy(),
            FrequencyEscalationStrategy(recent_events=recent_events),
        ]

    async def classify(self, event: EventModel) -> Severity:
        results = await asyncio.gather(*[s.classify(event) for s in self.strategies])
        best = max(results, key=lambda s: SEVERITY_ORDER[s])
        if best != event.severity:
            logger.debug(
                "severity.reclassified",
                event_id=event.id,
                old=event.severity,
                new=best,
            )
        return best

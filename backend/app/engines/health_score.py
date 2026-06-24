"""
Health Score Engine — computes weighted system health scores.

Scoring model:
  - security    30%   (critical/failed-login events)
  - performance 25%   (CPU, RAM, app crashes)
  - hardware    20%   (hardware warnings)
  - network     15%   (network errors)
  - storage     10%   (disk usage)

Each sub-score starts at 100 and deducts for bad indicators.
Overall score = weighted sum of sub-scores (0–100).

Observer: subscribes to Events.EVENT_PROCESSED on the EventBus.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone

import structlog
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.enums import EventCategory, Severity
from app.models.health_score import HealthScoreModel
from app.repositories.event_repository import EventRepository
from app.repositories.health_score_repository import HealthScoreRepository

logger = structlog.get_logger()


# ── Score Factors ─────────────────────────────────────────────────────────────

@dataclass
class ScoreFactors:
    """
    Gathered metrics used as input to all sub-score computations.
    Each field maps directly to a measurable data point from the repositories.
    """
    critical_events_24h: int = 0
    high_events_24h: int = 0
    failed_logins_24h: int = 0
    security_events_24h: int = 0
    avg_cpu_pct: float = 0.0
    avg_ram_pct: float = 0.0
    app_crashes_24h: int = 0
    hardware_warnings_24h: int = 0
    network_errors_1h: int = 0
    storage_events_24h: int = 0
    # Future: disk_usage_pct: float = 0.0


# ── Engine ────────────────────────────────────────────────────────────────────

class HealthScoreEngine:
    """
    Computes health scores from stored events & metrics.
    Each sub-score is independently calculated and independently testable.

    Typical usage via EventBus (subscriber):
        bus.subscribe(Events.EVENT_PROCESSED, engine.on_event_processed)

    Or triggered directly by the scheduler every 5 minutes.
    """

    WEIGHTS: dict[str, float] = {
        "security": 0.30,
        "performance": 0.25,
        "hardware": 0.20,
        "network": 0.15,
        "storage": 0.10,
    }

    # ── Sub-score computations (pure functions, fully testable) ────────────────

    def compute_security_score(self, factors: ScoreFactors) -> int:
        """
        Deducts for:
          - Critical security events (15 pts each, max -45)
          - High severity events (8 pts each, max -25)
          - Failed logins (3 pts each, max -20)
          - Total security events (1 pt each, max -15)
        """
        score = 100
        score -= min(factors.critical_events_24h * 15, 45)
        score -= min(factors.high_events_24h * 8, 25)
        score -= min(factors.failed_logins_24h * 3, 20)
        score -= min(factors.security_events_24h * 1, 15)
        return max(0, score)

    def compute_performance_score(self, factors: ScoreFactors) -> int:
        """
        Deducts for high CPU/RAM usage and application crashes.
        """
        score = 100
        if factors.avg_cpu_pct > 90:
            score -= 30
        elif factors.avg_cpu_pct > 70:
            score -= 15
        elif factors.avg_cpu_pct > 50:
            score -= 5

        if factors.avg_ram_pct > 90:
            score -= 25
        elif factors.avg_ram_pct > 80:
            score -= 10
        elif factors.avg_ram_pct > 70:
            score -= 3

        score -= min(factors.app_crashes_24h * 5, 20)
        return max(0, score)

    def compute_hardware_score(self, factors: ScoreFactors) -> int:
        """Deducts for hardware warnings (thermal, disk, fan events)."""
        score = 100
        score -= min(factors.hardware_warnings_24h * 10, 50)
        return max(0, score)

    def compute_network_score(self, factors: ScoreFactors) -> int:
        """Deducts for network-related errors in the past hour."""
        score = 100
        score -= min(factors.network_errors_1h * 5, 40)
        return max(0, score)

    def compute_storage_score(self, factors: ScoreFactors) -> int:
        """Deducts for storage-related events."""
        score = 100
        score -= min(factors.storage_events_24h * 5, 40)
        return max(0, score)

    def compute_overall_score(self, sub_scores: dict[str, int]) -> int:
        """Weighted average of all sub-scores, rounded to nearest integer."""
        return int(sum(sub_scores[k] * w for k, w in self.WEIGHTS.items()))

    # ── Data Gathering ─────────────────────────────────────────────────────────

    async def _gather_factors(self, session: AsyncSession) -> ScoreFactors:
        """Pull all required metrics from the DB in parallel-ish queries."""
        repo = EventRepository(session)
        now = datetime.now(tz=timezone.utc)
        cutoff_24h = now - timedelta(hours=24)
        cutoff_1h = now - timedelta(hours=1)

        severity_counts = await repo.count_by_severity_today()
        category_counts = await repo.count_by_category_today()

        # Security events with failed login (source_id = "4625")
        security_events = await repo.get_by_category(EventCategory.SECURITY, hours=24)
        failed_logins = sum(1 for e in security_events if e.source_id == "4625")

        network_errors = await repo.count_since(cutoff_1h, category=EventCategory.NETWORK)

        return ScoreFactors(
            critical_events_24h=severity_counts.get(Severity.CRITICAL, 0),
            high_events_24h=severity_counts.get(Severity.HIGH, 0),
            failed_logins_24h=failed_logins,
            security_events_24h=category_counts.get(EventCategory.SECURITY, 0),
            avg_cpu_pct=0.0,    # Phase 5: populated from HardwareMetricModel
            avg_ram_pct=0.0,
            app_crashes_24h=category_counts.get(EventCategory.APPLICATION, 0),
            hardware_warnings_24h=category_counts.get(EventCategory.HARDWARE, 0),
            network_errors_1h=network_errors,
            storage_events_24h=category_counts.get(EventCategory.STORAGE, 0),
        )

    # ── Main calculation ───────────────────────────────────────────────────────

    async def calculate_and_store(self, session: AsyncSession) -> HealthScoreModel:
        """
        Gather live factors → compute all sub-scores → persist HealthScoreModel
        → publish HEALTH_SCORE_UPDATED event.
        """
        factors = await self._gather_factors(session)

        sub_scores = {
            "security": self.compute_security_score(factors),
            "performance": self.compute_performance_score(factors),
            "hardware": self.compute_hardware_score(factors),
            "network": self.compute_network_score(factors),
            "storage": self.compute_storage_score(factors),
        }
        overall = self.compute_overall_score(sub_scores)

        record = HealthScoreModel(
            overall_score=float(overall),
            component_scores=sub_scores,
        )
        await HealthScoreRepository(session).save(record)

        logger.info(
            "health_score.calculated",
            overall=overall,
            **sub_scores,
        )
        return record

    # ── EventBus subscriber ────────────────────────────────────────────────────

    async def on_event_processed(self, _payload: object) -> None:
        """
        Lightweight subscriber — called on every processed event.
        Does NOT recalculate score on every event (expensive); instead the
        scheduler triggers calculate_and_store() every 5 minutes.
        This hook is reserved for future real-time micro-adjustments.
        """
        pass

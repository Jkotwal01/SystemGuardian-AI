"""
Event Processing Pipeline — orchestrates all processing steps.

Flow per event:
  1. Classify severity   (may escalate based on frequency/event ID)
  2. Enrich with context (hostname, OS metadata)
  3. Persist event
  4. Correlate → may produce an Incident
  5. Publish to EventBus → health engine + security engine react
  6. [async, non-blocking] AI explanation for HIGH/CRITICAL events
"""

from __future__ import annotations

import asyncio
from typing import TYPE_CHECKING

import structlog
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.event_bus import EventBus
from app.domain.enums import Severity
from app.models.event import EventModel
from app.models.incident import IncidentModel
from app.processors.correlator import EventCorrelator
from app.processors.enricher import EventEnricher
from app.processors.severity import CompositeSeverityClassifier
from app.repositories.event_repository import EventRepository
from app.repositories.incident_repository import IncidentRepository

if TYPE_CHECKING:
    from app.ai.explanation_engine import ExplanationEngine

logger = structlog.get_logger()

_AI_SEVERITIES = {Severity.HIGH, Severity.CRITICAL}


# ── Event type constants ───────────────────────────────────────────────────────


class Events:
    """Bus topic constants. Import these everywhere — no raw strings."""

    EVENT_PROCESSED = "event.processed"
    INCIDENT_CREATED = "incident.created"
    INCIDENT_UPDATED = "incident.updated"
    HEALTH_SCORE_UPDATED = "health.score.updated"
    THREAT_DETECTED = "security.threat.detected"
    PREDICTION_GENERATED = "prediction.generated"
    NOTIFICATION_READY = "notification.ready"


# ── Pipeline ──────────────────────────────────────────────────────────────────


class EventProcessingPipeline:
    """
    Stateless orchestrator for the complete event processing flow.
    Each step is independently testable and replaceable.

    Usage:
        pipeline = EventProcessingPipeline(classifier, enricher, correlator, bus)
        processed = await pipeline.process(event, session)
    """

    def __init__(
        self,
        classifier: CompositeSeverityClassifier,
        enricher: EventEnricher,
        correlator: EventCorrelator,
        event_bus: EventBus,
        explanation_engine: ExplanationEngine | None = None,
    ) -> None:
        self._classifier = classifier
        self._enricher = enricher
        self._correlator = correlator
        self._bus = event_bus
        self._explanation_engine = explanation_engine

    async def process(
        self,
        event: EventModel,
        session: AsyncSession,
    ) -> EventModel:
        """
        Process a single event end-to-end.

        Steps:
          1. Load recent events for frequency analysis (once, reused)
          2. Classify severity
          3. Enrich with system context
          4. Persist event to DB
          5. Correlate with recent events → maybe create Incident
          6. Publish bus events to wake up subscribers

        Returns the fully processed (and persisted) event.
        """
        event_repo = EventRepository(session)
        incident_repo = IncidentRepository(session)

        # Step 1: Pre-fetch recent events (used by both classifier + correlator)
        recent_events = await event_repo.get_since_minutes(minutes=15)

        # Step 2: Classify severity (may escalate based on frequency)
        # Rebuild classifier with fresh recent context

        classifier_with_context = CompositeSeverityClassifier(recent_events=recent_events)
        event.severity = await classifier_with_context.classify(event)

        # Step 3: Enrich with system context
        event = await self._enricher.enrich(event)

        # Step 4: Persist event
        await event_repo.save(event)

        logger.info(
            "pipeline.event_saved",
            event_id=event.id,
            category=event.category,
            severity=event.severity,
        )

        # Step 5: Correlate → may create an Incident
        incident: IncidentModel | None = await self._correlator.correlate(event, recent_events)
        if incident is not None:
            await incident_repo.save(incident)
            await self._bus.publish(Events.INCIDENT_CREATED, incident)

        # Step 6: Notify all subscribers that a new event was processed
        await self._bus.publish(Events.EVENT_PROCESSED, event)

        # Step 7: Fire AI explanation (non-blocking) for high-severity events
        if self._explanation_engine and event.severity in _AI_SEVERITIES:
            # Use create_task so AI latency never stalls the pipeline
            asyncio.create_task(
                self._explanation_engine.explain_event(event),
                name=f"ai_explain_{event.id[:8]}",
            )

        return event

    async def process_batch(
        self,
        events: list[EventModel],
        session: AsyncSession,
    ) -> list[EventModel]:
        """Process a list of events sequentially (preserves correlation ordering)."""
        processed = []
        for event in events:
            result = await self.process(event, session)
            processed.append(result)
        return processed


def create_default_pipeline(
    event_bus: EventBus,
    explanation_engine: ExplanationEngine | None = None,
) -> EventProcessingPipeline:
    """
    Factory function. Creates the production pipeline with default components.
    Used in main.py lifespan and scheduler.
    """
    return EventProcessingPipeline(
        classifier=CompositeSeverityClassifier(),
        enricher=EventEnricher(),
        correlator=EventCorrelator(),
        event_bus=event_bus,
        explanation_engine=explanation_engine,
    )

"""
Phase 3 Pipeline Tests — covers:
  - SeverityClassifier (all three strategies)
  - EventCorrelator (grouping, no-false-grouping)
  - HealthScoreEngine (pure computation methods)
  - EventProcessingPipeline (end-to-end with mocks)
  - EventBus delivery
"""

from __future__ import annotations

import asyncio
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, MagicMock

import pytest

from app.domain.enums import EventCategory, IncidentStatus, Severity
from app.engines.health_score import HealthScoreEngine, ScoreFactors
from app.models.event import EventModel, uuid4_hex
from app.models.incident import IncidentModel
from app.processors.correlator import (
    EventCorrelator,
    SameCategoryHighSeverityRule,
    SameSourceIdRule,
    SameUserRule,
)
from app.processors.enricher import EventEnricher
from app.processors.pipeline import EventProcessingPipeline, Events
from app.processors.severity import (
    SEVERITY_ORDER,
    CompositeSeverityClassifier,
    FrequencyEscalationStrategy,
    WindowsEventIdSeverityStrategy,
    escalate_severity,
)
from app.core.event_bus import EventBus


# ── Helpers ───────────────────────────────────────────────────────────────────

def make_event(
    source_id: str | None = None,
    category: EventCategory = EventCategory.SECURITY,
    severity: Severity = Severity.INFO,
    title: str = "Test Event",
    normalized_data: dict | None = None,
    minutes_ago: int = 0,
) -> EventModel:
    """Factory for test EventModel instances."""
    occurred = datetime.now(tz=timezone.utc) - timedelta(minutes=minutes_ago)
    # Strip tz for DB-compatible datetime (SQLAlchemy stores naive UTC)
    occurred_naive = occurred.replace(tzinfo=None)
    return EventModel(
        id=uuid4_hex(),
        source="test",
        source_id=source_id,
        category=category,
        severity=severity,
        title=title,
        raw_data={},
        normalized_data=normalized_data or {},
        occurred_at=occurred_naive,
        metadata_={},
    )


# ═══════════════════════════════════════════════════════════════════════════════
# SEVERITY CLASSIFIER TESTS
# ═══════════════════════════════════════════════════════════════════════════════

class TestEscalateSeverity:
    def test_escalate_info_by_one(self) -> None:
        assert escalate_severity(Severity.INFO, steps=1) == Severity.LOW

    def test_escalate_medium_by_two(self) -> None:
        assert escalate_severity(Severity.MEDIUM, steps=2) == Severity.CRITICAL

    def test_escalate_critical_stays_critical(self) -> None:
        assert escalate_severity(Severity.CRITICAL, steps=5) == Severity.CRITICAL

    def test_escalate_by_zero(self) -> None:
        assert escalate_severity(Severity.LOW, steps=0) == Severity.LOW


class TestWindowsEventIdSeverityStrategy:
    @pytest.mark.asyncio
    async def test_known_critical_event_id(self) -> None:
        strategy = WindowsEventIdSeverityStrategy()
        event = make_event(source_id="1102")  # Audit log cleared
        result = await strategy.classify(event)
        assert result == Severity.CRITICAL

    @pytest.mark.asyncio
    async def test_known_medium_event_id(self) -> None:
        strategy = WindowsEventIdSeverityStrategy()
        event = make_event(source_id="4625")  # Failed login
        result = await strategy.classify(event)
        assert result == Severity.MEDIUM

    @pytest.mark.asyncio
    async def test_unknown_event_id_preserves_existing(self) -> None:
        strategy = WindowsEventIdSeverityStrategy()
        event = make_event(source_id="9999", severity=Severity.HIGH)
        result = await strategy.classify(event)
        assert result == Severity.HIGH

    @pytest.mark.asyncio
    async def test_none_source_id_preserves_existing(self) -> None:
        strategy = WindowsEventIdSeverityStrategy()
        event = make_event(source_id=None, severity=Severity.LOW)
        result = await strategy.classify(event)
        assert result == Severity.LOW


class TestFrequencyEscalationStrategy:
    @pytest.mark.asyncio
    async def test_five_same_events_escalate_once(self) -> None:
        strategy = FrequencyEscalationStrategy(recent_events=[
            make_event(source_id="4625", severity=Severity.MEDIUM)
            for _ in range(5)
        ])
        event = make_event(source_id="4625", severity=Severity.MEDIUM)
        result = await strategy.classify(event)
        assert SEVERITY_ORDER[result] > SEVERITY_ORDER[Severity.MEDIUM]

    @pytest.mark.asyncio
    async def test_ten_same_events_escalate_twice(self) -> None:
        strategy = FrequencyEscalationStrategy(recent_events=[
            make_event(source_id="4625", severity=Severity.MEDIUM)
            for _ in range(10)
        ])
        event = make_event(source_id="4625", severity=Severity.MEDIUM)
        result = await strategy.classify(event)
        # Escalated 2 steps from MEDIUM → CRITICAL
        assert result == Severity.CRITICAL

    @pytest.mark.asyncio
    async def test_few_events_no_escalation(self) -> None:
        strategy = FrequencyEscalationStrategy(recent_events=[
            make_event(source_id="4625")
            for _ in range(3)
        ])
        event = make_event(source_id="4625", severity=Severity.INFO)
        result = await strategy.classify(event)
        assert result == Severity.INFO

    @pytest.mark.asyncio
    async def test_old_events_outside_window_ignored(self) -> None:
        strategy = FrequencyEscalationStrategy(recent_events=[
            make_event(source_id="4625", minutes_ago=20)  # outside 10-min window
            for _ in range(10)
        ])
        event = make_event(source_id="4625", severity=Severity.LOW)
        result = await strategy.classify(event)
        assert result == Severity.LOW


class TestCompositeSeverityClassifier:
    @pytest.mark.asyncio
    async def test_takes_highest_severity(self) -> None:
        # Event ID 1102 → CRITICAL should win over INFO base
        classifier = CompositeSeverityClassifier()
        event = make_event(source_id="1102", severity=Severity.INFO)
        result = await classifier.classify(event)
        assert result == Severity.CRITICAL

    @pytest.mark.asyncio
    async def test_no_escalation_clean_system(self) -> None:
        classifier = CompositeSeverityClassifier()
        # Use INFORMATIONAL category — no severity floor applied
        event = make_event(
            source_id=None,
            severity=Severity.INFO,
            category=EventCategory.INFORMATIONAL,
        )
        result = await classifier.classify(event)
        assert result == Severity.INFO


# ═══════════════════════════════════════════════════════════════════════════════
# EVENT CORRELATOR TESTS
# ═══════════════════════════════════════════════════════════════════════════════

class TestSameSourceIdRule:
    def test_same_source_id_matches(self) -> None:
        rule = SameSourceIdRule()
        a = make_event(source_id="4625")
        b = make_event(source_id="4625")
        assert rule.matches(a, b) is True

    def test_different_source_id_no_match(self) -> None:
        rule = SameSourceIdRule()
        a = make_event(source_id="4625")
        b = make_event(source_id="4726")
        assert rule.matches(a, b) is False

    def test_none_source_id_no_match(self) -> None:
        rule = SameSourceIdRule()
        a = make_event(source_id=None)
        b = make_event(source_id=None)
        assert rule.matches(a, b) is False

    def test_same_event_id_no_self_match(self) -> None:
        rule = SameSourceIdRule()
        a = make_event(source_id="4625")
        a_same = a  # same object
        assert rule.matches(a, a_same) is False


class TestSameUserRule:
    def test_same_user_same_category_matches(self) -> None:
        rule = SameUserRule()
        a = make_event(normalized_data={"user_name": "alice"})
        b = make_event(normalized_data={"user_name": "alice"})
        assert rule.matches(a, b) is True

    def test_different_user_no_match(self) -> None:
        rule = SameUserRule()
        a = make_event(normalized_data={"user_name": "alice"})
        b = make_event(normalized_data={"user_name": "bob"})
        assert rule.matches(a, b) is False


class TestEventCorrelator:
    @pytest.mark.asyncio
    async def test_creates_incident_from_related_events(self) -> None:
        correlator = EventCorrelator()
        trigger = make_event(source_id="4625")
        recent = [make_event(source_id="4625") for _ in range(3)]
        incident = await correlator.correlate(trigger, recent)
        assert incident is not None
        assert isinstance(incident, IncidentModel)
        assert incident.status == IncidentStatus.OPEN

    @pytest.mark.asyncio
    async def test_no_incident_for_unrelated_events(self) -> None:
        correlator = EventCorrelator()
        trigger = make_event(source_id="4625")
        # Different source_id, different category, different user
        recent = [
            make_event(
                source_id="9999",
                category=EventCategory.HARDWARE,
                normalized_data={"user_name": "zzzz"},
            )
        ]
        incident = await correlator.correlate(trigger, recent)
        assert incident is None

    @pytest.mark.asyncio
    async def test_no_incident_below_threshold(self) -> None:
        correlator = EventCorrelator()
        trigger = make_event(source_id="4625")
        recent = [make_event(source_id="4625")]  # only 1 related (< MIN=2)
        incident = await correlator.correlate(trigger, recent)
        assert incident is None

    @pytest.mark.asyncio
    async def test_incident_inherits_highest_severity(self) -> None:
        correlator = EventCorrelator()
        trigger = make_event(source_id="4625", severity=Severity.MEDIUM)
        recent = [
            make_event(source_id="4625", severity=Severity.CRITICAL),
            make_event(source_id="4625", severity=Severity.LOW),
        ]
        incident = await correlator.correlate(trigger, recent)
        assert incident is not None
        assert incident.severity == Severity.CRITICAL

    @pytest.mark.asyncio
    async def test_old_events_outside_window_ignored(self) -> None:
        correlator = EventCorrelator()
        trigger = make_event(source_id="4625")
        # Old events — 20 minutes ago (outside 15-min window)
        recent = [make_event(source_id="4625", minutes_ago=20) for _ in range(5)]
        incident = await correlator.correlate(trigger, recent)
        assert incident is None


# ═══════════════════════════════════════════════════════════════════════════════
# HEALTH SCORE ENGINE TESTS (pure computation — no DB needed)
# ═══════════════════════════════════════════════════════════════════════════════

class TestHealthScoreEngine:
    def _engine(self) -> HealthScoreEngine:
        return HealthScoreEngine()

    def _clean_factors(self) -> ScoreFactors:
        """A perfect system with no issues."""
        return ScoreFactors()

    def test_perfect_system_scores_100(self) -> None:
        engine = self._engine()
        factors = self._clean_factors()
        assert engine.compute_security_score(factors) == 100
        assert engine.compute_performance_score(factors) == 100
        assert engine.compute_hardware_score(factors) == 100
        assert engine.compute_network_score(factors) == 100
        assert engine.compute_storage_score(factors) == 100

    def test_critical_event_deducts_from_security_score(self) -> None:
        engine = self._engine()
        factors = ScoreFactors(critical_events_24h=1)
        score = engine.compute_security_score(factors)
        assert score == 85  # 100 - 15

    def test_three_critical_events_deducts_correctly(self) -> None:
        engine = self._engine()
        factors = ScoreFactors(critical_events_24h=3)
        score = engine.compute_security_score(factors)
        assert score == 55  # 100 - 45 (capped)

    def test_security_score_never_negative(self) -> None:
        engine = self._engine()
        # Enough events to drive all three deduction caps simultaneously:
        # -45 (critical cap) + -25 (high cap) + -20 (failed login cap) + -15 (total cap) = -105 → clamped to 0
        factors = ScoreFactors(
            critical_events_24h=3,     # 3*15 = 45 (max cap)
            high_events_24h=4,         # 4*8  = 32 → capped at 25
            failed_logins_24h=7,       # 7*3  = 21 → capped at 20
            security_events_24h=15,    # 15*1 = 15 → capped at 15
        )
        assert engine.compute_security_score(factors) == 0

    def test_high_cpu_deducts_from_performance_score(self) -> None:
        engine = self._engine()
        factors = ScoreFactors(avg_cpu_pct=95.0)
        assert engine.compute_performance_score(factors) == 70  # 100 - 30

    def test_app_crashes_deduct_from_performance_score(self) -> None:
        engine = self._engine()
        factors = ScoreFactors(app_crashes_24h=2)
        assert engine.compute_performance_score(factors) == 90  # 100 - 10

    def test_overall_score_is_weighted_average(self) -> None:
        engine = self._engine()
        sub_scores = {
            "security": 100,
            "performance": 100,
            "hardware": 100,
            "network": 100,
            "storage": 100,
        }
        assert engine.compute_overall_score(sub_scores) == 100

    def test_overall_score_with_mixed_sub_scores(self) -> None:
        engine = self._engine()
        sub_scores = {
            "security": 0,    # 30% weight
            "performance": 100,
            "hardware": 100,
            "network": 100,
            "storage": 100,
        }
        # 0*0.3 + 100*0.25 + 100*0.20 + 100*0.15 + 100*0.10 = 70
        assert engine.compute_overall_score(sub_scores) == 70


# ═══════════════════════════════════════════════════════════════════════════════
# EVENT ENRICHER TESTS
# ═══════════════════════════════════════════════════════════════════════════════

class TestEventEnricher:
    @pytest.mark.asyncio
    async def test_adds_hostname_to_metadata(self) -> None:
        enricher = EventEnricher()
        event = make_event()
        result = await enricher.enrich(event)
        assert result.metadata_ is not None
        assert "hostname" in result.metadata_
        assert len(result.metadata_["hostname"]) > 0

    @pytest.mark.asyncio
    async def test_adds_os_version(self) -> None:
        enricher = EventEnricher()
        event = make_event()
        result = await enricher.enrich(event)
        assert "os_version" in result.metadata_

    @pytest.mark.asyncio
    async def test_preserves_existing_metadata(self) -> None:
        enricher = EventEnricher()
        event = make_event()
        event.metadata_ = {"existing_key": "existing_value"}
        result = await enricher.enrich(event)
        assert result.metadata_["existing_key"] == "existing_value"
        assert "hostname" in result.metadata_

    @pytest.mark.asyncio
    async def test_returns_same_event_object(self) -> None:
        enricher = EventEnricher()
        event = make_event()
        result = await enricher.enrich(event)
        assert result is event  # same object, mutated in-place


# ═══════════════════════════════════════════════════════════════════════════════
# EVENT BUS TESTS
# ═══════════════════════════════════════════════════════════════════════════════

class TestEventBus:
    @pytest.mark.asyncio
    async def test_delivers_payload_to_single_subscriber(self) -> None:
        bus = EventBus()
        received = []

        async def handler(payload: object) -> None:
            received.append(payload)

        bus.subscribe("test.topic", handler)
        await bus.publish("test.topic", "hello")
        assert received == ["hello"]

    @pytest.mark.asyncio
    async def test_delivers_to_multiple_subscribers(self) -> None:
        bus = EventBus()
        received_a: list[object] = []
        received_b: list[object] = []

        async def handler_a(payload: object) -> None:
            received_a.append(payload)

        async def handler_b(payload: object) -> None:
            received_b.append(payload)

        bus.subscribe("test.topic", handler_a)
        bus.subscribe("test.topic", handler_b)
        await bus.publish("test.topic", 42)
        assert received_a == [42]
        assert received_b == [42]

    @pytest.mark.asyncio
    async def test_no_delivery_to_wrong_topic(self) -> None:
        bus = EventBus()
        received: list[object] = []

        async def handler(payload: object) -> None:
            received.append(payload)

        bus.subscribe("topic.a", handler)
        await bus.publish("topic.b", "wrong")
        assert received == []

    @pytest.mark.asyncio
    async def test_failing_handler_does_not_crash_bus(self) -> None:
        bus = EventBus()

        async def bad_handler(payload: object) -> None:
            raise ValueError("handler error")

        good_received: list[object] = []

        async def good_handler(payload: object) -> None:
            good_received.append(payload)

        bus.subscribe("test.topic", bad_handler)
        bus.subscribe("test.topic", good_handler)
        # Should not raise
        await bus.publish("test.topic", "data")
        assert good_received == ["data"]

    @pytest.mark.asyncio
    async def test_pipeline_publishes_event_processed(self) -> None:
        """End-to-end: pipeline processes event and publishes to bus."""
        bus = EventBus()
        published_events: list[object] = []

        async def capture(payload: object) -> None:
            published_events.append(payload)

        bus.subscribe(Events.EVENT_PROCESSED, capture)

        # Mock the session and repos so we don't need a real DB
        mock_session = AsyncMock()
        mock_event_repo = AsyncMock()
        mock_event_repo.get_since_minutes.return_value = []
        mock_event_repo.save = AsyncMock()
        mock_incident_repo = AsyncMock()
        mock_incident_repo.save = AsyncMock()

        from app.processors.correlator import EventCorrelator
        from app.processors.enricher import EventEnricher
        from app.processors.severity import CompositeSeverityClassifier

        # Patch repository instantiation
        import app.processors.pipeline as pipeline_module
        original_event_repo = pipeline_module.EventRepository
        original_incident_repo = pipeline_module.IncidentRepository

        pipeline_module.EventRepository = MagicMock(return_value=mock_event_repo)
        pipeline_module.IncidentRepository = MagicMock(return_value=mock_incident_repo)

        try:
            pipeline = EventProcessingPipeline(
                classifier=CompositeSeverityClassifier(),
                enricher=EventEnricher(),
                correlator=EventCorrelator(),
                event_bus=bus,
            )

            event = make_event(source_id="4624", severity=Severity.INFO)
            await pipeline.process(event, mock_session)

            assert len(published_events) == 1
            assert published_events[0] is event
        finally:
            pipeline_module.EventRepository = original_event_repo
            pipeline_module.IncidentRepository = original_incident_repo

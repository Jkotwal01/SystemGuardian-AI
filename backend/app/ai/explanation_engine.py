"""
ExplanationEngine — generates and caches AI explanations for system events.

Design:
  - Non-blocking: always returns quickly; AI generation is fire-and-forget.
  - 24-hour cache: same Windows Event ID won't re-call the AI within 24 hours.
  - Graceful: all AI failures are handled by FallbackAIProvider — this engine
    never raises exceptions that would crash the caller.
  - Only HIGH and CRITICAL events are sent to AI (configurable).
"""

from __future__ import annotations

import json
from datetime import UTC, datetime

import structlog
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.ai.base import GenerateOptions
from app.ai.fallback_provider import FallbackAIProvider
from app.ai.prompts import PromptLibrary
from app.domain.enums import AIProvider, Severity
from app.models.ai_insight import AIInsightModel
from app.models.event import EventModel
from app.repositories.ai_insight_repository import AIInsightRepository

logger = structlog.get_logger()

# Only events at these severity levels trigger AI explanation
_AI_SEVERITY_THRESHOLD = {Severity.HIGH, Severity.CRITICAL}


class ExplanationEngine:
    """
    Generates AI explanations for system events and stores them in the DB.

    Usage:
        engine = ExplanationEngine(fallback_provider)
        await engine.explain_event(event, session)

    The result is stored in ai_insights and linked via EventModel.ai_insight.
    """

    def __init__(
        self,
        provider: FallbackAIProvider,
        session_factory: async_sessionmaker[AsyncSession],
    ) -> None:
        self._provider = provider
        self._session_factory = session_factory

    async def explain_event(
        self,
        event: EventModel,
    ) -> AIInsightModel | None:
        """
        Generate an AI explanation for a single event.

        Steps:
          1. Skip if event severity is below threshold (INFO/LOW/MEDIUM)
          2. Check 24-hour cache by source_id — return cached if found
          3. Build context string from event fields
          4. Call FallbackAIProvider.generate()
          5. Parse the JSON response
          6. Persist and return AIInsightModel

        Returns None if skipped (below threshold).
        Never raises — all errors are logged and swallowed.
        """
        # Step 1: Severity gate
        if event.severity not in _AI_SEVERITY_THRESHOLD:
            return None

        # We use a dedicated session because this runs in a background task
        async with self._session_factory() as session:
            repo = AIInsightRepository(session)

            # Step 2: 24-hour cache check
            if event.source_id:
                cached = await repo.get_cached_by_source_id(event.source_id, hours=24)
                if cached:
                    logger.debug(
                        "ai.explanation_cached",
                        event_id=event.id,
                        source_id=event.source_id,
                    )
                    # We found a recent explanation for this type of event!
                    # We must create a new row for THIS event_id, copying the text.
                    insight = AIInsightModel(
                        event_id=event.id,
                        provider=cached.provider,
                        model_name=cached.model_name,
                        summary=cached.summary,
                        explanation=cached.explanation,
                        recommendation=cached.recommendation,
                        generated_at=datetime.now(tz=UTC),
                    )
                    saved = await repo.save(insight)
                    await session.commit()
                    return saved

            # Step 3: Build prompt context
            context = self._build_context(event)

            # Step 4: Call AI provider
            try:
                response = await self._provider.generate(
                    system_prompt=PromptLibrary.EXPLAIN_EVENT,
                    user_message=context,
                    options=GenerateOptions(temperature=0.2, max_tokens=512),
                )
            except Exception as e:  # noqa: BLE001
                logger.error("ai.explanation_generate_failed", event_id=event.id, error=str(e))
                return None

            # Step 5: Parse JSON response
            summary, explanation, recommendation = self._parse_response(response.content)

            # Step 6: Persist
            try:
                # Map provider string to enum, defaulting to OLLAMA
                try:
                    provider_enum = AIProvider(response.provider)
                except ValueError:
                    provider_enum = AIProvider.OLLAMA

                insight = AIInsightModel(
                    event_id=event.id,
                    provider=provider_enum,
                    model_name=response.model,
                    summary=summary,
                    explanation=explanation,
                    recommendation=recommendation,
                    generated_at=datetime.now(tz=UTC),
                )
                saved = await repo.save(insight)
                await session.commit()

                logger.info(
                    "ai.explanation_saved",
                    event_id=event.id,
                    provider=response.provider,
                    latency_ms=round(response.latency_ms, 1),
                )
                return saved

            except Exception as e:  # noqa: BLE001
                logger.error("ai.explanation_save_failed", event_id=event.id, error=str(e))
                await session.rollback()
                return None

    def _build_context(self, event: EventModel) -> str:
        """
        Build the user-message portion of the prompt from the event's fields.
        Keeps the AI grounded in real data.
        """
        normalized = json.dumps(event.normalized_data, indent=2) if event.normalized_data else "{}"

        return (
            f"Event Title: {event.title}\n"
            f"Windows Event ID: {event.source_id or 'N/A'}\n"
            f"Category: {event.category}\n"
            f"Severity: {event.severity}\n"
            f"Source: {event.source}\n"
            f"Occurred At: {event.occurred_at.isoformat()}\n"
            f"Normalized Details:\n{normalized}"
        )

    @staticmethod
    def _parse_response(content: str) -> tuple[str, str, str]:
        """
        Parse the AI JSON response into (summary, explanation, recommendation).
        Falls back to raw content if JSON parsing fails.
        """
        try:
            data = json.loads(content)
            summary = data.get("simple_summary") or data.get(
                "what_happened", "AI analysis complete."
            )
            explanation = (
                f"{data.get('what_happened', '')}\n\n"
                f"Why: {data.get('why_it_happened', '')}\n\n"
                f"Risk: {data.get('risk_assessment', '')}\n\n"
                f"Frequency: {data.get('frequency_context', '')}"
            ).strip()
            recommendation = data.get("recommended_action", "No specific action required.")
            return summary, explanation, recommendation
        except (json.JSONDecodeError, AttributeError):
            # AI returned non-JSON — store raw text gracefully
            truncated = content[:500] if len(content) > 500 else content
            return "AI analysis complete.", truncated, "Review event details manually."

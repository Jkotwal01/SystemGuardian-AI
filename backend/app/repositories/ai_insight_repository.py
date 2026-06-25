"""
AIInsightRepository — persistence and cache for AI-generated insights.

Implements:
  - save()                  — upsert by event_id (one insight per event)
  - get_by_event_id()       — fetch insight for a specific event
  - get_cached_by_source_id() — 24-hour cache: same Event ID type won't
                               re-query AI within 24 hours
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

from sqlalchemy import select

from app.core.repository import BaseRepository
from app.models.ai_insight import AIInsightModel


class AIInsightRepository(BaseRepository[AIInsightModel]):
    model = AIInsightModel

    async def save(self, insight: AIInsightModel) -> AIInsightModel:
        """
        Upsert: if an insight for this event_id already exists, update it.
        Otherwise insert a new record.
        """
        if insight.event_id:
            existing = await self.get_by_event_id(insight.event_id)
            if existing:
                existing.summary = insight.summary
                existing.explanation = insight.explanation
                existing.recommendation = insight.recommendation
                existing.provider = insight.provider
                existing.model_name = insight.model_name
                existing.generated_at = datetime.now(tz=UTC)
                await self._session.flush()
                return existing

        self._session.add(insight)
        await self._session.flush()
        await self._session.refresh(insight)
        return insight

    async def get_by_event_id(self, event_id: str) -> AIInsightModel | None:
        """Return the stored AI insight for a given event, if any."""
        stmt = select(self.model).where(self.model.event_id == event_id)
        result = await self._session.execute(stmt)
        return result.scalar_one_or_none()

    async def get_cached_by_source_id(
        self,
        source_id: str,
        hours: int = 24,
    ) -> AIInsightModel | None:
        """
        24-hour cache lookup: return a recent insight for the same Windows
        Event ID (source_id) regardless of which specific event triggered it.

        This prevents re-querying the AI for every occurrence of e.g. Event ID
        4625 (Failed Login) when the same explanation applies to all of them.
        """
        cutoff = datetime.now(tz=UTC) - timedelta(hours=hours)

        # Join to events table to filter by source_id
        from sqlalchemy import and_

        from app.models.event import EventModel

        stmt = (
            select(self.model)
            .join(EventModel, self.model.event_id == EventModel.id)
            .where(
                and_(
                    EventModel.source_id == source_id,
                    self.model.generated_at >= cutoff,
                )
            )
            .order_by(self.model.generated_at.desc())
            .limit(1)
        )
        result = await self._session.execute(stmt)
        return result.scalar_one_or_none()

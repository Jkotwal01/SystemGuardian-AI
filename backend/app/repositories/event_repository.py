from datetime import datetime

from sqlalchemy import desc, select

from app.core.repository import BaseRepository
from app.domain.enums import EventCategory, Severity
from app.models.event import EventModel


class EventRepository(BaseRepository[EventModel]):
    model = EventModel

    async def get_by_severity(self, severity: Severity, limit: int = 50) -> list[EventModel]:
        stmt = (
            select(self.model)
            .where(self.model.severity == severity)
            .order_by(desc(self.model.occurred_at))
            .limit(limit)
        )
        result = await self._session.execute(stmt)
        return list(result.scalars().all())

    async def get_since(self, since: datetime) -> list[EventModel]:
        stmt = (
            select(self.model)
            .where(self.model.occurred_at >= since)
            .order_by(self.model.occurred_at)
        )
        result = await self._session.execute(stmt)
        return list(result.scalars().all())

    async def get_by_category(self, category: EventCategory, hours: int = 24) -> list[EventModel]:
        # Implement logic for fetching by category and time window
        # simplified for this phase
        stmt = (
            select(self.model)
            .where(self.model.category == category)
            .order_by(desc(self.model.occurred_at))
            .limit(100)
        )
        result = await self._session.execute(stmt)
        return list(result.scalars().all())

    async def count_by_severity_today(self) -> dict[Severity, int]:
        # Implement aggregation
        return {}

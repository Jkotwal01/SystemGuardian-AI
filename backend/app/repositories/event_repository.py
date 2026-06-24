from datetime import datetime, timedelta, timezone

from sqlalchemy import desc, func, select

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

    async def get_since_minutes(self, minutes: int = 15) -> list[EventModel]:
        """Return all events from the last `minutes` minutes. Used for correlation."""
        cutoff = datetime.now(tz=timezone.utc) - timedelta(minutes=minutes)
        return await self.get_since(cutoff)

    async def get_by_category(self, category: EventCategory, hours: int = 24) -> list[EventModel]:
        cutoff = datetime.now(tz=timezone.utc) - timedelta(hours=hours)
        stmt = (
            select(self.model)
            .where(self.model.category == category)
            .where(self.model.occurred_at >= cutoff)
            .order_by(desc(self.model.occurred_at))
            .limit(500)
        )
        result = await self._session.execute(stmt)
        return list(result.scalars().all())

    async def count_since(self, since: datetime, category: EventCategory | None = None) -> int:
        """Count events since a given datetime, optionally filtered by category."""
        stmt = select(func.count()).select_from(self.model).where(
            self.model.occurred_at >= since
        )
        if category is not None:
            stmt = stmt.where(self.model.category == category)
        result = await self._session.execute(stmt)
        return result.scalar_one()

    async def count_by_severity_today(self) -> dict[Severity, int]:
        """Count events per severity for the past 24 hours."""
        cutoff = datetime.now(tz=timezone.utc) - timedelta(hours=24)
        stmt = (
            select(self.model.severity, func.count().label("cnt"))
            .where(self.model.occurred_at >= cutoff)
            .group_by(self.model.severity)
        )
        result = await self._session.execute(stmt)
        return {row.severity: row.cnt for row in result}

    async def count_by_category_today(self) -> dict[EventCategory, int]:
        """Count events per category for the past 24 hours."""
        cutoff = datetime.now(tz=timezone.utc) - timedelta(hours=24)
        stmt = (
            select(self.model.category, func.count().label("cnt"))
            .where(self.model.occurred_at >= cutoff)
            .group_by(self.model.category)
        )
        result = await self._session.execute(stmt)
        return {row.category: row.cnt for row in result}

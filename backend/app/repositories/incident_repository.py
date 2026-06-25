from collections.abc import Sequence
from sqlalchemy import desc, select
from sqlalchemy.orm import selectinload

from app.core.repository import BaseRepository
from app.models.incident import IncidentModel
from app.models.event import EventModel


class IncidentRepository(BaseRepository[IncidentModel]):
    model = IncidentModel

    async def get_by_id(self, id: str) -> IncidentModel | None:
        stmt = select(self.model).where(self.model.id == id).options(selectinload(self.model.events).selectinload(EventModel.ai_insight))
        result = await self._session.execute(stmt)
        return result.scalar_one_or_none()

    async def get_all(self, limit: int = 100, offset: int = 0) -> Sequence[IncidentModel]:
        stmt = select(self.model).limit(limit).offset(offset).options(selectinload(self.model.events).selectinload(EventModel.ai_insight))
        result = await self._session.execute(stmt)
        return result.scalars().all()

    async def get_active_incidents(self, limit: int = 50) -> list[IncidentModel]:
        stmt = (
            select(self.model)
            .where(self.model.resolved_at.is_(None))
            .order_by(desc(self.model.created_at))
            .limit(limit)
            .options(selectinload(self.model.events).selectinload(EventModel.ai_insight))
        )
        result = await self._session.execute(stmt)
        return list(result.scalars().all())

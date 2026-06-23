from sqlalchemy import desc, select

from app.core.repository import BaseRepository
from app.models.incident import IncidentModel


class IncidentRepository(BaseRepository[IncidentModel]):
    model = IncidentModel

    async def get_active_incidents(self, limit: int = 50) -> list[IncidentModel]:
        stmt = (
            select(self.model)
            .where(self.model.resolved_at.is_(None))
            .order_by(desc(self.model.created_at))
            .limit(limit)
        )
        result = await self._session.execute(stmt)
        return list(result.scalars().all())

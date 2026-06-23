from app.core.repository import BaseRepository
from app.models.health_score import HealthScoreModel
from sqlalchemy import select, desc

class HealthScoreRepository(BaseRepository[HealthScoreModel]):
    model = HealthScoreModel
    
    async def get_history(self, limit: int = 100) -> list[HealthScoreModel]:
        stmt = select(self.model).order_by(desc(self.model.timestamp)).limit(limit)
        result = await self._session.execute(stmt)
        return list(result.scalars().all())

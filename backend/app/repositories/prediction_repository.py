from datetime import datetime
from sqlalchemy import select, desc
from app.core.repository import BaseRepository
from app.models.prediction import PredictionModel

class PredictionRepository(BaseRepository[PredictionModel]):
    model = PredictionModel

    async def get_latest_predictions(self, limit: int = 10) -> list[PredictionModel]:
        """Gets the most recently generated predictions."""
        stmt = select(PredictionModel).order_by(desc(PredictionModel.generated_at)).limit(limit)
        result = await self._session.execute(stmt)
        return list(result.scalars().all())

    async def get_active_predictions(self, min_probability: float = 0.5) -> list[PredictionModel]:
        """Gets recent active predictions above a certain probability threshold."""
        stmt = (
            select(PredictionModel)
            .where(PredictionModel.failure_probability >= min_probability)
            .order_by(desc(PredictionModel.failure_probability))
        )
        result = await self._session.execute(stmt)
        return list(result.scalars().all())

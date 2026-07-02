from sqlalchemy import select, desc
from app.core.repository import BaseRepository
from app.models.report import ReportModel

class ReportRepository(BaseRepository[ReportModel]):
    model = ReportModel

    async def get_recent(self, limit: int = 20) -> list[ReportModel]:
        """Gets recent reports, newest first."""
        stmt = select(ReportModel).order_by(desc(ReportModel.generated_at)).limit(limit)
        result = await self._session.execute(stmt)
        return list(result.scalars().all())

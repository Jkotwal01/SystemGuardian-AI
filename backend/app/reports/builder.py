from abc import ABC, abstractmethod
from datetime import datetime
from typing import Any
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.report import ReportModel
from app.domain.enums import ReportType
from app.repositories.health_score_repository import HealthScoreRepository
from app.repositories.incident_repository import IncidentRepository
from app.repositories.event_repository import EventRepository

class ReportBuilder(ABC):
    """Base for all report types. Subclasses override build_*() methods."""

    def __init__(self, session: AsyncSession):
        self._session = session

    @property
    @abstractmethod
    def report_type(self) -> ReportType:
        pass

    async def build(self, period_start: datetime, period_end: datetime) -> ReportModel:
        """Template method — ensures consistent structure across all report types."""
        content = {
            "health_scores": await self.build_health_section(period_start, period_end),
            "incidents": await self.build_incidents_section(period_start, period_end),
            "events": await self.build_events_section(period_start, period_end),
        }
        
        return ReportModel(
            report_type=self.report_type,
            title=f"{self.report_type.value.capitalize()} System Report",
            period_start=period_start,
            period_end=period_end,
            content=content
        )
        
    async def build_health_section(self, start: datetime, end: datetime) -> dict[str, Any]:
        repo = HealthScoreRepository(self._session)
        # Using limit=100 as the repo method expects limit instead of days
        history = await repo.get_history(limit=100)
        if not history:
            return {"average_score": 0, "trend": "flat"}
            
        avg_score = sum(h.overall_score for h in history) / len(history)
        return {
            "average_score": round(avg_score, 1),
            "data_points": len(history)
        }

    async def build_incidents_section(self, start: datetime, end: datetime) -> dict[str, Any]:
        repo = IncidentRepository(self._session)
        incidents = await repo.get_all(limit=50)
        # In a real app we'd filter by date range
        return {
            "total": len(incidents),
            "critical": len([i for i in incidents if i.severity == "critical"])
        }

    async def build_events_section(self, start: datetime, end: datetime) -> dict[str, Any]:
        repo = EventRepository(self._session)
        counts = await repo.count_by_severity_today()
        return {
            "total_today": sum(counts.values()),
            "by_severity": {k.value: v for k, v in counts.items()}
        }

class DailyReportBuilder(ReportBuilder):
    @property
    def report_type(self) -> ReportType:
        return ReportType.DAILY

class WeeklyReportBuilder(ReportBuilder):
    @property
    def report_type(self) -> ReportType:
        return ReportType.WEEKLY

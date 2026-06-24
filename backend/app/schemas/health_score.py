"""Health score Pydantic schemas — re-exported from schemas.health for API use."""

from app.schemas.health import HealthScoreBase, HealthScoreCreate, HealthScoreRead
from pydantic import BaseModel


class HealthScoreHistoryResponse(BaseModel):
    items: list[HealthScoreRead]
    total: int


__all__ = [
    "HealthScoreBase",
    "HealthScoreCreate",
    "HealthScoreRead",
    "HealthScoreHistoryResponse",
]

"""Health score Pydantic schemas — re-exported from schemas.health for API use."""

from pydantic import BaseModel

from app.schemas.health import HealthScoreBase, HealthScoreCreate, HealthScoreRead


class HealthScoreHistoryResponse(BaseModel):
    items: list[HealthScoreRead]
    total: int


__all__ = [
    "HealthScoreBase",
    "HealthScoreCreate",
    "HealthScoreRead",
    "HealthScoreHistoryResponse",
]

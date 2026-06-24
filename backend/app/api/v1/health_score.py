"""Health Score API — GET /api/v1/health-score and GET /api/v1/health-score/history."""

from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import DatabaseManager
from app.repositories.health_score_repository import HealthScoreRepository
from app.schemas.health_score import HealthScoreHistoryResponse, HealthScoreRead

router = APIRouter(prefix="/health-score", tags=["health"])


async def get_session() -> AsyncSession:  # type: ignore[return]
    async with DatabaseManager.get_session_factory()() as session:
        yield session


@router.get("", response_model=HealthScoreRead | None)
async def get_latest_health_score(
    session: AsyncSession = Depends(get_session),
) -> HealthScoreRead | None:
    """Return the most recent computed health score."""
    repo = HealthScoreRepository(session)
    history = await repo.get_history(limit=1)
    if not history:
        return None
    return HealthScoreRead.model_validate(history[0])


@router.get("/history", response_model=HealthScoreHistoryResponse)
async def get_health_score_history(
    limit: int = 50,
    session: AsyncSession = Depends(get_session),
) -> HealthScoreHistoryResponse:
    """Return historical health score records, most recent first."""
    repo = HealthScoreRepository(session)
    items = await repo.get_history(limit=limit)
    return HealthScoreHistoryResponse(
        items=[HealthScoreRead.model_validate(i) for i in items],
        total=len(items),
    )

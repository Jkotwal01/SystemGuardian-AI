"""Events API — GET /api/v1/events and GET /api/v1/events/{event_id}."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import DatabaseManager
from app.domain.enums import EventCategory, Severity
from app.repositories.event_repository import EventRepository
from app.schemas.event import EventListResponse, EventRead

router = APIRouter(prefix="/events", tags=["events"])


async def get_session() -> AsyncSession:  # type: ignore[return]
    async with DatabaseManager.get_session_factory()() as session:
        yield session


@router.get("", response_model=EventListResponse)
async def list_events(
    category: EventCategory | None = Query(None, description="Filter by event category"),
    severity: Severity | None = Query(None, description="Filter by severity"),
    hours: int = Query(24, ge=1, le=168, description="Look-back window in hours"),
    limit: int = Query(50, ge=1, le=500),
    session: AsyncSession = Depends(get_session),
) -> EventListResponse:
    """Return recent events, optionally filtered by category or severity."""
    repo = EventRepository(session)

    if category is not None:
        items = await repo.get_by_category(category, hours=hours)
    elif severity is not None:
        items = await repo.get_by_severity(severity, limit=limit)
    else:
        items = await repo.get_since_minutes(minutes=hours * 60)

    # Apply limit after category fetch
    items = items[:limit]

    return EventListResponse(
        items=[EventRead.model_validate(e) for e in items],
        total=len(items),
        page=1,
        per_page=limit,
    )


@router.get("/{event_id}", response_model=EventRead)
async def get_event(
    event_id: str,
    session: AsyncSession = Depends(get_session),
) -> EventRead:
    """Return a single event by ID."""
    repo = EventRepository(session)
    event = await repo.get_by_id(event_id)
    if event is None:
        raise HTTPException(status_code=404, detail=f"Event '{event_id}' not found")
    return EventRead.model_validate(event)

"""Incidents API — GET /api/v1/incidents and PATCH /api/v1/incidents/{id}."""

from __future__ import annotations

from collections.abc import AsyncGenerator
from datetime import UTC

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import DatabaseManager
from app.domain.enums import IncidentStatus
from app.repositories.incident_repository import IncidentRepository
from app.schemas.incident import IncidentListResponse, IncidentRead

router = APIRouter(prefix="/incidents", tags=["incidents"])


async def get_session() -> AsyncGenerator[AsyncSession, None]:
    async with DatabaseManager.get_session_factory()() as session:
        yield session


class IncidentUpdateRequest(BaseModel):
    status: IncidentStatus
    resolution_notes: str | None = None


@router.get("", response_model=IncidentListResponse)
async def list_incidents(
    session: AsyncSession = Depends(get_session),
) -> IncidentListResponse:
    """Return all active (unresolved) incidents."""
    repo = IncidentRepository(session)
    items = await repo.get_active_incidents()
    return IncidentListResponse(
        items=[IncidentRead.model_validate(i) for i in items],
        total=len(items),
    )


@router.get("/{incident_id}", response_model=IncidentRead)
async def get_incident(
    incident_id: str,
    session: AsyncSession = Depends(get_session),
) -> IncidentRead:
    """Return a single incident by ID."""
    repo = IncidentRepository(session)
    incident = await repo.get_by_id(incident_id)
    if incident is None:
        raise HTTPException(status_code=404, detail=f"Incident '{incident_id}' not found")
    return IncidentRead.model_validate(incident)


@router.patch("/{incident_id}", response_model=IncidentRead)
async def update_incident(
    incident_id: str,
    body: IncidentUpdateRequest,
    session: AsyncSession = Depends(get_session),
) -> IncidentRead:
    """Update incident status (e.g. resolve or dismiss)."""
    repo = IncidentRepository(session)
    incident = await repo.get_by_id(incident_id)
    if incident is None:
        raise HTTPException(status_code=404, detail=f"Incident '{incident_id}' not found")

    incident.status = body.status
    if body.resolution_notes is not None:
        incident.resolution_notes = body.resolution_notes

    if body.status in {IncidentStatus.RESOLVED, IncidentStatus.DISMISSED}:
        from datetime import datetime

        incident.resolved_at = datetime.now(tz=UTC)

    await repo.save(incident)
    return IncidentRead.model_validate(incident)

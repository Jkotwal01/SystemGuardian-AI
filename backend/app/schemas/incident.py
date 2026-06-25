from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.domain.enums import IncidentStatus, Severity

from app.schemas.event import EventRead


class IncidentBase(BaseModel):
    title: str
    description: str
    severity: Severity


class IncidentCreate(IncidentBase):
    pass


class IncidentRead(IncidentBase):
    id: str
    status: IncidentStatus
    created_at: datetime
    updated_at: datetime
    resolved_at: datetime | None = None
    resolution_notes: str | None = None
    events: list[EventRead] = []

    model_config = ConfigDict(from_attributes=True)


class IncidentListResponse(BaseModel):
    items: list[IncidentRead]
    total: int

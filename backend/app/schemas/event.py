from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict

from app.domain.enums import EventCategory, Severity


class AIInsightRead(BaseModel):
    id: str
    summary: str
    explanation: str
    recommendation: str

    model_config = ConfigDict(from_attributes=True)


class EventBase(BaseModel):
    source: str
    category: EventCategory
    severity: Severity
    title: str


class EventCreate(EventBase):
    raw_data: dict[str, Any]
    occurred_at: datetime


class EventRead(EventBase):
    id: str
    occurred_at: datetime
    collected_at: datetime
    incident_id: str | None = None
    ai_insight: AIInsightRead | None = None

    model_config = ConfigDict(from_attributes=True)


class EventListResponse(BaseModel):
    items: list[EventRead]
    total: int
    page: int
    per_page: int

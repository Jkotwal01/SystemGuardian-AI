from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict

from app.domain.enums import EventCategory, Severity


class HealthScoreBase(BaseModel):
    overall_score: float
    component_scores: dict[str, float]


class HealthScoreCreate(HealthScoreBase):
    pass


class HealthScoreRead(HealthScoreBase):
    id: str
    timestamp: datetime

    model_config = ConfigDict(from_attributes=True)


class PredictionBase(BaseModel):
    component: EventCategory
    failure_probability: float
    predicted_time_to_failure_hours: float | None = None
    severity: Severity
    reason: str
    metrics_snapshot: dict[str, Any] | None = None


class PredictionCreate(PredictionBase):
    pass


class PredictionRead(PredictionBase):
    id: str
    generated_at: datetime

    model_config = ConfigDict(from_attributes=True)

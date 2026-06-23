from datetime import datetime
from typing import Any

from sqlalchemy import JSON, DateTime, Enum, Float, String
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.core.database import Base
from app.domain.enums import EventCategory, Severity
from app.models.event import uuid4_hex


class PredictionModel(Base):
    __tablename__ = "predictions"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=uuid4_hex)
    component: Mapped[EventCategory] = mapped_column(Enum(EventCategory))
    failure_probability: Mapped[float] = mapped_column(Float)
    predicted_time_to_failure_hours: Mapped[float | None] = mapped_column(Float, nullable=True)
    severity: Mapped[Severity] = mapped_column(Enum(Severity))
    reason: Mapped[str] = mapped_column(String)
    metrics_snapshot: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)
    generated_at: Mapped[datetime] = mapped_column(DateTime, default=func.now())

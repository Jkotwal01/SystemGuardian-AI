from datetime import datetime
from typing import Any

from sqlalchemy import JSON, DateTime, Float, String
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.core.database import Base
from app.models.event import uuid4_hex


class HealthScoreModel(Base):
    __tablename__ = "health_scores"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=uuid4_hex)
    overall_score: Mapped[float] = mapped_column(Float)
    component_scores: Mapped[dict[str, Any]] = mapped_column(JSON)
    timestamp: Mapped[datetime] = mapped_column(DateTime, default=func.now())

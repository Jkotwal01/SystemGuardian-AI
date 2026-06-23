from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, Enum, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.core.database import Base
from app.domain.enums import AIProvider
from app.models.event import uuid4_hex

if TYPE_CHECKING:
    from app.models.event import EventModel


class AIInsightModel(Base):
    __tablename__ = "ai_insights"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=uuid4_hex)
    event_id: Mapped[str | None] = mapped_column(
        String, ForeignKey("events.id"), nullable=True, unique=True
    )
    incident_id: Mapped[str | None] = mapped_column(
        String, ForeignKey("incidents.id"), nullable=True
    )
    provider: Mapped[AIProvider] = mapped_column(Enum(AIProvider))
    model_name: Mapped[str] = mapped_column(String)
    summary: Mapped[str] = mapped_column(String)
    explanation: Mapped[str] = mapped_column(String)
    recommendation: Mapped[str] = mapped_column(String)
    generated_at: Mapped[datetime] = mapped_column(DateTime, default=func.now())

    event: Mapped["EventModel"] = relationship(back_populates="ai_insight")
    # Incident relationship could be added here if needed

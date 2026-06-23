import uuid
from typing import Any
from datetime import datetime
from sqlalchemy import JSON, ForeignKey, DateTime, String, Enum
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from typing import TYPE_CHECKING
from app.core.database import Base
from app.domain.enums import EventCategory, Severity

if TYPE_CHECKING:
    from app.models.incident import IncidentModel
    from app.models.ai_insight import AIInsightModel

def uuid4_hex() -> str:
    return uuid.uuid4().hex

class EventModel(Base):
    __tablename__ = "events"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=uuid4_hex)
    source: Mapped[str] = mapped_column(String)
    source_id: Mapped[str | None] = mapped_column(String, nullable=True)
    category: Mapped[EventCategory] = mapped_column(Enum(EventCategory))
    severity: Mapped[Severity] = mapped_column(Enum(Severity))
    title: Mapped[str] = mapped_column(String)
    raw_data: Mapped[dict[str, Any]] = mapped_column(JSON)
    normalized_data: Mapped[dict[str, Any]] = mapped_column(JSON)
    occurred_at: Mapped[datetime] = mapped_column(DateTime)
    collected_at: Mapped[datetime] = mapped_column(DateTime, default=func.now())
    incident_id: Mapped[str | None] = mapped_column(String, ForeignKey("incidents.id"), nullable=True)
    metadata_: Mapped[dict[str, Any] | None] = mapped_column(JSON, name="metadata", nullable=True)

    incident: Mapped["IncidentModel"] = relationship(back_populates="events")
    ai_insight: Mapped["AIInsightModel"] = relationship(back_populates="event", uselist=False)

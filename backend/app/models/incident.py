from typing import Any
from datetime import datetime
from sqlalchemy import String, Enum, DateTime, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from typing import TYPE_CHECKING
from app.core.database import Base
from app.domain.enums import IncidentStatus, Severity
from app.models.event import uuid4_hex

if TYPE_CHECKING:
    from app.models.event import EventModel

class IncidentModel(Base):
    __tablename__ = "incidents"
    
    id: Mapped[str] = mapped_column(String, primary_key=True, default=uuid4_hex)
    title: Mapped[str] = mapped_column(String)
    description: Mapped[str] = mapped_column(String)
    status: Mapped[IncidentStatus] = mapped_column(Enum(IncidentStatus), default=IncidentStatus.OPEN)
    severity: Mapped[Severity] = mapped_column(Enum(Severity))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=func.now(), onupdate=func.now())
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    resolution_notes: Mapped[str | None] = mapped_column(String, nullable=True)
    metadata_: Mapped[dict[str, Any] | None] = mapped_column(JSON, name="metadata", nullable=True)

    events: Mapped[list["EventModel"]] = relationship(back_populates="incident")

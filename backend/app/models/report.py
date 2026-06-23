from datetime import datetime
from typing import Any

from sqlalchemy import JSON, DateTime, Enum, String
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.core.database import Base
from app.domain.enums import ReportType
from app.models.event import uuid4_hex


class ReportModel(Base):
    __tablename__ = "reports"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=uuid4_hex)
    report_type: Mapped[ReportType] = mapped_column(Enum(ReportType))
    title: Mapped[str] = mapped_column(String)
    content: Mapped[dict[str, Any]] = mapped_column(JSON)
    period_start: Mapped[datetime] = mapped_column(DateTime)
    period_end: Mapped[datetime] = mapped_column(DateTime)
    generated_at: Mapped[datetime] = mapped_column(DateTime, default=func.now())

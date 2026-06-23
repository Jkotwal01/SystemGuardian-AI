from datetime import datetime

from sqlalchemy import DateTime, Float, String
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.core.database import Base
from app.models.event import uuid4_hex


class HardwareMetricModel(Base):
    __tablename__ = "hardware_metrics"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=uuid4_hex)
    cpu_usage_percent: Mapped[float] = mapped_column(Float)
    memory_usage_percent: Mapped[float] = mapped_column(Float)
    memory_total_bytes: Mapped[float] = mapped_column(Float)
    memory_available_bytes: Mapped[float] = mapped_column(Float)
    cpu_temperature_celsius: Mapped[float | None] = mapped_column(Float, nullable=True)
    battery_percent: Mapped[float | None] = mapped_column(Float, nullable=True)
    is_plugged_in: Mapped[bool | None] = mapped_column(nullable=True)
    timestamp: Mapped[datetime] = mapped_column(DateTime, default=func.now())

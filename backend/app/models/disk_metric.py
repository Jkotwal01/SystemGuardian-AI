from datetime import datetime

from sqlalchemy import DateTime, Float, String
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.core.database import Base
from app.models.event import uuid4_hex


class DiskMetricModel(Base):
    __tablename__ = "disk_metrics"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=uuid4_hex)
    device: Mapped[str] = mapped_column(String)
    mountpoint: Mapped[str] = mapped_column(String)
    total_bytes: Mapped[float] = mapped_column(Float)
    used_bytes: Mapped[float] = mapped_column(Float)
    free_bytes: Mapped[float] = mapped_column(Float)
    usage_percent: Mapped[float] = mapped_column(Float)
    read_bytes_per_sec: Mapped[float] = mapped_column(Float)
    write_bytes_per_sec: Mapped[float] = mapped_column(Float)
    timestamp: Mapped[datetime] = mapped_column(DateTime, default=func.now())

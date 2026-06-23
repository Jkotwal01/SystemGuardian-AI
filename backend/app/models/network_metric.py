from datetime import datetime
from sqlalchemy import String, Float, DateTime
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.core.database import Base
from app.models.event import uuid4_hex

class NetworkMetricModel(Base):
    __tablename__ = "network_metrics"
    
    id: Mapped[str] = mapped_column(String, primary_key=True, default=uuid4_hex)
    interface: Mapped[str] = mapped_column(String)
    bytes_sent_per_sec: Mapped[float] = mapped_column(Float)
    bytes_recv_per_sec: Mapped[float] = mapped_column(Float)
    packets_sent_per_sec: Mapped[float] = mapped_column(Float)
    packets_recv_per_sec: Mapped[float] = mapped_column(Float)
    errors_in: Mapped[float] = mapped_column(Float)
    errors_out: Mapped[float] = mapped_column(Float)
    timestamp: Mapped[datetime] = mapped_column(DateTime, default=func.now())

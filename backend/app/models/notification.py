from datetime import datetime
from sqlalchemy import String, DateTime, Enum, Boolean
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.core.database import Base
from app.domain.enums import Severity
from app.models.event import uuid4_hex

class NotificationModel(Base):
    __tablename__ = "notifications"
    
    id: Mapped[str] = mapped_column(String, primary_key=True, default=uuid4_hex)
    title: Mapped[str] = mapped_column(String)
    message: Mapped[str] = mapped_column(String)
    severity: Mapped[Severity] = mapped_column(Enum(Severity))
    is_read: Mapped[bool] = mapped_column(Boolean, default=False)
    action_url: Mapped[str | None] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=func.now())

from datetime import datetime

from sqlalchemy import DateTime, String
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.core.database import Base
from app.models.event import uuid4_hex


class ChatMessageModel(Base):
    __tablename__ = "chat_messages"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=uuid4_hex)
    session_id: Mapped[str] = mapped_column(String)
    role: Mapped[str] = mapped_column(String)  # user, assistant, system
    content: Mapped[str] = mapped_column(String)
    timestamp: Mapped[datetime] = mapped_column(DateTime, default=func.now())

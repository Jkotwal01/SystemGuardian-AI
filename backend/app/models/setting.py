from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base

class SettingModel(Base):
    __tablename__ = "settings"
    
    key: Mapped[str] = mapped_column(String, primary_key=True)
    value: Mapped[str] = mapped_column(String)

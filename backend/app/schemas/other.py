from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict

from app.domain.enums import ReportType, Severity


class ReportBase(BaseModel):
    report_type: ReportType
    title: str
    content: dict[str, Any]
    period_start: datetime
    period_end: datetime


class ReportCreate(ReportBase):
    pass


class ReportRead(ReportBase):
    id: str
    generated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class NotificationBase(BaseModel):
    title: str
    message: str
    severity: Severity
    action_url: str | None = None


class NotificationCreate(NotificationBase):
    pass


class NotificationRead(NotificationBase):
    id: str
    is_read: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ChatMessageBase(BaseModel):
    session_id: str
    role: str
    content: str


class ChatMessageCreate(ChatMessageBase):
    pass


class ChatMessageRead(ChatMessageBase):
    id: str
    timestamp: datetime

    model_config = ConfigDict(from_attributes=True)


class SettingBase(BaseModel):
    key: str
    value: str


class SettingCreate(SettingBase):
    pass


class SettingRead(SettingBase):
    model_config = ConfigDict(from_attributes=True)

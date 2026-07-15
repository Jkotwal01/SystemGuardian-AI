from datetime import datetime

from pydantic import BaseModel, ConfigDict


class ChatMessageBase(BaseModel):
    role: str  # 'user' or 'assistant'
    content: str


class ChatMessageRead(ChatMessageBase):
    id: str
    session_id: str
    timestamp: datetime

    model_config = ConfigDict(from_attributes=True)


class ChatRequest(BaseModel):
    session_id: str
    message: str


class ChatSessionRead(BaseModel):
    session_id: str
    updated_at: datetime
    title: str

    model_config = ConfigDict(from_attributes=True)

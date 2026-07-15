"""
Chat API — handles streaming conversational AI with context injection.
"""

from __future__ import annotations

import json
from collections.abc import AsyncGenerator
from typing import Any

from fastapi import APIRouter, Depends, Request
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import DatabaseManager
from app.repositories.chat_message_repository import ChatMessageRepository
from app.schemas.chat import ChatMessageRead, ChatRequest, ChatSessionRead

router = APIRouter(prefix="/chat", tags=["chat"])


async def get_session() -> AsyncGenerator[AsyncSession, None]:
    async with DatabaseManager.get_session_factory()() as session:
        yield session


@router.get("/sessions", response_model=list[ChatSessionRead])
async def get_chat_sessions(
    limit: int = 15,
    session: AsyncSession = Depends(get_session),
) -> list[ChatSessionRead]:
    """Retrieve all recent chat sessions."""
    repo = ChatMessageRepository(session)
    sessions = await repo.get_sessions(limit=limit)
    return [ChatSessionRead.model_validate(s) for s in sessions]


@router.delete("/sessions/{session_id}", response_model=dict[str, Any])
async def delete_chat_session(
    session_id: str,
    session: AsyncSession = Depends(get_session),
) -> dict[str, Any]:
    """Delete all messages for a chat session."""
    repo = ChatMessageRepository(session)
    deleted = await repo.delete_session(session_id)
    return {"deleted": deleted, "session_id": session_id}


def get_ai_assistant(request: Request) -> Any:
    """Dependency to retrieve the AIAssistant instance from app state."""
    # We will inject this from main.py via request.app.state
    if not hasattr(request.app.state, "ai_assistant"):
        raise RuntimeError("AIAssistant not initialized in app state.")
    return request.app.state.ai_assistant


@router.post("/stream")
async def chat_stream_endpoint(
    request: ChatRequest,
    req: Request,
) -> StreamingResponse:
    """
    Stream a response from the AI assistant.
    Returns chunked Transfer-Encoding response.
    """
    assistant = get_ai_assistant(req)

    async def event_generator() -> Any:
        try:
            async for chunk in assistant.chat_stream(request.session_id, request.message):
                # Yield as Server-Sent Events (SSE) or just raw text?
                # For standard LLM streaming, yielding raw chunks is easiest for simple clients,
                # but SSE allows JSON framing if needed. We'll use simple JSON chunks.
                yield json.dumps({"chunk": chunk}) + "\n"
        except Exception as e:
            yield json.dumps({"error": str(e)}) + "\n"

    return StreamingResponse(event_generator(), media_type="application/x-ndjson")


@router.get("/{session_id}", response_model=list[ChatMessageRead])
async def get_chat_history(
    session_id: str,
    limit: int = 50,
    session: AsyncSession = Depends(get_session),
) -> list[ChatMessageRead]:
    """Retrieve chat history for a given session."""
    repo = ChatMessageRepository(session)
    messages = await repo.get_session_history(session_id, limit=limit)
    return [ChatMessageRead.model_validate(m) for m in messages]

from __future__ import annotations
from typing import Any

from sqlalchemy import desc, select

from app.core.repository import BaseRepository
from app.models.chat_message import ChatMessageModel


class ChatMessageRepository(BaseRepository[ChatMessageModel]):
    """Repository for managing AI assistant chat messages."""

    model = ChatMessageModel

    async def get_session_history(self, session_id: str, limit: int = 20) -> list[ChatMessageModel]:
        """
        Fetch the most recent messages for a session, ordered chronologically.
        Fetches up to `limit` messages descending by timestamp, then reverses to chronological.
        """
        stmt = (
            select(self.model)
            .where(self.model.session_id == session_id)
            .order_by(desc(self.model.timestamp))
            .limit(limit)
        )
        result = await self._session.execute(stmt)
        messages = list(result.scalars().all())
        # Return chronological order (oldest first)
        messages.reverse()
        return messages

    async def get_sessions(self, limit: int = 15) -> list[dict[str, Any]]:
        """Get recent distinct sessions with their latest timestamp and title
        (derived from the first user message)."""
        from sqlalchemy import func
        stmt = (
            select(self.model.session_id, func.max(self.model.timestamp).label("max_ts"))
            .group_by(self.model.session_id)
            .order_by(desc("max_ts"))
            .limit(limit)
        )
        result = await self._session.execute(stmt)
        session_rows = result.all()

        sessions = []
        for row in session_rows:
            session_id = row[0]
            max_ts = row[1]
            
            # Fetch the first user message for the title
            title_stmt = (
                select(self.model.content)
                .where(self.model.session_id == session_id, self.model.role == "user")
                .order_by(self.model.timestamp)
                .limit(1)
            )
            title_res = await self._session.execute(title_stmt)
            title_content = title_res.scalar()
            
            title = "New Chat"
            if title_content:
                title = title_content[:40] + ("..." if len(title_content) > 40 else "")
                
            sessions.append({
                "session_id": session_id,
                "updated_at": max_ts,
                "title": title
            })
            
        return sessions

    async def delete_session(self, session_id: str) -> int:
        """Delete all messages belonging to a session. Returns count of deleted rows."""
        from sqlalchemy import delete as sql_delete
        stmt = sql_delete(self.model).where(self.model.session_id == session_id)
        result = await self._session.execute(stmt)
        await self._session.commit()
        return int(getattr(result, "rowcount", 0))

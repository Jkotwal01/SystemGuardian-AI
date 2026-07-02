from __future__ import annotations

from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.repository import BaseRepository
from app.models.chat_message import ChatMessageModel


class ChatMessageRepository(BaseRepository[ChatMessageModel]):
    """Repository for managing AI assistant chat messages."""

    model = ChatMessageModel

    async def get_session_history(
        self, session_id: str, limit: int = 20
    ) -> list[ChatMessageModel]:
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

    async def get_sessions(self, limit: int = 10) -> list[str]:
        """Get recent distinct session IDs."""
        stmt = (
            select(self.model.session_id)
            .group_by(self.model.session_id)
            .order_by(desc(select(self.model.timestamp).where(self.model.session_id == self.model.session_id).scalar_subquery()))
            .limit(limit)
        )
        # Simplify the group_by query for SQLite
        from sqlalchemy import func
        stmt = (
            select(self.model.session_id, func.max(self.model.timestamp).label("max_ts"))
            .group_by(self.model.session_id)
            .order_by(desc("max_ts"))
            .limit(limit)
        )
        result = await self._session.execute(stmt)
        return [row[0] for row in result.all()]

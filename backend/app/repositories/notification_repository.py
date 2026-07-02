from sqlalchemy import select, desc, update
from app.core.repository import BaseRepository
from app.models.notification import NotificationModel

class NotificationRepository(BaseRepository[NotificationModel]):
    model = NotificationModel

    async def get_recent(self, limit: int = 50) -> list[NotificationModel]:
        """Gets recent notifications, newest first."""
        stmt = select(NotificationModel).order_by(desc(NotificationModel.created_at)).limit(limit)
        result = await self._session.execute(stmt)
        return list(result.scalars().all())

    async def get_unread_count(self) -> int:
        """Gets the total count of unread notifications."""
        from sqlalchemy import func
        stmt = select(func.count()).select_from(NotificationModel).where(NotificationModel.is_read == False)
        result = await self._session.execute(stmt)
        return result.scalar() or 0

    async def mark_as_read(self, notification_id: str) -> NotificationModel | None:
        """Marks a notification as read and returns it."""
        stmt = (
            update(NotificationModel)
            .where(NotificationModel.id == notification_id)
            .values(is_read=True)
            .returning(NotificationModel)
        )
        result = await self._session.execute(stmt)
        await self._session.commit()
        return result.scalars().first()

    async def mark_all_as_read(self) -> None:
        """Marks all unread notifications as read."""
        stmt = (
            update(NotificationModel)
            .where(NotificationModel.is_read == False)
            .values(is_read=True)
        )
        await self._session.execute(stmt)
        await self._session.commit()

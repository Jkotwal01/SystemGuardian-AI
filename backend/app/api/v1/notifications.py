from collections.abc import AsyncGenerator
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import DatabaseManager
from app.repositories.notification_repository import NotificationRepository

router = APIRouter(prefix="/notifications", tags=["notifications"])


async def get_session() -> AsyncGenerator[AsyncSession, None]:
    async with DatabaseManager.get_session_factory()() as session:
        yield session


@router.get("")
@router.get("/")
async def get_notifications(limit: int = 50, db: AsyncSession = Depends(get_session)) -> Any:
    """Get recent notifications."""
    repo = NotificationRepository(db)
    notifications = await repo.get_recent(limit=limit)
    return [
        {
            "id": n.id,
            "title": n.title,
            "message": n.message,
            "severity": n.severity,
            "is_read": n.is_read,
            "action_url": n.action_url,
            "created_at": n.created_at,
        }
        for n in notifications
    ]


@router.get("/unread-count")
async def get_unread_count(db: AsyncSession = Depends(get_session)) -> Any:
    """Get count of unread notifications."""
    repo = NotificationRepository(db)
    count = await repo.get_unread_count()
    return {"count": count}


@router.patch("/{notification_id}/read")
async def mark_read(notification_id: str, db: AsyncSession = Depends(get_session)) -> Any:
    """Mark a notification as read."""
    repo = NotificationRepository(db)
    notification = await repo.mark_as_read(notification_id)
    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")
    return {"status": "success"}


@router.post("/read-all")
async def mark_all_read(db: AsyncSession = Depends(get_session)) -> Any:
    """Mark all notifications as read."""
    repo = NotificationRepository(db)
    await repo.mark_all_as_read()
    return {"status": "success"}

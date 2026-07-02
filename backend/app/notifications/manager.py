from datetime import datetime, timezone, timedelta
from typing import Callable, Coroutine, Any
import structlog
from sqlalchemy.ext.asyncio import async_sessionmaker, AsyncSession
from app.core.event_bus import event_bus
from app.processors.pipeline import Events
from app.models.incident import IncidentModel
from app.models.notification import NotificationModel
from app.repositories.notification_repository import NotificationRepository
from app.domain.enums import Severity

logger = structlog.get_logger(__name__)

def utcnow() -> datetime:
    return datetime.now(tz=timezone.utc)

class NotificationManager:
    """
    Observer: subscribes to EventBus.
    Manages cooldown, dedup, and routing to channels.
    """
    def __init__(self, session_factory: async_sessionmaker[AsyncSession]):
        self._session_factory = session_factory
        self._cooldown_cache: dict[str, datetime] = {}

        # Subscribe to relevant bus events
        event_bus.subscribe(Events.THREAT_DETECTED, self._on_threat)
        event_bus.subscribe(Events.INCIDENT_CREATED, self._on_incident)
        event_bus.subscribe(Events.PREDICTION_GENERATED, self._on_prediction)

    def _is_in_cooldown(self, key: str, minutes: int = 15) -> bool:
        now = utcnow()
        last_sent = self._cooldown_cache.get(key)
        if last_sent and (now - last_sent) < timedelta(minutes=minutes):
            return True
        return False

    async def _on_threat(self, threat: Any) -> None:
        # threat is a dictionary from security.py in most cases
        severity = threat.get("severity") if isinstance(threat, dict) else threat.severity
        if severity in (Severity.CRITICAL, Severity.HIGH):
            title = threat.get("title") if isinstance(threat, dict) else threat.title
            desc = threat.get("description") if isinstance(threat, dict) else threat.description
            
            notif = NotificationModel(
                title=f"Security Threat: {title}",
                message=desc,
                severity=severity,
                action_url="/security"
            )
            await self._dispatch("security_threat", notif)

    async def _on_incident(self, incident: IncidentModel) -> None:
        if incident.severity in (Severity.CRITICAL, Severity.HIGH):
            notif = NotificationModel(
                title=f"New Incident: {incident.title}",
                message=incident.description,
                severity=incident.severity,
                action_url=f"/incidents/{incident.id}"
            )
            await self._dispatch("incident", notif)

    async def _on_prediction(self, prediction: Any) -> None:
        if prediction.severity in (Severity.CRITICAL, Severity.HIGH):
            notif = NotificationModel(
                title="System Prediction Alert",
                message=prediction.reason,
                severity=prediction.severity,
                action_url="/overview"
            )
            await self._dispatch("prediction", notif)

    async def _dispatch(self, category: str, notification: NotificationModel) -> None:
        cooldown_key = f"{category}:{notification.title}"
        if self._is_in_cooldown(cooldown_key, minutes=15):
            return

        async with self._session_factory() as session:
            repo = NotificationRepository(session)
            await repo.save(notification)
            
        self._cooldown_cache[cooldown_key] = utcnow()
        await event_bus.publish(Events.NOTIFICATION_READY, notification)
        logger.info("notification.dispatched", title=notification.title)

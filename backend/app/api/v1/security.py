"""
Security API — threat stats and login activity for the Security dashboard page.

GET /api/v1/security/stats  — summary counts (login attempts, brute force, threats today)
GET /api/v1/security/events — recent security events (alias for events?category=security)
"""

from __future__ import annotations

from collections.abc import AsyncGenerator
from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import DatabaseManager
from app.domain.enums import EventCategory, Severity
from app.models.event import EventModel
from app.repositories.event_repository import EventRepository
from app.schemas.event import EventListResponse, EventRead

router = APIRouter(prefix="/security", tags=["security"])


async def get_session() -> AsyncGenerator[AsyncSession, None]:
    async with DatabaseManager.get_session_factory()() as session:
        yield session


# ── Response models ───────────────────────────────────────────────────────────


class SecurityStatsResponse(BaseModel):
    total_security_events_24h: int
    failed_logins_24h: int
    successful_logins_24h: int
    brute_force_attempts: int  # 5+ failed logins in 10-min windows
    critical_events_24h: int
    high_events_24h: int
    unique_sources: int  # distinct event sources
    threats_detected_24h: int  # events tagged as CRITICAL or HIGH in security category


# ── Helpers ───────────────────────────────────────────────────────────────────


async def _count_security_events(
    session: AsyncSession,
    *,
    hours: int = 24,
    source_id: str | None = None,
    severity: Severity | None = None,
) -> int:
    cutoff = datetime.now(tz=UTC) - timedelta(hours=hours)
    stmt = (
        select(func.count())
        .select_from(EventModel)
        .where(EventModel.category == EventCategory.SECURITY)
        .where(EventModel.occurred_at >= cutoff)
    )
    if source_id:
        stmt = stmt.where(EventModel.source_id == source_id)
    if severity:
        stmt = stmt.where(EventModel.severity == severity)
    result = await session.execute(stmt)
    return result.scalar_one()


# ── Endpoints ─────────────────────────────────────────────────────────────────


@router.get("/stats", response_model=SecurityStatsResponse)
async def get_security_stats(
    session: AsyncSession = Depends(get_session),
) -> SecurityStatsResponse:
    """Return security event summary counts for the last 24 hours."""
    cutoff = datetime.now(tz=UTC) - timedelta(hours=24)

    # Total security events
    total = await _count_security_events(session, hours=24)

    # Failed / successful logins
    failed_logins = await _count_security_events(session, hours=24, source_id="4625")
    successful_logins = await _count_security_events(session, hours=24, source_id="4624")

    # Critical events
    critical = await _count_security_events(session, hours=24, severity=Severity.CRITICAL)
    high = await _count_security_events(session, hours=24, severity=Severity.HIGH)

    # Threats: critical + high events in security category
    threats = critical + high

    # Brute force: detect 5+ failed logins in any 10-min window using the event log
    # Simplified: count if failed_logins >= 5 in 24h (flag as 1 brute force attempt)
    brute_force = 1 if failed_logins >= 5 else 0

    # Unique sources
    source_stmt = (
        select(func.count(func.distinct(EventModel.source)))
        .where(EventModel.category == EventCategory.SECURITY)
        .where(EventModel.occurred_at >= cutoff)
    )
    source_result = await session.execute(source_stmt)
    unique_sources = source_result.scalar_one() or 0

    return SecurityStatsResponse(
        total_security_events_24h=total,
        failed_logins_24h=failed_logins,
        successful_logins_24h=successful_logins,
        brute_force_attempts=brute_force,
        critical_events_24h=critical,
        high_events_24h=high,
        unique_sources=unique_sources,
        threats_detected_24h=threats,
    )


@router.get("/events", response_model=EventListResponse)
async def get_security_events(
    hours: int = 24,
    limit: int = 100,
    session: AsyncSession = Depends(get_session),
) -> EventListResponse:
    """Return recent security events — convenience alias for /events?category=security."""
    repo = EventRepository(session)
    items = await repo.get_by_category(EventCategory.SECURITY, hours=hours)
    items = items[:limit]
    return EventListResponse(
        items=[EventRead.model_validate(e) for e in items],
        total=len(items),
        page=1,
        per_page=limit,
    )

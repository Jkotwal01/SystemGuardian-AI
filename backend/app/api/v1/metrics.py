"""
Metrics API — live hardware/disk/network metric endpoints.

GET /api/v1/metrics/live   — current snapshot (latest row per category)
GET /api/v1/metrics/hardware/history — recent hardware time-series
GET /api/v1/metrics/network/history  — recent network time-series
GET /api/v1/metrics/disk/history     — recent disk time-series
"""

from __future__ import annotations

from collections.abc import AsyncGenerator

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import DatabaseManager
from app.repositories.metric_repository import (
    DiskMetricRepository,
    HardwareMetricRepository,
    NetworkMetricRepository,
)
from app.schemas.metrics import DiskMetricRead, HardwareMetricRead, NetworkMetricRead

router = APIRouter(prefix="/metrics", tags=["metrics"])


async def get_session() -> AsyncGenerator[AsyncSession, None]:
    async with DatabaseManager.get_session_factory()() as session:
        yield session


# ── Response models ───────────────────────────────────────────────────────────


class LiveMetricsResponse(BaseModel):
    hardware: HardwareMetricRead | None = None
    disks: list[DiskMetricRead] = []
    networks: list[NetworkMetricRead] = []


class HardwareHistoryResponse(BaseModel):
    items: list[HardwareMetricRead]
    total: int


class DiskHistoryResponse(BaseModel):
    items: list[DiskMetricRead]
    total: int


class NetworkHistoryResponse(BaseModel):
    items: list[NetworkMetricRead]
    total: int


# ── Endpoints ─────────────────────────────────────────────────────────────────


@router.get("/live", response_model=LiveMetricsResponse)
async def get_live_metrics(
    session: AsyncSession = Depends(get_session),
) -> LiveMetricsResponse:
    """Return the most recent hardware, disk, and network metrics."""
    hw_repo = HardwareMetricRepository(session)
    disk_repo = DiskMetricRepository(session)
    net_repo = NetworkMetricRepository(session)

    hw = await hw_repo.get_latest()
    disks = await disk_repo.get_latest_all()
    networks = await net_repo.get_latest_all()

    return LiveMetricsResponse(
        hardware=HardwareMetricRead.model_validate(hw) if hw else None,
        disks=[DiskMetricRead.model_validate(d) for d in disks],
        networks=[NetworkMetricRead.model_validate(n) for n in networks],
    )


@router.get("/hardware/history", response_model=HardwareHistoryResponse)
async def get_hardware_history(
    limit: int = 60,
    session: AsyncSession = Depends(get_session),
) -> HardwareHistoryResponse:
    """Return recent hardware metric records (newest first) for sparkline charts."""
    repo = HardwareMetricRepository(session)
    items = await repo.get_recent(limit=limit)
    return HardwareHistoryResponse(
        items=[HardwareMetricRead.model_validate(i) for i in items],
        total=len(items),
    )


@router.get("/disk/history", response_model=DiskHistoryResponse)
async def get_disk_history(
    limit: int = 60,
    session: AsyncSession = Depends(get_session),
) -> DiskHistoryResponse:
    """Return recent disk metric records."""
    repo = DiskMetricRepository(session)
    items = await repo.get_recent(limit=limit)
    return DiskHistoryResponse(
        items=[DiskMetricRead.model_validate(i) for i in items],
        total=len(items),
    )


@router.get("/network/history", response_model=NetworkHistoryResponse)
async def get_network_history(
    limit: int = 60,
    session: AsyncSession = Depends(get_session),
) -> NetworkHistoryResponse:
    """Return recent network metric records."""
    repo = NetworkMetricRepository(session)
    items = await repo.get_recent(limit=limit)
    return NetworkHistoryResponse(
        items=[NetworkMetricRead.model_validate(i) for i in items],
        total=len(items),
    )

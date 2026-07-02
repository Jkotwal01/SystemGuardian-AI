"""
MetricRepository — thin async repositories for hardware, disk, and network metrics.
"""

from __future__ import annotations

from sqlalchemy import desc, select

from app.core.repository import BaseRepository
from app.models.disk_metric import DiskMetricModel
from app.models.hardware_metric import HardwareMetricModel
from app.models.network_metric import NetworkMetricModel


class HardwareMetricRepository(BaseRepository[HardwareMetricModel]):
    model = HardwareMetricModel

    async def get_latest(self) -> HardwareMetricModel | None:
        stmt = (
            select(self.model)
            .order_by(desc(self.model.timestamp))
            .limit(1)
        )
        result = await self._session.execute(stmt)
        return result.scalars().first()

    async def get_recent(self, limit: int = 60) -> list[HardwareMetricModel]:
        stmt = (
            select(self.model)
            .order_by(desc(self.model.timestamp))
            .limit(limit)
        )
        result = await self._session.execute(stmt)
        return list(result.scalars().all())


class DiskMetricRepository(BaseRepository[DiskMetricModel]):
    model = DiskMetricModel

    async def get_latest_all(self) -> list[DiskMetricModel]:
        """Return the most recent row per mountpoint."""
        from sqlalchemy import func
        from sqlalchemy.orm import aliased
        
        sub = (
            select(
                self.model,
                func.row_number()
                .over(
                    partition_by=self.model.mountpoint,
                    order_by=self.model.timestamp.desc()
                )
                .label("rn"),
            )
            .subquery()
        )
        model_alias = aliased(self.model, sub)
        stmt = select(model_alias).where(sub.c.rn == 1)
        
        result = await self._session.execute(stmt)
        return list(result.scalars().all())

    async def get_recent(self, limit: int = 60) -> list[DiskMetricModel]:
        stmt = (
            select(self.model)
            .order_by(desc(self.model.timestamp))
            .limit(limit)
        )
        result = await self._session.execute(stmt)
        return list(result.scalars().all())


class NetworkMetricRepository(BaseRepository[NetworkMetricModel]):
    model = NetworkMetricModel

    async def get_latest_all(self) -> list[NetworkMetricModel]:
        """Return the most recent row per interface."""
        from sqlalchemy import func
        from sqlalchemy.orm import aliased

        sub = (
            select(
                self.model,
                func.row_number()
                .over(
                    partition_by=self.model.interface,
                    order_by=self.model.timestamp.desc()
                )
                .label("rn"),
            )
            .subquery()
        )
        model_alias = aliased(self.model, sub)
        stmt = select(model_alias).where(sub.c.rn == 1)
        
        result = await self._session.execute(stmt)
        return list(result.scalars().all())

    async def get_recent(self, limit: int = 60) -> list[NetworkMetricModel]:
        stmt = (
            select(self.model)
            .order_by(desc(self.model.timestamp))
            .limit(limit)
        )
        result = await self._session.execute(stmt)
        return list(result.scalars().all())

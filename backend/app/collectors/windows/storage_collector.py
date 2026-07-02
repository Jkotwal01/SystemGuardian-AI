"""
Storage Collector — disk usage, I/O stats, and partition health via psutil.

Collects: per-partition usage%, read/write I/O bytes, and disk health summary.
Flags WARNING when any disk exceeds 80% and CRITICAL at 95%.
"""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

import psutil
import structlog

from app.collectors.base import BaseCollector
from app.collectors.normalizer import EventNormalizerMixin
from app.collectors.registry import CollectorRegistry
from app.domain.enums import EventCategory, Severity
from app.models.event import EventModel
import time
from app.models.disk_metric import DiskMetricModel
from app.repositories.metric_repository import DiskMetricRepository

logger = structlog.get_logger()

DISK_WARN_PERCENT = 80.0
DISK_CRITICAL_PERCENT = 95.0


@CollectorRegistry.register
class StorageCollector(BaseCollector, EventNormalizerMixin):
    """
    Collects per-partition disk usage and system-wide I/O counters.
    Emits one event per connected physical disk partition.
    """

    name = "windows_storage"
    module = EventCategory.STORAGE

    _last_io = {}
    _last_time = 0.0

    async def _collect(self) -> list[EventModel]:
        # ── Per-partition usage & Metric Persistence ───────────────────────────
        now = time.time()
        dt = now - self.__class__._last_time if self.__class__._last_time else 1.0
        self.__class__._last_time = now

        partitions: list[dict[str, Any]] = []
        max_severity = Severity.INFO
        metric_repo = DiskMetricRepository(self._session)

        # Get system-wide IO to distribute (psutil doesn't give per-partition easily on Windows)
        try:
            sys_io = psutil.disk_io_counters()
            if sys_io:
                prev_sys = self.__class__._last_io.get("sys", sys_io)
                self.__class__._last_io["sys"] = sys_io
                
                # Approximate per-disk IO by dividing system IO by number of partitions
                # This is a limitation of psutil on Windows (disk_io_counters(perdisk=True) gives PhysicalDriveX, not C:)
                part_count = max(1, len(psutil.disk_partitions(all=False)))
                read_ps = max(0.0, (sys_io.read_bytes - prev_sys.read_bytes) / dt) / part_count
                write_ps = max(0.0, (sys_io.write_bytes - prev_sys.write_bytes) / dt) / part_count
            else:
                read_ps = 0.0
                write_ps = 0.0
        except (AttributeError, OSError):
            read_ps = 0.0
            write_ps = 0.0

        for part in psutil.disk_partitions(all=False):
            try:
                usage = psutil.disk_usage(part.mountpoint)
                pct = usage.percent
                sev = self._classify_disk_severity(pct)
                if list(Severity).index(sev) < list(Severity).index(max_severity):
                    max_severity = sev

                # Save time-series metric row for the API
                disk_metric = DiskMetricModel(
                    device=part.device,
                    mountpoint=part.mountpoint,
                    total_bytes=usage.total,
                    used_bytes=usage.used,
                    free_bytes=usage.free,
                    usage_percent=pct,
                    read_bytes_per_sec=read_ps,
                    write_bytes_per_sec=write_ps,
                )
                await metric_repo.save(disk_metric)

                partitions.append(
                    {
                        "device": part.device,
                        "mountpoint": part.mountpoint,
                        "fstype": part.fstype,
                        "total_gb": round(usage.total / 1024**3, 2),
                        "used_gb": round(usage.used / 1024**3, 2),
                        "free_gb": round(usage.free / 1024**3, 2),
                        "percent_used": pct,
                        "severity": str(sev),
                    }
                )
            except (PermissionError, OSError):
                continue

        # ── System-wide disk I/O ─────────────────────────────────────────────
        io_metrics: dict[str, Any] = {}
        try:
            io = psutil.disk_io_counters()
            if io:
                io_metrics = {
                    "read_bytes": io.read_bytes,
                    "write_bytes": io.write_bytes,
                    "read_count": io.read_count,
                    "write_count": io.write_count,
                    "read_time_ms": io.read_time,
                    "write_time_ms": io.write_time,
                }
        except (AttributeError, OSError):
            pass

        metrics: dict[str, Any] = {
            "partitions": partitions,
            "io_counters": io_metrics,
            "partition_count": len(partitions),
            "collected_at": datetime.now(UTC).isoformat(),
        }

        # Determine worst-case title
        critical_parts = [p for p in partitions if p["percent_used"] >= DISK_CRITICAL_PERCENT]
        warn_parts = [p for p in partitions if p["percent_used"] >= DISK_WARN_PERCENT]

        if critical_parts:
            dev = critical_parts[0]['device']
            pct = critical_parts[0]['percent_used']
            title = f"Storage CRITICAL — {dev} at {pct:.0f}%"
        elif warn_parts:
            dev = warn_parts[0]['device']
            pct = warn_parts[0]['percent_used']
            title = f"Storage Warning — {dev} at {pct:.0f}%"
        else:
            avg = sum(p["percent_used"] for p in partitions) / max(len(partitions), 1)
            title = f"Storage Healthy — {len(partitions)} partitions, avg {avg:.0f}% used"

        event = self.normalize_metric_event(
            metrics=metrics,
            category=EventCategory.STORAGE,
            title=title,
            severity=max_severity,
            source="psutil_storage",
        )
        return [event]

    async def health_check(self) -> bool:
        try:
            psutil.disk_partitions()
            return True
        except Exception:  # noqa: BLE001
            return False

    @staticmethod
    def _classify_disk_severity(percent: float) -> Severity:
        if percent >= DISK_CRITICAL_PERCENT:
            return Severity.CRITICAL
        if percent >= DISK_WARN_PERCENT:
            return Severity.HIGH
        if percent >= 65.0:
            return Severity.MEDIUM
        return Severity.INFO

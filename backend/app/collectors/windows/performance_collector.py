"""
Performance Collector — collects CPU, memory, and process metrics via psutil.

Runs on every METRICS_INTERVAL_SECONDS cycle.
Captures system-wide CPU%, RAM%, swap%, and top-5 CPU-consuming processes.
Severity is auto-determined by threshold rules.
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

logger = structlog.get_logger()

# Severity thresholds (percent)
CPU_THRESHOLDS = {Severity.CRITICAL: 95.0, Severity.HIGH: 85.0, Severity.MEDIUM: 70.0}
RAM_THRESHOLDS = {Severity.CRITICAL: 95.0, Severity.HIGH: 85.0, Severity.MEDIUM: 75.0}


def _classify_by_threshold(value: float, thresholds: dict[Severity, float]) -> Severity:
    for severity in (Severity.CRITICAL, Severity.HIGH, Severity.MEDIUM):
        if value >= thresholds[severity]:
            return severity
    return Severity.INFO


@CollectorRegistry.register
class PerformanceCollector(BaseCollector, EventNormalizerMixin):
    """
    Collects system-wide CPU, RAM, and swap metrics every poll cycle.
    Also captures the top-5 CPU-consuming processes for diagnostics.
    """

    name = "windows_performance"
    module = EventCategory.PERFORMANCE

    async def _collect(self) -> list[EventModel]:
        events: list[EventModel] = []

        # CPU snapshot (blocking=False returns instantaneous, not interval average)
        cpu_percent = psutil.cpu_percent(interval=None)
        cpu_count = psutil.cpu_count(logical=True) or 1
        per_cpu = psutil.cpu_percent(percpu=True, interval=None)

        # Memory
        mem = psutil.virtual_memory()
        swap = psutil.swap_memory()

        # Top processes by CPU
        top_processes = self._get_top_processes(n=5)

        metrics: dict[str, Any] = {
            "cpu_percent": cpu_percent,
            "cpu_count_logical": cpu_count,
            "cpu_percent_per_core": per_cpu,
            "ram_percent": mem.percent,
            "ram_total_mb": round(mem.total / 1024 / 1024, 1),
            "ram_available_mb": round(mem.available / 1024 / 1024, 1),
            "ram_used_mb": round(mem.used / 1024 / 1024, 1),
            "swap_percent": swap.percent,
            "swap_total_mb": round(swap.total / 1024 / 1024, 1),
            "top_processes": top_processes,
            "collected_at": datetime.now(UTC).isoformat(),
        }

        # Determine overall severity
        cpu_sev = _classify_by_threshold(cpu_percent, CPU_THRESHOLDS)
        ram_sev = _classify_by_threshold(mem.percent, RAM_THRESHOLDS)
        severity = min(cpu_sev, ram_sev, key=lambda s: list(Severity).index(s))

        title = f"System Performance — CPU {cpu_percent:.1f}% | RAM {mem.percent:.1f}%"

        event = self.normalize_metric_event(
            metrics=metrics,
            category=EventCategory.PERFORMANCE,
            title=title,
            severity=severity,
            source="psutil",
        )
        events.append(event)
        return events

    async def health_check(self) -> bool:
        try:
            psutil.cpu_percent(interval=None)
            return True
        except Exception:  # noqa: BLE001
            return False

    @staticmethod
    def _get_top_processes(n: int = 5) -> list[dict[str, Any]]:
        """Return top-N processes sorted by CPU usage."""
        procs: list[dict[str, Any]] = []
        for proc in psutil.process_iter(["pid", "name", "cpu_percent", "memory_percent"]):
            try:
                info = proc.info
                procs.append(
                    {
                        "pid": info.get("pid"),
                        "name": info.get("name", "unknown"),
                        "cpu_percent": info.get("cpu_percent", 0.0),
                        "memory_percent": round(info.get("memory_percent", 0.0) or 0.0, 2),
                    }
                )
            except (psutil.NoSuchProcess, psutil.AccessDenied):
                continue
        procs.sort(key=lambda p: p["cpu_percent"] or 0, reverse=True)
        return procs[:n]

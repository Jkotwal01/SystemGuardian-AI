"""
Hardware Collector — CPU temperature, battery, fans via psutil + wmi.

Collects: CPU temperatures (if sensors available), battery status,
physical disk count, and basic hardware summary.
WMI is used on Windows where psutil sensor data is unavailable.
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


@CollectorRegistry.register
class HardwareCollector(BaseCollector, EventNormalizerMixin):
    """
    Collects hardware sensor data: temps, battery, and basic HW summary.
    Falls back gracefully when sensors are unavailable (e.g., VMs).
    """

    name = "windows_hardware"
    module = EventCategory.HARDWARE

    async def _collect(self) -> list[EventModel]:
        metrics: dict[str, Any] = {
            "collected_at": datetime.now(UTC).isoformat(),
        }

        # ── Battery ─────────────────────────────────────────────────────────
        battery = psutil.sensors_battery()
        if battery is not None:
            metrics["battery_percent"] = round(battery.percent, 1)
            metrics["battery_plugged"] = battery.power_plugged
            metrics["battery_secs_left"] = battery.secsleft if battery.secsleft > 0 else None
        else:
            metrics["battery_percent"] = None

        # ── Temperatures ─────────────────────────────────────────────────────
        temps: dict[str, Any] = {}
        if hasattr(psutil, "sensors_temperatures"):
            try:
                raw_temps = psutil.sensors_temperatures() or {}
                for chip, readings in raw_temps.items():
                    temps[chip] = [
                        {
                            "label": r.label or chip,
                            "current": r.current,
                            "high": r.high,
                            "critical": r.critical,
                        }
                        for r in readings
                    ]
            except (AttributeError, OSError):
                pass
        metrics["temperatures"] = temps

        # ── CPU info ────────────────────────────────────────────────────────
        metrics["cpu_physical_cores"] = psutil.cpu_count(logical=False)
        metrics["cpu_logical_cores"] = psutil.cpu_count(logical=True)

        try:
            freq = psutil.cpu_freq()
            if freq:
                metrics["cpu_freq_mhz"] = round(freq.current, 0)
                metrics["cpu_freq_max_mhz"] = round(freq.max, 0)
        except (AttributeError, OSError):
            pass

        # ── RAM ──────────────────────────────────────────────────────────────
        mem = psutil.virtual_memory()
        metrics["ram_total_gb"] = round(mem.total / 1024**3, 2)

        # ── Severity decision ────────────────────────────────────────────────
        severity = self._evaluate_severity(metrics)
        title = self._build_title(metrics)

        event = self.normalize_metric_event(
            metrics=metrics,
            category=EventCategory.HARDWARE,
            title=title,
            severity=severity,
            source="psutil_hardware",
        )
        return [event]

    async def health_check(self) -> bool:
        try:
            psutil.virtual_memory()
            return True
        except Exception:  # noqa: BLE001
            return False

    @staticmethod
    def _evaluate_severity(metrics: dict[str, Any]) -> Severity:
        # Critical battery
        battery_pct = metrics.get("battery_percent")
        if battery_pct is not None:
            plugged = metrics.get("battery_plugged", True)
            if not plugged:
                if battery_pct < 5:
                    return Severity.CRITICAL
                if battery_pct < 15:
                    return Severity.HIGH
                if battery_pct < 25:
                    return Severity.MEDIUM

        # Critical temperatures
        for readings in (metrics.get("temperatures") or {}).values():
            for r in readings:
                if r.get("critical") and r.get("current"):
                    if r["current"] >= r["critical"] * 0.95:
                        return Severity.CRITICAL
                    if r["current"] >= r["critical"] * 0.85:
                        return Severity.HIGH

        return Severity.INFO

    @staticmethod
    def _build_title(metrics: dict[str, Any]) -> str:
        battery = metrics.get("battery_percent")
        plugged = metrics.get("battery_plugged")
        if battery is not None:
            status = "charging" if plugged else "on battery"
            return f"Hardware Status — Battery {battery:.0f}% ({status})"
        return "Hardware Status — No battery detected"

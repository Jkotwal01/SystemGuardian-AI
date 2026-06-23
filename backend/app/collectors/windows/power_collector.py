"""
Power Collector — battery, power plan, and thermal state via psutil.

Monitors: battery charge level and discharge rate, plugged/unplugged
state transitions, and overall power plan. Complements the hardware
collector by focusing on power-specific events rather than sensors.
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
class PowerCollector(BaseCollector, EventNormalizerMixin):
    """
    Collects battery status and power-plan metrics.
    On desktops (no battery), emits an informational event each cycle.
    """

    name = "windows_power"
    module = EventCategory.POWER

    async def _collect(self) -> list[EventModel]:
        metrics: dict[str, Any] = {
            "collected_at": datetime.now(UTC).isoformat(),
        }

        battery = psutil.sensors_battery()

        if battery is not None:
            secs_left = battery.secsleft
            hours_left = None
            if secs_left > 0:
                hours_left = round(secs_left / 3600, 2)

            metrics.update(
                {
                    "has_battery": True,
                    "battery_percent": round(battery.percent, 1),
                    "battery_plugged": battery.power_plugged,
                    "battery_secs_left": secs_left if secs_left > 0 else None,
                    "battery_hours_left": hours_left,
                    "power_source": "AC" if battery.power_plugged else "Battery",
                }
            )

            severity = self._evaluate_battery_severity(battery.percent, battery.power_plugged)
            if battery.power_plugged:
                title = f"Power — AC connected, battery at {battery.percent:.0f}%"
            else:
                if hours_left is not None:
                    title = f"Power — On battery ({battery.percent:.0f}%, ~{hours_left:.1f}h left)"
                else:
                    title = f"Power — On battery ({battery.percent:.0f}%)"
        else:
            metrics.update(
                {
                    "has_battery": False,
                    "power_source": "AC",
                    "battery_percent": None,
                }
            )
            severity = Severity.INFO
            title = "Power — Desktop (AC only, no battery)"

        event = self.normalize_metric_event(
            metrics=metrics,
            category=EventCategory.POWER,
            title=title,
            severity=severity,
            source="psutil_power",
        )
        return [event]

    async def health_check(self) -> bool:
        try:
            # psutil.sensors_battery() always works (returns None on desktops)
            psutil.sensors_battery()
            return True
        except Exception:  # noqa: BLE001
            return False

    @staticmethod
    def _evaluate_battery_severity(percent: float, plugged: bool) -> Severity:
        if plugged:
            return Severity.INFO
        # Discharging
        if percent < 5:
            return Severity.CRITICAL
        if percent < 15:
            return Severity.HIGH
        if percent < 25:
            return Severity.MEDIUM
        return Severity.INFO

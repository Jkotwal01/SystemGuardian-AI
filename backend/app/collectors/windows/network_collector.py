"""
Network Collector — per-interface I/O stats, connection counts via psutil.

Collects: bytes sent/recv per interface, active connection count by state,
and packet error/drop counts. Severity determined by connection anomalies.
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

# Too many CLOSE_WAIT or TIME_WAIT can indicate connection leaks
CONN_WARN_THRESHOLD = 200
CONN_CRITICAL_THRESHOLD = 500


@CollectorRegistry.register
class NetworkCollector(BaseCollector, EventNormalizerMixin):
    """
    Collects network interface statistics and active connection summary.
    Uses psutil for cross-platform compatibility.
    """

    name = "windows_network"
    module = EventCategory.NETWORK

    async def _collect(self) -> list[EventModel]:
        # ── Per-interface I/O counters ───────────────────────────────────────
        io_counters: dict[str, Any] = {}
        net_io = psutil.net_io_counters(pernic=True)
        for iface, stats in net_io.items():
            io_counters[iface] = {
                "bytes_sent": stats.bytes_sent,
                "bytes_recv": stats.bytes_recv,
                "packets_sent": stats.packets_sent,
                "packets_recv": stats.packets_recv,
                "errin": stats.errin,
                "errout": stats.errout,
                "dropin": stats.dropin,
                "dropout": stats.dropout,
            }

        # ── Active connections summary ───────────────────────────────────────
        conn_summary: dict[str, int] = {}
        total_connections = 0
        try:
            connections = psutil.net_connections(kind="inet")
            for conn in connections:
                state = conn.status or "UNKNOWN"
                conn_summary[state] = conn_summary.get(state, 0) + 1
                total_connections += 1
        except psutil.AccessDenied:
            conn_summary = {"error": -1}

        # ── Interface addresses ──────────────────────────────────────────────
        iface_addrs: dict[str, list[str]] = {}
        for iface, addrs in psutil.net_if_addrs().items():
            iface_addrs[iface] = [a.address for a in addrs if a.address]

        metrics: dict[str, Any] = {
            "io_counters": io_counters,
            "connection_summary": conn_summary,
            "total_connections": total_connections,
            "interface_addresses": iface_addrs,
            "collected_at": datetime.now(UTC).isoformat(),
        }

        severity = self._evaluate_severity(total_connections, io_counters)
        title = f"Network Status — {total_connections} active connections"

        event = self.normalize_metric_event(
            metrics=metrics,
            category=EventCategory.NETWORK,
            title=title,
            severity=severity,
            source="psutil_network",
        )
        return [event]

    async def health_check(self) -> bool:
        try:
            psutil.net_io_counters()
            return True
        except Exception:  # noqa: BLE001
            return False

    @staticmethod
    def _evaluate_severity(
        total_connections: int,
        io_counters: dict[str, Any],
    ) -> Severity:
        if total_connections >= CONN_CRITICAL_THRESHOLD:
            return Severity.CRITICAL
        if total_connections >= CONN_WARN_THRESHOLD:
            return Severity.HIGH

        # Check for significant packet errors or drops
        for iface_stats in io_counters.values():
            if isinstance(iface_stats, dict):
                if (iface_stats.get("errin", 0) + iface_stats.get("errout", 0)) > 100:
                    return Severity.MEDIUM
                if (iface_stats.get("dropin", 0) + iface_stats.get("dropout", 0)) > 500:
                    return Severity.MEDIUM

        return Severity.INFO

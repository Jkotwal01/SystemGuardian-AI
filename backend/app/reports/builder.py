from abc import ABC, abstractmethod
from datetime import datetime
from typing import Any

import structlog
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.enums import ReportType
from app.models.report import ReportModel
from app.repositories.event_repository import EventRepository
from app.repositories.health_score_repository import HealthScoreRepository
from app.repositories.incident_repository import IncidentRepository
from app.repositories.metric_repository import (
    DiskMetricRepository,
    HardwareMetricRepository,
    NetworkMetricRepository,
)
from app.repositories.prediction_repository import PredictionRepository

logger = structlog.get_logger()


class ReportBuilder(ABC):
    """Base for all report types. Uses LLM to generate the written analysis."""

    def __init__(self, session: AsyncSession, ai_provider=None) -> None:
        self._session = session
        self._ai_provider = ai_provider

    @property
    @abstractmethod
    def report_type(self) -> ReportType:
        pass

    async def build(self, period_start: datetime, period_end: datetime) -> ReportModel:
        """Template method — collect all data, then ask the AI to write the analysis."""
        # 1. Collect all raw metrics
        health = await self.build_health_section(period_start, period_end)
        incidents = await self.build_incidents_section(period_start, period_end)
        events = await self.build_events_section(period_start, period_end)
        hardware = await self.build_hardware_section(period_start, period_end)
        storage = await self.build_storage_section(period_start, period_end)
        network = await self.build_network_section(period_start, period_end)
        predictions = await self.build_predictions_section(period_start, period_end)

        raw_data = {
            "health_scores": health,
            "hardware": hardware,
            "storage": storage,
            "network": network,
            "incidents": incidents,
            "events": events,
            "predictions": predictions,
        }

        # 2. Ask AI to write a detailed narrative analysis
        ai_analysis = await self._generate_ai_analysis(raw_data, period_start, period_end)

        content = {**raw_data, "ai_analysis": ai_analysis}

        return ReportModel(
            report_type=self.report_type,
            title=f"{self.report_type.value.capitalize()} System Report",
            period_start=period_start,
            period_end=period_end,
            content=content,
        )

    async def _generate_ai_analysis(
        self, raw_data: dict[str, Any], period_start: datetime, period_end: datetime
    ) -> dict[str, str]:
        """Use the AI provider to write a professional diagnostic narrative."""
        if not self._ai_provider:
            return {"summary": "AI analysis unavailable (no provider configured)."}

        import json

        from app.ai.base import GenerateOptions

        # Format key data for the prompt
        hw = raw_data.get("hardware", {})
        health = raw_data.get("health_scores", {})
        incidents = raw_data.get("incidents", {})
        predictions = raw_data.get("predictions", [])
        storage = raw_data.get("storage", [])
        events = raw_data.get("events", {})

        # Build a compact snapshot for the LLM prompt
        snapshot = {
            "period": f"{period_start.strftime('%Y-%m-%d %H:%M')} to {period_end.strftime('%Y-%m-%d %H:%M')}",
            "health_score": health.get("average_score"),
            "cpu_avg_percent": hw.get("cpu_avg"),
            "ram_avg_percent": hw.get("ram_avg"),
            "cpu_temp_celsius": hw.get("latest", {}).get("temp"),
            "battery_percent": hw.get("battery_percent"),
            "is_plugged_in": hw.get("is_plugged_in"),
            "total_incidents": incidents.get("total"),
            "critical_incidents": incidents.get("critical"),
            "total_events": events.get("total_today"),
            "events_by_severity": events.get("by_severity"),
            "disk_drives": storage,
            "active_predictions": predictions,
        }

        system_prompt = """You are SystemGuardian AI, an expert PC diagnostic and health analyst.
You have been given a structured snapshot of a Windows PC's health data for a report period.
Write a comprehensive, professional diagnostic report in well-formatted Markdown.

Your report must include:
1. **Executive Summary** — 2-3 sentence overview of overall system health status.
2. **Health Score Analysis** — Interpret the health score and what it means for this PC.
3. **CPU Performance** — Analysis of CPU usage patterns and temperature (warn if high).
4. **Memory (RAM) Analysis** — Assessment of RAM usage and available headroom.
5. **Storage Analysis** — Drive-by-drive health and space assessment.
6. **Battery & Power** — Battery status and power mode assessment (if applicable).
7. **Security & Incidents** — Threat assessment based on incidents and security events.
8. **AI Risk Predictions** — Explain any flagged predictions in plain English.
9. **Recommendations** — Specific, actionable steps the user should take (at least 3 bullets).

Guidelines:
- Be specific and cite the actual numbers from the data.
- Use clear, non-technical language where possible.
- Use ✅ for good indicators, ⚠️ for warnings, and 🔴 for critical issues."""

        user_message = f"Here is the system data for this report period:\n\n```json\n{json.dumps(snapshot, indent=2)}\n```\n\nWrite the full diagnostic report now."

        try:
            options = GenerateOptions(temperature=0.3, max_tokens=2500)
            response = await self._ai_provider.generate(system_prompt, user_message, options)
            return {
                "summary": response.content,
                "provider": response.provider,
                "model": response.model,
            }
        except Exception as e:
            logger.error("report.ai_analysis_failed", error=str(e))
            return {"summary": f"AI analysis failed: {e}"}

    async def build_health_section(self, start: datetime, end: datetime) -> dict[str, Any]:
        repo = HealthScoreRepository(self._session)
        history = await repo.get_history(limit=100)
        if not history:
            return {"average_score": 0, "trend": "flat", "data_points": 0}

        avg_score = sum(h.overall_score for h in history) / len(history)
        # Get component breakdown from latest entry
        latest = history[0]
        return {
            "average_score": round(avg_score, 1),
            "latest_score": round(latest.overall_score, 1),
            "data_points": len(history),
            "component_scores": latest.component_scores or {},
        }

    async def build_incidents_section(self, start: datetime, end: datetime) -> dict[str, Any]:
        repo = IncidentRepository(self._session)
        incidents = await repo.get_all(limit=100)
        recent = incidents[:20]
        return {
            "total": len(incidents),
            "critical": len([i for i in incidents if i.severity == "critical"]),
            "high": len([i for i in incidents if i.severity == "high"]),
            "medium": len([i for i in incidents if i.severity == "medium"]),
            "recent_titles": [
                {"title": i.title, "severity": i.severity, "status": str(i.status)}
                for i in recent[:10]
            ],
        }

    async def build_events_section(self, start: datetime, end: datetime) -> dict[str, Any]:
        repo = EventRepository(self._session)
        counts = await repo.count_by_severity_today()
        by_severity = {str(k): v for k, v in counts.items()}
        cat_counts = await repo.count_by_category_today()
        by_category = {str(k): v for k, v in cat_counts.items()}
        return {
            "total_today": sum(counts.values()),
            "by_severity": by_severity,
            "by_category": by_category,
        }

    async def build_hardware_section(self, start: datetime, end: datetime) -> dict[str, Any]:
        repo = HardwareMetricRepository(self._session)
        history = await repo.get_recent(limit=30)
        if not history:
            return {"cpu_avg": 0, "ram_avg": 0, "data_points": 0}

        cpu_avg = sum(h.cpu_usage_percent for h in history) / len(history)
        ram_avg = sum(h.memory_usage_percent for h in history) / len(history)
        cpu_max = max(h.cpu_usage_percent for h in history)
        ram_max = max(h.memory_usage_percent for h in history)
        latest = history[0]

        return {
            "cpu_avg": round(cpu_avg, 1),
            "ram_avg": round(ram_avg, 1),
            "cpu_max": round(cpu_max, 1),
            "ram_max": round(ram_max, 1),
            "memory_total_gb": round(latest.memory_total_bytes / 1024**3, 2)
            if latest.memory_total_bytes
            else None,
            "memory_used_gb": round(
                (latest.memory_total_bytes - latest.memory_available_bytes) / 1024**3, 2
            )
            if (latest.memory_total_bytes and latest.memory_available_bytes)
            else None,
            "memory_available_gb": round(latest.memory_available_bytes / 1024**3, 2)
            if latest.memory_available_bytes
            else None,
            "battery_percent": latest.battery_percent,
            "is_plugged_in": latest.is_plugged_in,
            "latest": {
                "cpu": round(latest.cpu_usage_percent, 1),
                "ram": round(latest.memory_usage_percent, 1),
                "temp": round(latest.cpu_temperature_celsius, 1)
                if latest.cpu_temperature_celsius
                else None,
            },
            "data_points": len(history),
        }

    async def build_storage_section(self, start: datetime, end: datetime) -> list[dict[str, Any]]:
        repo = DiskMetricRepository(self._session)
        disks = await repo.get_latest_all()
        return [
            {
                "device": d.device,
                "mountpoint": d.mountpoint,
                "total_gb": round(d.total_bytes / 1024**3, 2),
                "used_gb": round(d.used_bytes / 1024**3, 2),
                "free_gb": round(d.free_bytes / 1024**3, 2),
                "usage_percent": round(d.usage_percent, 1),
                "read_mb_s": round(d.read_bytes_per_sec / 1024**2, 2),
                "write_mb_s": round(d.write_bytes_per_sec / 1024**2, 2),
            }
            for d in disks
        ]

    async def build_network_section(self, start: datetime, end: datetime) -> list[dict[str, Any]]:
        repo = NetworkMetricRepository(self._session)
        interfaces = await repo.get_latest_all()
        return [
            {
                "interface": n.interface,
                "recv_mb_s": round(n.bytes_recv_per_sec / 1024**2, 3),
                "sent_mb_s": round(n.bytes_sent_per_sec / 1024**2, 3),
            }
            for n in interfaces
            if n.bytes_recv_per_sec > 0 or n.bytes_sent_per_sec > 0
        ]

    async def build_predictions_section(
        self, start: datetime, end: datetime
    ) -> list[dict[str, Any]]:
        repo = PredictionRepository(self._session)
        predictions = await repo.get_active_predictions(min_probability=0.1)
        return [
            {
                "component": p.component,
                "failure_probability": p.failure_probability,
                "severity": p.severity,
                "reason": p.reason,
                "predicted_ttf_hours": p.predicted_time_to_failure_hours,
            }
            for p in predictions
        ]


class DailyReportBuilder(ReportBuilder):
    @property
    def report_type(self) -> ReportType:
        return ReportType.DAILY


class WeeklyReportBuilder(ReportBuilder):
    @property
    def report_type(self) -> ReportType:
        return ReportType.WEEKLY

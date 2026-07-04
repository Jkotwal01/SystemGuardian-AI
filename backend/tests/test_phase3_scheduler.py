"""
Phase 3 Scheduler Tests — verifies all 7 jobs are registered.

Uses anyio.from_thread to provide the running event loop that
APScheduler's AsyncIOScheduler requires.
"""

from __future__ import annotations

from unittest.mock import MagicMock

import pytest

from app.core.scheduler import MonitoringScheduler


def _make_scheduler() -> MonitoringScheduler:
    """Create a MonitoringScheduler with mock dependencies."""
    settings = MagicMock()
    settings.METRICS_INTERVAL_SECONDS = 30
    settings.EVENT_POLL_INTERVAL_SECONDS = 60
    settings.EVENT_RETENTION_DAYS = 90
    settings.METRIC_RETENTION_DAYS = 30

    orchestrator = MagicMock()
    pipeline = MagicMock()
    health_engine = MagicMock()
    event_bus = MagicMock()
    session_factory = MagicMock()

    return MonitoringScheduler(
        settings=settings,
        orchestrator=orchestrator,
        pipeline=pipeline,
        health_engine=health_engine,
        event_bus=event_bus,
        session_factory=session_factory,
    )


class TestMonitoringScheduler:
    @pytest.mark.asyncio
    async def test_scheduler_registers_all_7_jobs(self) -> None:
        """All 7 scheduled jobs must be registered after start()."""
        scheduler = _make_scheduler()
        scheduler.start()
        try:
            job_ids = scheduler.get_job_ids()
            expected_jobs = {
                "metrics",
                "events",
                "health_score",
                "security",
                "predictions",
                "daily_report",
                "cleanup",
            }
            assert set(job_ids) == expected_jobs, f"Missing jobs: {expected_jobs - set(job_ids)}"
            assert len(job_ids) == MonitoringScheduler.TOTAL_JOBS
        finally:
            scheduler.shutdown()

    @pytest.mark.asyncio
    async def test_scheduler_total_jobs_constant_matches(self) -> None:
        """TOTAL_JOBS class constant equals actual registered job count."""
        scheduler = _make_scheduler()
        scheduler.start()
        try:
            assert len(scheduler.get_job_ids()) == MonitoringScheduler.TOTAL_JOBS
        finally:
            scheduler.shutdown()

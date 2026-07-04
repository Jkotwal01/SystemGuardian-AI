"""
MonitoringScheduler — all background recurring jobs.

Jobs registered:
  1. metrics      — collect hardware metrics every 30s
  2. events       — collect OS event logs every 60s
  3. health_score — recalculate health score every 5 min
  4. security     — run security analysis every 5 min
  5. predictions  — run predictive analysis every hour  (Phase 9)
  6. daily_report — generate daily report at 8 AM       (Phase 10)
  7. cleanup      — purge old data at 3 AM

Adding a new job = one async method + one scheduler.add_job() call.
"""

from __future__ import annotations

from datetime import UTC

import structlog
from apscheduler.schedulers.asyncio import AsyncIOScheduler  # type: ignore[import-untyped]
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.collectors.orchestrator import CollectorOrchestrator
from app.config import Settings
from app.core.event_bus import EventBus
from app.core.settings_manager import SettingsManager
from app.engines.health_score import HealthScoreEngine
from app.processors.pipeline import EventProcessingPipeline, Events

logger = structlog.get_logger()


class MonitoringScheduler:
    """
    Wrapper around APScheduler's AsyncIOScheduler.

    All jobs run with max_instances=1 to prevent overlapping runs.
    Each job is independently defined as an async method.
    """

    TOTAL_JOBS = 7  # Used in tests to verify all jobs are registered

    def __init__(
        self,
        settings: Settings,
        orchestrator: CollectorOrchestrator,
        pipeline: EventProcessingPipeline,
        health_engine: HealthScoreEngine,
        event_bus: EventBus,
        session_factory: async_sessionmaker[AsyncSession],
    ) -> None:
        self._settings = settings
        self._orchestrator = orchestrator
        self._pipeline = pipeline
        self._health_engine = health_engine
        self._bus = event_bus
        self._session_factory = session_factory
        self._scheduler = AsyncIOScheduler(timezone="UTC")
        self._last_metrics_run = 0.0
        self._last_events_run = 0.0

    # ── Job Registration ──────────────────────────────────────────────────────

    def start(self) -> None:
        """Register all jobs and start the scheduler."""
        self._register_jobs()
        self._scheduler.start()
        logger.info(
            "scheduler.started",
            job_count=len(self._scheduler.get_jobs()),
        )

    def shutdown(self) -> None:
        """Gracefully stop the scheduler (waits for running jobs to finish)."""
        self._scheduler.shutdown(wait=True)
        logger.info("scheduler.stopped")

    def get_job_ids(self) -> list[str]:
        """Return list of registered job IDs (for testing and health checks)."""
        return [job.id for job in self._scheduler.get_jobs()]

    def _register_jobs(self) -> None:
        """Register all 7 scheduled jobs."""

        # Job 1: Hardware/performance metrics — checks every 5 seconds, throttles based on dynamic settings
        self._scheduler.add_job(
            self._collect_metrics,
            "interval",
            seconds=5,
            id="metrics",
            max_instances=1,
            coalesce=True,
        )

        # Job 2: OS event log collection — checks every 5 seconds, throttles based on dynamic settings
        self._scheduler.add_job(
            self._collect_events,
            "interval",
            seconds=5,
            id="events",
            max_instances=1,
            coalesce=True,
        )

        # Job 3: Recalculate health score — every 5 minutes
        self._scheduler.add_job(
            self._update_health_score,
            "interval",
            minutes=5,
            id="health_score",
            max_instances=1,
            coalesce=True,
        )

        # Job 4: Security analysis pass — every 5 minutes
        self._scheduler.add_job(
            self._run_security_analysis,
            "interval",
            minutes=5,
            id="security",
            max_instances=1,
            coalesce=True,
        )

        # Job 5: Predictive analytics — every hour (Phase 9 implementation)
        self._scheduler.add_job(
            self._run_predictions,
            "interval",
            hours=1,
            id="predictions",
            max_instances=1,
            coalesce=True,
        )

        # Job 6: Daily report generation — 8 AM UTC (Phase 10 implementation)
        self._scheduler.add_job(
            self._generate_daily_report,
            "cron",
            hour=8,
            minute=0,
            id="daily_report",
            max_instances=1,
        )

        # Job 7: Data cleanup (purge records older than retention period) — 3 AM UTC
        self._scheduler.add_job(
            self._cleanup_old_data,
            "cron",
            hour=3,
            minute=0,
            id="cleanup",
            max_instances=1,
        )

        logger.info("scheduler.jobs_registered", count=self.TOTAL_JOBS)

    # ── Job Implementations ────────────────────────────────────────────────────

    async def _collect_metrics(self) -> None:
        """Collect hardware/performance metrics via orchestrator (dynamically throttled)."""
        import time
        now = time.time()
        interval = SettingsManager.get_instance().get_int("metrics_interval_seconds", 30)
        if now - self._last_metrics_run < interval:
            return
        self._last_metrics_run = now
        
        try:
            async with self._session_factory() as session:
                results = await self._orchestrator.run_metric_collectors(session)
                logger.debug("scheduler.metrics_collected", results=len(results))
        except Exception:
            logger.exception("scheduler.metrics_collection_failed")

    async def _collect_events(self) -> None:
        """Collect OS event logs (dynamically throttled)."""
        import time
        now = time.time()
        interval = SettingsManager.get_instance().get_int("event_poll_interval_seconds", 60)
        if now - self._last_events_run < interval:
            return
        self._last_events_run = now

        try:
            async with self._session_factory() as session:
                raw_events = await self._orchestrator.run_event_collectors(session)
                if raw_events:
                    processed = await self._pipeline.process_batch(raw_events, session)
                    logger.info("scheduler.events_processed", count=len(processed))
        except Exception:
            logger.exception("scheduler.event_collection_failed")

    async def _update_health_score(self) -> None:
        """Recalculate and persist the health score."""
        try:
            async with self._session_factory() as session:
                record = await self._health_engine.calculate_and_store(session)
                await self._bus.publish(Events.HEALTH_SCORE_UPDATED, record)
        except Exception:
            logger.exception("scheduler.health_score_update_failed")

    async def _run_security_analysis(self) -> None:
        """
        Periodic security sweep — looks for threats missed by the real-time
        subscriber (e.g. events collected while app was offline).
        Phase 6: will also invoke AI for anomaly narrative.
        """
        logger.debug("scheduler.security_analysis_running")

    async def _run_predictions(self) -> None:
        """
        Hourly predictive analytics pass.
        Runs the PredictionEngine.
        """
        try:
            from app.engines.prediction_engine import PredictionEngine
            async with self._session_factory() as session:
                engine = PredictionEngine()
                await engine.run(session)
        except Exception:
            logger.exception("scheduler.predictions_failed")

    async def _generate_daily_report(self) -> None:
        """
        Generate and store the daily health report.
        Phase 10 will implement the full report generator.
        """
        logger.debug("scheduler.daily_report_generating")

    async def _cleanup_old_data(self) -> None:
        """
        Purge events and metrics older than the configured retention period.
        Runs nightly at 3 AM UTC.
        """
        try:
            from datetime import datetime, timedelta

            from sqlalchemy import delete

            from app.models.event import EventModel
            from app.models.health_score import HealthScoreModel

            event_retention = SettingsManager.get_instance().get_int("event_retention_days", 90)
            metric_retention = SettingsManager.get_instance().get_int("metric_retention_days", 30)

            event_cutoff = datetime.now(tz=UTC) - timedelta(days=event_retention)
            metric_cutoff = datetime.now(tz=UTC) - timedelta(days=metric_retention)

            async with self._session_factory() as session:
                await session.execute(
                    delete(EventModel).where(EventModel.occurred_at < event_cutoff)
                )
                await session.execute(
                    delete(HealthScoreModel).where(HealthScoreModel.timestamp < metric_cutoff)
                )
                await session.commit()
                logger.info(
                    "scheduler.cleanup_complete",
                    event_cutoff=event_cutoff.isoformat(),
                    metric_cutoff=metric_cutoff.isoformat(),
                )
        except Exception:
            logger.exception("scheduler.cleanup_failed")

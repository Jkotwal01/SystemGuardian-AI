"""
SystemGuardian AI — FastAPI Application Entry Point

Lifecycle:
    startup  → DatabaseManager.initialize → run migrations → init orchestrator
             → create pipeline → init engines → start scheduler → mount API
    shutdown → stop scheduler → close DB connections
"""

from __future__ import annotations

import asyncio
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

import structlog
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1 import v1_router
from app.api.v1.ai_status import router as ai_status_router
from app.api.v1.events import router as events_router
from app.api.v1.health_score import router as health_router
from app.api.v1.incidents import router as incidents_router
from app.api.v1.metrics import router as metrics_router
from app.api.v1.security import router as security_router
from app.api.websocket import setup_websocket_bridge, ws_router
from app.ai.explanation_engine import ExplanationEngine
from app.ai.fallback_provider import FallbackAIProvider
from app.ai.providers.gemini import GeminiProvider
from app.ai.providers.ollama import OllamaProvider
from app.collectors.orchestrator import CollectorOrchestrator
from app.config import get_settings
from app.core.database import DatabaseManager
from app.core.event_bus import event_bus
from app.core.scheduler import MonitoringScheduler
from app.engines.health_score import HealthScoreEngine
from app.engines.security import SecurityEngine
from app.processors.pipeline import create_default_pipeline

logger = structlog.get_logger()

# Module-level singletons (initialized in lifespan)
_orchestrator: CollectorOrchestrator | None = None
_scheduler: MonitoringScheduler | None = None


def get_orchestrator() -> CollectorOrchestrator:
    """Dependency injector for the CollectorOrchestrator."""
    if _orchestrator is None:
        raise RuntimeError("CollectorOrchestrator not initialized. Is the app started?")
    return _orchestrator


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Application lifespan handler — startup and shutdown logic."""
    global _orchestrator, _scheduler  # noqa: PLW0603

    settings = get_settings()
    logger.info("system_guardian_starting", version="0.1.0")

    # ── Phase 1: Database ─────────────────────────────────────────────────────
    await DatabaseManager.initialize(settings.db_path)
    logger.info("database_initialized", db_path=str(settings.db_path))

    # ── Phase 2: Collector Orchestrator ───────────────────────────────────────
    session_factory = DatabaseManager.get_session_factory()
    _orchestrator = CollectorOrchestrator(settings, session_factory)
    await _orchestrator.initialize()
    logger.info("orchestrator_initialized", collectors=_orchestrator.collector_count)

    # ── Phase 3: Processing Pipeline + Engines + Scheduler ─────────────────────
    # ── Phase 6: AI Integration Layer ────────────────────────────────
    ai_provider = FallbackAIProvider([
        OllamaProvider(),
        GeminiProvider(),
    ])
    explanation_engine = ExplanationEngine(ai_provider, session_factory)
    logger.info("ai_provider_initialized", providers=["ollama", "gemini"])

    pipeline = create_default_pipeline(event_bus, explanation_engine=explanation_engine)

    health_engine = HealthScoreEngine()

    # Security engine auto-subscribes to EVENT_PROCESSED on the bus
    _security_engine = SecurityEngine(event_bus, session_factory)  # noqa: F841

    _scheduler = MonitoringScheduler(
        settings=settings,
        orchestrator=_orchestrator,
        pipeline=pipeline,
        health_engine=health_engine,
        event_bus=event_bus,
        session_factory=session_factory,
    )
    _scheduler.start()
    # Set up WebSocket EventBus bridge
    asyncio.create_task(setup_websocket_bridge())
    logger.info("scheduler_started", jobs=_scheduler.get_job_ids())

    logger.info("system_guardian_ready")
    yield

    # ── Shutdown ──────────────────────────────────────────────────────────────
    logger.info("system_guardian_stopping")
    if _scheduler is not None:
        _scheduler.shutdown()
    await DatabaseManager.close()
    logger.info("system_guardian_stopped")


def create_app() -> FastAPI:
    """Application factory. Returns a configured FastAPI instance."""
    application = FastAPI(
        title="SystemGuardian AI",
        description="AI-powered OS intelligence platform — local API",
        version="0.3.0",
        docs_url="/docs",
        redoc_url="/redoc",
        lifespan=lifespan,
    )

    # CORS: only allow the Tauri frontend origin
    application.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:3000", "tauri://localhost"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # ── Health endpoints ──────────────────────────────────────────────────────

    @application.get("/health", tags=["system"])
    async def health() -> dict[str, str]:
        return {"status": "ok", "version": "0.3.0"}

    @application.get("/health/collectors", tags=["system"])
    async def collector_health() -> dict[str, object]:
        """Per-collector health check — returns True/False per collector."""
        orch = get_orchestrator()
        checks = await orch.health_check_all()
        all_ok = all(checks.values()) if checks else True
        return {
            "status": "ok" if all_ok else "degraded",
            "collectors": checks,
        }

    # ── API v1 routers ────────────────────────────────────────────────────────
    # API Routers
    application.include_router(events_router, prefix="/api/v1")
    application.include_router(incidents_router, prefix="/api/v1")
    application.include_router(health_router, prefix="/api/v1")
    application.include_router(metrics_router, prefix="/api/v1")
    application.include_router(security_router, prefix="/api/v1")
    application.include_router(ai_status_router, prefix="/api/v1")
    application.include_router(ws_router)

    return application


app = create_app()

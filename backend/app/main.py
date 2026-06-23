"""
SystemGuardian AI — FastAPI Application Entry Point

Lifecycle:
    startup  → DatabaseManager.initialize → run migrations → start orchestrator
    shutdown → stop orchestrator → close DB connections
"""

from __future__ import annotations

from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

import structlog
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.collectors.orchestrator import CollectorOrchestrator
from app.config import get_settings
from app.core.database import DatabaseManager

logger = structlog.get_logger()

# Module-level orchestrator instance (initialized in lifespan)
_orchestrator: CollectorOrchestrator | None = None


def get_orchestrator() -> CollectorOrchestrator:
    """Dependency injector for the CollectorOrchestrator."""
    if _orchestrator is None:
        raise RuntimeError("CollectorOrchestrator not initialized. Is the app started?")
    return _orchestrator


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Application lifespan handler — startup and shutdown logic."""
    global _orchestrator  # noqa: PLW0603

    settings = get_settings()
    logger.info("system_guardian_starting", version="0.1.0")

    # Phase 1: Initialize database and run migrations
    await DatabaseManager.initialize(settings.db_path)
    logger.info("database_initialized", db_path=str(settings.db_path))

    # Phase 2: Initialize collector orchestrator
    session_factory = DatabaseManager.get_session_factory()
    _orchestrator = CollectorOrchestrator(settings, session_factory)
    await _orchestrator.initialize()
    logger.info("orchestrator_initialized", collectors=_orchestrator.collector_count)

    # Phase 3: scheduler (implemented in Phase 3)
    # scheduler.start()

    logger.info("system_guardian_ready")
    yield

    # ── Shutdown ─────────────────────────────────────────────────────────────
    logger.info("system_guardian_stopping")
    # scheduler.shutdown()
    await DatabaseManager.close()
    logger.info("system_guardian_stopped")


def create_app() -> FastAPI:
    """Application factory. Returns a configured FastAPI instance."""
    application = FastAPI(
        title="SystemGuardian AI",
        description="AI-powered OS intelligence platform — local API",
        version="0.1.0",
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
        return {"status": "ok", "version": "0.1.0"}

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

    # API routers registered here as each phase adds them
    # from app.api.v1 import events_router
    # application.include_router(events_router, prefix="/api/v1")

    return application


app = create_app()

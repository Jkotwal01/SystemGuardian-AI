"""
SystemGuardian AI — FastAPI Application Entry Point

Lifecycle:
    startup  → DatabaseManager.initialize → run migrations → start scheduler
    shutdown → stop scheduler → close DB connections
"""

from __future__ import annotations

from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

import structlog
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

logger = structlog.get_logger()


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Application lifespan handler — startup and shutdown logic."""
    logger.info("system_guardian_starting")

    # Phase 1: database + migrations (implemented in Phase 1)
    # await DatabaseManager.initialize(settings.db_path)

    # Phase 2: collector orchestrator (implemented in Phase 2)
    # await orchestrator.initialize()

    # Phase 3: scheduler (implemented in Phase 3)
    # scheduler.start()

    logger.info("system_guardian_ready")
    yield

    # Shutdown
    logger.info("system_guardian_stopping")
    # scheduler.shutdown()
    # await DatabaseManager.close()
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

    # Health check (available from Phase 0)
    @application.get("/health", tags=["system"])
    async def health() -> dict[str, str]:
        return {"status": "ok", "version": "0.1.0"}

    # API routers are registered here as each phase adds them
    # from app.api.v1 import health_router, events_router ...
    # application.include_router(health_router, prefix="/api/v1")

    return application


app = create_app()

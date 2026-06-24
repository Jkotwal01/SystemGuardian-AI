"""API v1 package — aggregates all v1 routers into a single router."""

from fastapi import APIRouter

from app.api.v1.events import router as events_router
from app.api.v1.health_score import router as health_score_router
from app.api.v1.incidents import router as incidents_router

# Combined router — included in main.py under /api/v1
v1_router = APIRouter(prefix="/api/v1")
v1_router.include_router(events_router)
v1_router.include_router(incidents_router)
v1_router.include_router(health_score_router)

__all__ = ["v1_router"]

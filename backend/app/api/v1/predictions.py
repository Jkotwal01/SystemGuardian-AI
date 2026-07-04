from collections.abc import AsyncGenerator
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import DatabaseManager
from app.repositories.prediction_repository import PredictionRepository
from app.engines.prediction_engine import PredictionEngine

router = APIRouter(prefix="/predictions", tags=["predictions"])

async def get_session() -> AsyncGenerator[AsyncSession, None]:
    async with DatabaseManager.get_session_factory()() as session:
        yield session

@router.get("")
@router.get("/")
async def get_active_predictions(db: AsyncSession = Depends(get_session)):
    """Get all active predictions."""
    repo = PredictionRepository(db)
    predictions = await repo.get_active_predictions(min_probability=0.1)
    
    # We should return a list of dictionaries since we don't have a specific schema yet
    # FastAPI can serialize SQLAlchemy models if we are careful, or we map them to dicts
    return [{
        "id": p.id,
        "component": p.component,
        "failure_probability": p.failure_probability,
        "predicted_time_to_failure_hours": p.predicted_time_to_failure_hours,
        "severity": p.severity,
        "reason": p.reason,
        "metrics_snapshot": p.metrics_snapshot,
        "generated_at": p.generated_at
    } for p in predictions]

@router.post("/run")
async def run_predictions(db: AsyncSession = Depends(get_session)):
    """Manually trigger the prediction engine (for testing)."""
    engine = PredictionEngine()
    await engine.run(db)
    return {"status": "success", "message": "Prediction engine run completed"}

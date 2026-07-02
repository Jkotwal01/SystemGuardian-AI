import structlog
from sqlalchemy.ext.asyncio import AsyncSession
from app.engines.predictors.base import PredictorRegistry
from app.repositories.prediction_repository import PredictionRepository
from app.core.event_bus import event_bus

# Import predictors so they register themselves
import app.engines.predictors.storage_exhaustion
import app.engines.predictors.memory_exhaustion

logger = structlog.get_logger(__name__)

class PredictionEngine:
    """Orchestrates all predictive analytics modules."""

    async def run(self, session: AsyncSession) -> None:
        """Runs all registered predictors and persists results."""
        logger.info("prediction_engine_started")
        
        predictors = PredictorRegistry.get_all()
        repo = PredictionRepository(session)
        
        predictions_generated = 0
        for PredictorClass in predictors:
            predictor = PredictorClass()
            try:
                prediction = await predictor.predict(session)
                if prediction:
                    await repo.save(prediction)
                    await event_bus.publish("prediction.generated", prediction)
                    predictions_generated += 1
            except Exception as e:
                logger.error("predictor_failed", predictor=predictor.name, error=str(e), exc_info=True)
                
        logger.info("prediction_engine_completed", predictions_generated=predictions_generated)


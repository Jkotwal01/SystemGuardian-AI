from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.enums import EventCategory, Severity
from app.engines.predictors.base import BasePredictor, PredictorRegistry
from app.models.prediction import PredictionModel
from app.repositories.metric_repository import HardwareMetricRepository


@PredictorRegistry.register
class MemoryExhaustionPredictor(BasePredictor):
    name = "memory_exhaustion"
    prediction_type = "memory_exhaustion"

    async def predict(self, session: AsyncSession) -> PredictionModel | None:
        hw_repo = HardwareMetricRepository(session)
        recent_metrics = await hw_repo.get_recent(limit=100)

        if len(recent_metrics) < 5:
            return None

        recent_metrics.sort(key=lambda m: m.timestamp)

        usage_history = [m.memory_usage_percent for m in recent_metrics]
        trend = self._linear_trend(usage_history)

        if trend.slope <= 0.05:
            return None

        current_usage = usage_history[-1]
        remaining_percent = 95.0 - current_usage

        if remaining_percent <= 0:
            return None

        points_to_failure = remaining_percent / trend.slope
        hours_to_failure = points_to_failure

        probability = min(trend.r_squared * 0.7 + (current_usage / 100) * 0.3, 0.95)
        severity = Severity.HIGH if hours_to_failure < 12 else Severity.MEDIUM

        return PredictionModel(
            component=EventCategory.PERFORMANCE,
            failure_probability=probability,
            predicted_time_to_failure_hours=float(hours_to_failure),
            severity=severity,
            reason=f"Memory usage growing steadily. Expected to hit 95% in {hours_to_failure:.1f} hours.",
            metrics_snapshot={
                "current_usage": current_usage,
                "slope": trend.slope,
                "r_squared": trend.r_squared,
            },
        )

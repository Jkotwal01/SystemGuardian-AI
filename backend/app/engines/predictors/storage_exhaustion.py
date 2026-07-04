from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.enums import EventCategory, Severity
from app.engines.predictors.base import BasePredictor, PredictorRegistry
from app.models.prediction import PredictionModel
from app.repositories.metric_repository import DiskMetricRepository


@PredictorRegistry.register
class StorageExhaustionPredictor(BasePredictor):
    name = "storage_exhaustion"
    prediction_type = "storage_exhaustion"

    async def predict(self, session: AsyncSession) -> PredictionModel | None:
        disk_repo = DiskMetricRepository(session)
        # Getting recent metrics (in a real system we'd get them grouped by disk over days)
        # We will use the get_recent and look at usage_percent
        recent_metrics = await disk_repo.get_recent(limit=100)

        if len(recent_metrics) < 5:
            return None

        # Sort chronological (oldest to newest) to analyze trend
        recent_metrics.sort(key=lambda m: m.timestamp)

        usage_history = [m.usage_percent for m in recent_metrics]
        trend = self._linear_trend(usage_history)

        # If trend is negative or flat, no exhaustion predicted
        if trend.slope <= 0.01:
            return None

        # Predict time to reach 99% usage
        current_usage = usage_history[-1]
        remaining_percent = 99.0 - current_usage

        if remaining_percent <= 0:
            return None  # Already full

        # slope is percent per data point. Let's assume data points are roughly hourly.
        # So points to failure = remaining / slope
        points_to_failure = remaining_percent / trend.slope

        # We assume 1 point = 1 hour for simplicity in this implementation
        hours_to_failure = points_to_failure

        # We cap probability at 0.95
        probability = min(trend.r_squared * 0.8 + (current_usage / 100) * 0.2, 0.95)

        severity = Severity.HIGH if hours_to_failure < 48 else Severity.MEDIUM

        return PredictionModel(
            component=EventCategory.STORAGE,
            failure_probability=probability,
            predicted_time_to_failure_hours=float(hours_to_failure),
            severity=severity,
            reason=f"Storage usage growing at {trend.slope:.2f}% per hour. Expected to exhaust in {hours_to_failure:.1f} hours.",
            metrics_snapshot={
                "current_usage": current_usage,
                "slope": trend.slope,
                "r_squared": trend.r_squared,
            },
        )

from abc import ABC, abstractmethod
from typing import Type
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.prediction import PredictionModel

class TrendResult(BaseModel):
    slope: float
    r_squared: float
    predicted_next: float

class BasePredictor(ABC):
    name: str
    prediction_type: str

    @abstractmethod
    async def predict(self, session: AsyncSession) -> PredictionModel | None:
        """Returns a prediction if the threshold is met, otherwise None."""
        ...

    def _linear_trend(self, values: list[float]) -> TrendResult:
        """Shared trend calculation — no duplication across predictors."""
        n = len(values)
        if n < 3:
            return TrendResult(slope=0.0, r_squared=0.0, predicted_next=values[-1] if values else 0.0)

        # Simple linear regression without scipy
        x_mean = sum(range(n)) / n
        y_mean = sum(values) / n

        numerator = sum((x - x_mean) * (y - y_mean) for x, y in zip(range(n), values))
        denominator = sum((x - x_mean) ** 2 for x in range(n))

        if denominator == 0:
            return TrendResult(slope=0.0, r_squared=0.0, predicted_next=y_mean)

        slope = numerator / denominator
        intercept = y_mean - slope * x_mean

        # Calculate R-squared
        ss_tot = sum((y - y_mean) ** 2 for y in values)
        ss_res = sum((y - (intercept + slope * x)) ** 2 for x, y in zip(range(n), values))
        
        r_squared = 1.0 - (ss_res / ss_tot) if ss_tot != 0 else 0.0
        predicted_next = intercept + slope * n

        return TrendResult(
            slope=float(slope),
            r_squared=float(r_squared),
            predicted_next=float(predicted_next),
        )


class PredictorRegistry:
    """
    Central registry for all predictors.
    """
    _predictors: dict[str, Type[BasePredictor]] = {}

    @classmethod
    def register(cls, predictor_class: Type[BasePredictor]) -> Type[BasePredictor]:
        cls._predictors[predictor_class.name] = predictor_class
        return predictor_class

    @classmethod
    def get_all(cls) -> list[Type[BasePredictor]]:
        return list(cls._predictors.values())

"""Collectors package — exports top-level abstractions."""

from app.collectors.base import BaseCollector, CollectorResult, CollectorState
from app.collectors.normalizer import EventNormalizerMixin
from app.collectors.orchestrator import CollectorOrchestrator
from app.collectors.registry import CollectorRegistry

__all__ = [
    "BaseCollector",
    "CollectorResult",
    "CollectorState",
    "EventNormalizerMixin",
    "CollectorOrchestrator",
    "CollectorRegistry",
]

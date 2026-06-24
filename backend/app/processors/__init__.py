"""Processors package — exports public API."""

from app.processors.correlator import EventCorrelator
from app.processors.enricher import EventEnricher
from app.processors.pipeline import EventProcessingPipeline, Events, create_default_pipeline
from app.processors.severity import SEVERITY_ORDER, CompositeSeverityClassifier, escalate_severity

__all__ = [
    "EventCorrelator",
    "EventEnricher",
    "EventProcessingPipeline",
    "Events",
    "create_default_pipeline",
    "CompositeSeverityClassifier",
    "SEVERITY_ORDER",
    "escalate_severity",
]

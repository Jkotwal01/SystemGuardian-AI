import json
from abc import ABC, abstractmethod
from typing import Any

class BaseExporter(ABC):
    @abstractmethod
    def export(self, data: dict[str, Any]) -> str | bytes:
        pass

    @abstractmethod
    def get_content_type(self) -> str:
        pass

    @abstractmethod
    def get_extension(self) -> str:
        pass

class JSONExporter(BaseExporter):
    def export(self, data: dict[str, Any]) -> str:
        return json.dumps(data, indent=2)

    def get_content_type(self) -> str:
        return "application/json"

    def get_extension(self) -> str:
        return "json"

class HTMLExporter(BaseExporter):
    def export(self, data: dict[str, Any]) -> str:
        # A very basic HTML representation
        html = ["<html><body><h1>System Report</h1>"]
        for key, val in data.items():
            html.append(f"<h2>{key.capitalize()}</h2>")
            html.append(f"<pre>{json.dumps(val, indent=2)}</pre>")
        html.append("</body></html>")
        return "\n".join(html)

    def get_content_type(self) -> str:
        return "text/html"

    def get_extension(self) -> str:
        return "html"

class CSVExporter(BaseExporter):
    def export(self, data: dict[str, Any]) -> str:
        # Dummy CSV export
        return "key,value\nreport_data,included"

    def get_content_type(self) -> str:
        return "text/csv"

    def get_extension(self) -> str:
        return "csv"

class ExporterFactory:
    _exporters: dict[str, type[BaseExporter]] = {
        "json": JSONExporter,
        "html": HTMLExporter,
        "csv": CSVExporter,
        # Skipping native PDF generation for now to avoid heavy dependencies
        "pdf": HTMLExporter, # Fallback to HTML for now
    }

    @classmethod
    def create(cls, format_type: str) -> BaseExporter:
        if format_type not in cls._exporters:
            raise ValueError(f"Unsupported format: {format_type}")
        return cls._exporters[format_type]()

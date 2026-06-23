from enum import StrEnum


class EventCategory(StrEnum):
    SECURITY = "security"
    PERFORMANCE = "performance"
    HARDWARE = "hardware"
    NETWORK = "network"
    APPLICATION = "application"
    STORAGE = "storage"
    DRIVER = "driver"
    POWER = "power"
    STABILITY = "stability"
    INFORMATIONAL = "informational"


class Severity(StrEnum):
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"
    INFO = "info"


class IncidentStatus(StrEnum):
    OPEN = "open"
    INVESTIGATING = "investigating"
    RESOLVED = "resolved"
    DISMISSED = "dismissed"


class AIProvider(StrEnum):
    OLLAMA = "ollama"
    GEMINI = "gemini"
    OPENAI = "openai"
    ANTHROPIC = "anthropic"


class ReportType(StrEnum):
    DAILY = "daily"
    WEEKLY = "weekly"
    MONTHLY = "monthly"
    QUARTERLY = "quarterly"

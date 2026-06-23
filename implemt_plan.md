# SystemGuardian AI — Phased Implementation Plan

> **Decisions Locked In:**
> - ✅ **Platform**: Windows-first (Linux added in Phase 13+)
> - ✅ **AI**: Ollama primary + Gemini fallback (bring-your-own-key)
> - ✅ **Ollama**: Prompt user to install — no bundling
> - ✅ **Modules**: All 8 from MVP (Security, Performance, Hardware, Network, Application, Storage, Driver, Power)
> - ✅ **Dev Environment**: Pre-installed (Node.js 20+, Rust, Python 3.11+)

---

## Design Principles (Applied Throughout Every Phase)

### System Design Principles
| Principle | Application |
|-----------|-------------|
| **Separation of Concerns** | Collectors, Processors, Engines, API, UI are independent layers |
| **Single Responsibility** | Each class/module does exactly one thing |
| **Dependency Inversion** | All engines depend on abstractions (interfaces), not implementations |
| **Open/Closed** | New collectors/engines added by extension, not modification |
| **DRY** | Base classes for collectors, processors, engines — no repeated logic |
| **Event-Driven** | Internal event bus decouples producers from consumers |
| **Repository Pattern** | All DB access via repository classes — never raw SQL in business logic |
| **Factory Pattern** | AI providers, report builders, exporters created via factories |
| **Strategy Pattern** | Severity classification, prediction algorithms are interchangeable strategies |
| **Observer Pattern** | Health score, notifications react to event stream changes |

### Code Quality Standards
- **Type safety**: Full type annotations in Python, strict TypeScript
- **Async-first**: `async/await` throughout — no blocking I/O
- **Error boundaries**: Every external call wrapped with typed error handling
- **Logging**: Structured JSON logging at every layer
- **Config-driven**: No hardcoded values — all in `Settings` or database
- **Test coverage gate**: Each phase requires ≥ 80% coverage before next phase begins

---

## Phase Overview

```
Phase 0  ── Project Foundation & Tooling                  (2 days)
Phase 1  ── Domain Layer & Database                       (4 days)
Phase 2  ── Windows Data Collection Layer                 (5 days)
Phase 3  ── Event Processing Pipeline & Engines           (5 days)
Phase 4  ── Tauri Shell & Next.js Frontend Foundation     (4 days)
Phase 5  ── Live Dashboard & Real-Time Updates            (5 days)
Phase 6  ── AI Integration Layer                          (5 days)
Phase 7  ── Incident Management & Security UI             (4 days)
Phase 8  ── AI Chat Assistant                             (3 days)
Phase 9  ── Predictive Analytics Engine                   (4 days)
Phase 10 ── Reports & Notification System                 (4 days)
Phase 11 ── Onboarding Wizard & Settings                  (3 days)
Phase 12 ── Production Build, Installer & CI/CD           (4 days)

Total: ~52 development days (~10-12 weeks)
```

---

## Phase 0 — Project Foundation & Tooling

> **Goal**: One command starts the entire dev environment. CI pipeline runs on every commit.

### 0.1 — Monorepo Structure

```
system-guardian-ai/
├── .github/
│   └── workflows/
│       ├── ci.yml              # Runs on every PR
│       ├── build-windows.yml   # Builds installer (on tag)
│       └── release.yml         # Creates GitHub Release
├── apps/
│   └── desktop/
│       ├── src-tauri/          # Rust / Tauri
│       └── frontend/           # Next.js
├── backend/                    # FastAPI Python
├── shared/
│   └── types/                  # Shared TypeScript types (auto-generated from Pydantic)
├── scripts/
│   ├── dev.ps1                 # Start all services for dev
│   ├── test.ps1                # Run all tests
│   └── build.ps1               # Production build
├── docs/
├── .gitignore
├── .editorconfig
└── README.md
```

### 0.2 — Tooling & Configuration

**Root `package.json`** (npm workspaces):
```json
{
  "name": "system-guardian-ai",
  "private": true,
  "workspaces": ["apps/desktop/frontend"],
  "scripts": {
    "dev": "pwsh scripts/dev.ps1",
    "test": "pwsh scripts/test.ps1",
    "build": "pwsh scripts/build.ps1"
  }
}
```

**`scripts/dev.ps1`** — single command for full dev start:
```powershell
# Start FastAPI backend
Start-Process pwsh -ArgumentList "-c", "cd backend; python -m uvicorn app.main:app --reload --port 8765"
# Start Next.js frontend
Start-Process pwsh -ArgumentList "-c", "cd apps/desktop/frontend; npm run dev"
# Start Tauri dev window (waits for above)
Start-Sleep 3
cd apps/desktop; cargo tauri dev
```

**`backend/pyproject.toml`**:
```toml
[tool.pytest.ini_options]
asyncio_mode = "auto"
testpaths = ["tests"]
addopts = "--cov=app --cov-report=term-missing --cov-fail-under=80"

[tool.ruff]
select = ["E", "F", "UP", "B", "I"]
line-length = 100

[tool.mypy]
strict = true
```

**`.github/workflows/ci.yml`**:
```yaml
name: CI
on: [push, pull_request]
jobs:
  backend-tests:
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with: { python-version: '3.11' }
      - run: pip install -e ".[dev]"
        working-directory: backend
      - run: pytest
        working-directory: backend

  frontend-checks:
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - run: npm ci
        working-directory: apps/desktop/frontend
      - run: npx tsc --noEmit
        working-directory: apps/desktop/frontend
      - run: npm run lint
        working-directory: apps/desktop/frontend
```

### 0.3 — Phase 0 Test Gate

| Test | Command | Must Pass |
|------|---------|-----------|
| Python environment installs cleanly | `pip install -e ".[dev]"` | ✅ |
| Node.js deps install cleanly | `npm ci` | ✅ |
| Rust compiles | `cargo check` | ✅ |
| CI workflow runs on push | GitHub Actions green | ✅ |

---

## Phase 1 — Domain Layer & Database

> **Goal**: The complete data model, ORM layer, and repository abstractions exist and are fully tested. Zero business logic yet — only the data contracts.

### Design Principle: Repository Pattern + Domain Entities

```
Domain Entity (Pydantic)  ←→  ORM Model (SQLAlchemy)  ←→  Repository
     ↑                                                        ↑
 Used by API                                         Used by Engines
 & Schemas                                           & Collectors
```

No raw SQL anywhere except migrations. All queries live in repository classes.

### 1.1 — Base Abstractions

**`backend/app/core/database.py`**:
```python
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase

class Base(DeclarativeBase):
    """All ORM models inherit from this single base."""
    pass

class DatabaseManager:
    """Singleton. Manages engine lifecycle and session factory."""
    _engine: AsyncEngine | None = None
    _session_factory: async_sessionmaker | None = None

    @classmethod
    async def initialize(cls, db_path: Path) -> None: ...

    @classmethod
    def get_session(cls) -> AsyncSession: ...
```

**`backend/app/core/repository.py`** — Generic base repository:
```python
from typing import Generic, TypeVar, Type
from sqlalchemy import select, func
T = TypeVar("T")

class BaseRepository(Generic[T]):
    """
    Generic async repository. Provides CRUD for any ORM model.
    All domain-specific queries live in subclasses.
    """
    model: Type[T]

    def __init__(self, session: AsyncSession):
        self._session = session

    async def get_by_id(self, id: str) -> T | None: ...
    async def get_all(self, limit: int = 100, offset: int = 0) -> list[T]: ...
    async def save(self, entity: T) -> T: ...
    async def delete(self, id: str) -> bool: ...
    async def count(self) -> int: ...
```

### 1.2 — ORM Models (10 models)

All models in `backend/app/models/`. Each inherits from `Base`.

**`backend/app/models/event.py`**:
```python
class EventModel(Base):
    __tablename__ = "events"
    id: Mapped[str] = mapped_column(primary_key=True, default=uuid4_hex)
    source: Mapped[str]
    source_id: Mapped[str | None]
    category: Mapped[EventCategory]   # Enum
    severity: Mapped[Severity]        # Enum
    title: Mapped[str]
    raw_data: Mapped[dict] = mapped_column(JSON)
    normalized_data: Mapped[dict] = mapped_column(JSON)
    occurred_at: Mapped[datetime]
    collected_at: Mapped[datetime] = mapped_column(default=func.now())
    incident_id: Mapped[str | None] = mapped_column(ForeignKey("incidents.id"))
    metadata_: Mapped[dict | None] = mapped_column(JSON, name="metadata")
```

**Models to create** (each follows same pattern):
- `EventModel` — raw + normalized OS events
- `IncidentModel` — correlated event groups
- `AIInsightModel` — AI-generated explanations
- `HardwareMetricModel` — time-series hardware data
- `DiskMetricModel` — per-disk metrics
- `NetworkMetricModel` — per-interface metrics
- `PredictionModel` — predictive analysis results
- `HealthScoreModel` — historical scores
- `ReportModel` — generated reports
- `NotificationModel` — notification history
- `ChatMessageModel` — AI chat history
- `SettingModel` — key-value settings store

### 1.3 — Enums & Domain Types

**`backend/app/domain/enums.py`**:
```python
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
```

### 1.4 — Pydantic Schemas (API contracts)

**`backend/app/schemas/`** — Pure Pydantic v2 models (no SQLAlchemy dependency):
```python
# schemas/event.py
class EventBase(BaseModel):
    source: str
    category: EventCategory
    severity: Severity
    title: str

class EventCreate(EventBase):
    raw_data: dict
    occurred_at: datetime

class EventRead(EventBase):
    id: str
    occurred_at: datetime
    collected_at: datetime
    incident_id: str | None
    ai_insight: AIInsightRead | None = None

    model_config = ConfigDict(from_attributes=True)

class EventListResponse(BaseModel):
    items: list[EventRead]
    total: int
    page: int
    per_page: int
```

### 1.5 — Domain Repositories

**`backend/app/repositories/event_repository.py`**:
```python
class EventRepository(BaseRepository[EventModel]):
    model = EventModel

    async def get_by_severity(
        self, severity: Severity, limit: int = 50
    ) -> list[EventModel]:
        stmt = select(EventModel).where(
            EventModel.severity == severity
        ).order_by(desc(EventModel.occurred_at)).limit(limit)
        ...

    async def get_since(self, since: datetime) -> list[EventModel]:
        ...

    async def get_by_category(
        self, category: EventCategory, hours: int = 24
    ) -> list[EventModel]:
        ...

    async def count_by_severity_today(self) -> dict[Severity, int]:
        ...
```

Repositories for all 12 models follow identical pattern.

### 1.6 — Alembic Migrations

```
backend/alembic/
├── env.py
├── versions/
│   └── 0001_initial_schema.py   # All 12 tables
└── alembic.ini
```

Auto-run on startup: `await run_migrations()` in lifespan.

### 1.7 — Configuration

**`backend/app/config.py`** (single source of truth):
```python
class Settings(BaseSettings):
    # Computed paths
    @computed_field
    @property
    def db_path(self) -> Path:
        return Path(os.environ.get("APPDATA", Path.home())) \
               / "SystemGuardian" / "data.db"

    @computed_field
    @property
    def logs_dir(self) -> Path:
        return Path(os.environ.get("APPDATA", Path.home())) \
               / "SystemGuardian" / "logs"

    # App
    DEBUG: bool = False
    LOG_LEVEL: str = "INFO"

    # Backend
    BACKEND_HOST: str = "127.0.0.1"
    BACKEND_PORT: int = 8765

    # Monitoring
    METRICS_INTERVAL_SECONDS: int = 30
    EVENT_POLL_INTERVAL_SECONDS: int = 60
    ENABLED_MODULES: list[str] = Field(default_factory=lambda: [
        "security","performance","hardware","network",
        "application","storage","driver","power"
    ])

    # AI
    AI_PROVIDER: AIProvider = AIProvider.OLLAMA
    OLLAMA_BASE_URL: str = "http://localhost:11434"
    OLLAMA_MODEL: str = "llama3.2"
    GEMINI_API_KEY: str = ""
    AI_TIMEOUT_SECONDS: int = 60
    AI_FALLBACK_ENABLED: bool = True  # Ollama → Gemini fallback

    # Data retention
    EVENT_RETENTION_DAYS: int = 90
    METRIC_RETENTION_DAYS: int = 30

    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", extra="ignore"
    )

@lru_cache
def get_settings() -> Settings:
    return Settings()
```

### 1.8 — Phase 1 Tests

**`backend/tests/test_models.py`**:
```python
async def test_event_model_create(db_session):
    """Event model persists and retrieves correctly."""

async def test_event_repository_get_by_severity(db_session):
    """Repository filters by severity correctly."""

async def test_health_score_repository_history(db_session):
    """Historical health scores returned in order."""

async def test_settings_model_roundtrip(db_session):
    """Settings key-value store reads back correctly."""
```

### Phase 1 Gate — Must Pass Before Phase 2

| Check | Target |
|-------|--------|
| All 12 ORM models create tables cleanly | ✅ |
| Alembic migration runs on fresh DB | ✅ |
| All repositories: CRUD operations pass | ✅ |
| Pydantic schemas serialize/deserialize correctly | ✅ |
| `pytest` coverage on `app/models/`, `app/repositories/`, `app/schemas/` | ≥ 90% |
| `mypy --strict` passes | ✅ |

---

## Phase 2 — Windows Data Collection Layer

> **Goal**: All 8 monitoring modules collect real data from Windows. Data flows into the database. No UI yet.

### Design Principle: Abstract Collector Base + Strategy Pattern

```
BaseCollector (ABC)
    ├── SecurityCollector
    ├── PerformanceCollector
    ├── HardwareCollector
    ├── NetworkCollector
    ├── ApplicationCollector
    ├── StorageCollector
    ├── DriverCollector
    └── PowerCollector

CollectorRegistry → discovers + manages all active collectors
CollectorOrchestrator → schedules + coordinates all collectors
```

### 2.1 — Base Collector Abstraction

**`backend/app/collectors/base.py`**:
```python
from abc import ABC, abstractmethod
from dataclasses import dataclass
import structlog

logger = structlog.get_logger()

@dataclass
class CollectorResult:
    collector_name: str
    events_collected: int
    errors: list[str]
    duration_ms: float

class BaseCollector(ABC):
    """
    Abstract base for all OS data collectors.
    Subclasses implement _collect() only.
    Base class handles: timing, error handling, logging, metrics.
    """
    name: str         # Must define in subclass
    module: str       # EventCategory value
    enabled: bool = True

    def __init__(self, settings: Settings, db_session: AsyncSession):
        self._settings = settings
        self._session = db_session
        self._repo = EventRepository(db_session)
        self._logger = logger.bind(collector=self.name)

    async def run(self) -> CollectorResult:
        """Template method — handles all cross-cutting concerns."""
        if not self.enabled:
            return CollectorResult(self.name, 0, [], 0)

        start = time.perf_counter()
        errors = []
        count = 0

        try:
            events = await self._collect()
            for event in events:
                await self._repo.save(event)
                count += 1
        except PermissionError as e:
            errors.append(f"Permission denied: {e}")
            self._logger.warning("permission_error", error=str(e))
        except Exception as e:
            errors.append(str(e))
            self._logger.error("collection_failed", error=str(e), exc_info=True)

        duration = (time.perf_counter() - start) * 1000
        self._logger.info("collection_complete", count=count, duration_ms=duration)
        return CollectorResult(self.name, count, errors, duration)

    @abstractmethod
    async def _collect(self) -> list[EventModel]:
        """Subclass implements this. Must return normalized EventModel list."""
        ...

    @abstractmethod
    async def health_check(self) -> bool:
        """Returns True if collector can successfully access its data source."""
        ...
```

### 2.2 — Event Normalization (built into each collector)

**`backend/app/collectors/normalizer.py`** — Mixin used by collectors:
```python
class EventNormalizerMixin:
    """
    Shared normalization logic. Injected into collectors via mixin.
    Converts OS-specific raw data into the unified EventModel schema.
    """
    def normalize_windows_event(
        self,
        raw: dict,
        category: EventCategory,
        severity_map: dict[int, Severity]
    ) -> EventModel:
        event_id = int(raw.get("EventID", 0))
        return EventModel(
            id=generate_uuid(),
            source="windows_event_log",
            source_id=str(event_id),
            category=category,
            severity=severity_map.get(event_id, Severity.INFO),
            title=self._get_event_title(event_id),
            raw_data=raw,
            normalized_data=self._extract_fields(raw),
            occurred_at=self._parse_event_time(raw),
        )
```

### 2.3 — Security Collector

**`backend/app/collectors/windows/security_collector.py`**:

```python
class SecurityCollector(BaseCollector, EventNormalizerMixin):
    name = "windows_security"
    module = EventCategory.SECURITY

    # Complete mapping: Event ID → (title, severity)
    EVENT_MAP: dict[int, tuple[str, Severity]] = {
        4624: ("Successful Login", Severity.INFO),
        4625: ("Failed Login Attempt", Severity.MEDIUM),
        4634: ("Logoff", Severity.INFO),
        4648: ("Login with Explicit Credentials", Severity.MEDIUM),
        4672: ("Admin Privileges Assigned", Severity.MEDIUM),
        4698: ("Scheduled Task Created", Severity.HIGH),
        4699: ("Scheduled Task Deleted", Severity.MEDIUM),
        4720: ("User Account Created", Severity.MEDIUM),
        4722: ("User Account Enabled", Severity.LOW),
        4724: ("Password Reset Attempted", Severity.MEDIUM),
        4728: ("User Added to Security Group", Severity.HIGH),
        4732: ("User Added to Administrators Group", Severity.CRITICAL),
        4740: ("Account Locked Out", Severity.HIGH),
        4756: ("User Added to Universal Group", Severity.HIGH),
        4767: ("Account Unlocked", Severity.LOW),
        1102: ("Audit Log Cleared", Severity.CRITICAL),
    }

    async def _collect(self) -> list[EventModel]:
        hand = win32evtlog.OpenEventLog(None, "Security")
        events = []
        flags = (win32evtlog.EVENTLOG_BACKWARDS_READ |
                 win32evtlog.EVENTLOG_SEQUENTIAL_READ)
        since = await self._get_last_collected_time()

        while True:
            batch = win32evtlog.ReadEventLog(hand, flags, 0)
            if not batch:
                break
            for ev in batch:
                if ev.TimeGenerated.replace(tzinfo=None) < since:
                    return events
                event_id = ev.EventID & 0xFFFF
                if event_id in self.EVENT_MAP:
                    events.append(self.normalize_windows_event(
                        raw=self._event_to_dict(ev),
                        category=EventCategory.SECURITY,
                        severity_map={id: s for id, (_, s) in self.EVENT_MAP.items()}
                    ))
        return events

    async def health_check(self) -> bool:
        try:
            h = win32evtlog.OpenEventLog(None, "Security")
            win32evtlog.CloseEventLog(h)
            return True
        except Exception:
            return False
```

### 2.4 — All 8 Collectors

Each follows identical `BaseCollector` pattern:

| Collector | Data Source | Key Events/Metrics |
|-----------|------------|-------------------|
| `SecurityCollector` | `win32evtlog` (Security) | 4625, 4740, 4728, 1102, 4698 |
| `SystemCollector` | `win32evtlog` (System) | 1001 (BSOD), 6008 (crash), 7045 (service), 41 (reboot) |
| `PerformanceCollector` | `psutil` | CPU %, RAM %, process list |
| `HardwareCollector` | `psutil` + `wmi` | Temps, fan speeds, battery |
| `NetworkCollector` | `psutil` + `win32evtlog` | I/O stats, firewall events |
| `ApplicationCollector` | `win32evtlog` (Application) | App crashes, error events |
| `StorageCollector` | `psutil` + `wmi` SMART | Disk usage, SMART data |
| `DriverCollector` | `win32evtlog` (System) | 7000, 7023, 7031, 7034 |
| `PowerCollector` | `psutil` + `wmi` | Battery, power events, sleep/wake |

### 2.5 — Collector Registry & Orchestrator

**`backend/app/collectors/registry.py`**:
```python
class CollectorRegistry:
    """
    Central registry for all collectors.
    Open/Closed: new collectors register themselves, orchestrator discovers them.
    """
    _collectors: dict[str, Type[BaseCollector]] = {}

    @classmethod
    def register(cls, collector_class: Type[BaseCollector]) -> Type[BaseCollector]:
        """Decorator to register a collector."""
        cls._collectors[collector_class.name] = collector_class
        return collector_class

    @classmethod
    def get_enabled(cls, settings: Settings) -> list[Type[BaseCollector]]:
        return [
            c for name, c in cls._collectors.items()
            if c.module in settings.ENABLED_MODULES
        ]

# Usage — just decorate the class:
@CollectorRegistry.register
class SecurityCollector(BaseCollector, EventNormalizerMixin):
    ...
```

**`backend/app/collectors/orchestrator.py`**:
```python
class CollectorOrchestrator:
    """
    Coordinates all collectors. Runs them on schedule.
    Each collector runs independently — failure in one doesn't affect others.
    """
    def __init__(self, settings: Settings, session_factory: async_sessionmaker):
        self._settings = settings
        self._session_factory = session_factory
        self._collectors: list[BaseCollector] = []

    async def initialize(self) -> None:
        collector_classes = CollectorRegistry.get_enabled(self._settings)
        async with self._session_factory() as session:
            self._collectors = [
                cls(self._settings, session)
                for cls in collector_classes
            ]
        logger.info("collectors_initialized", count=len(self._collectors))

    async def run_all(self) -> list[CollectorResult]:
        """Runs all collectors concurrently."""
        tasks = [c.run() for c in self._collectors]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        return [r for r in results if isinstance(r, CollectorResult)]

    async def health_check_all(self) -> dict[str, bool]:
        checks = {c.name: c.health_check() for c in self._collectors}
        return {name: await check for name, check in checks.items()}
```

### 2.6 — Phase 2 Tests

**`backend/tests/collectors/test_security_collector.py`**:
```python
async def test_security_collector_health_check(mock_win32evtlog):
    """Health check returns True when log is accessible."""

async def test_security_collector_normalizes_event_4625(mock_win32evtlog):
    """Failed login (4625) maps to MEDIUM severity security event."""

async def test_security_collector_normalizes_event_1102(mock_win32evtlog):
    """Audit log cleared (1102) maps to CRITICAL severity."""

async def test_collector_base_handles_permission_error_gracefully(collector):
    """PermissionError doesn't crash orchestrator."""

async def test_orchestrator_runs_all_collectors_concurrently(mock_collectors):
    """All collectors complete and return CollectorResult."""

async def test_registry_discovers_all_8_collectors():
    """CollectorRegistry finds all 8 registered collector classes."""

async def test_collector_deduplication(db_session, mock_win32evtlog):
    """Same event ID in same time window not stored twice."""
```

### Phase 2 Gate

| Check | Target |
|-------|--------|
| All 8 collectors return events in CI (mocked OS APIs) | ✅ |
| Normalization: each collector produces valid `EventModel` | ✅ |
| Registry auto-discovers all 8 collectors | ✅ |
| `health_check()` works for each collector | ✅ |
| Manual: Run on real Windows → events appear in SQLite | ✅ |
| Coverage on `app/collectors/` | ≥ 80% |

---

## Phase 3 — Event Processing Pipeline & Engines

> **Goal**: Raw events flow through a complete processing pipeline: normalize → classify severity → correlate → health score. Background scheduler runs continuously.

### Design Principle: Pipeline Pattern + Observer Pattern

```
CollectorOrchestrator
    │ produces raw EventModel
    ▼
EventProcessingPipeline
    ├── SeverityClassifier (Strategy)
    ├── EventEnricher
    ├── EventCorrelator
    └── IncidentBuilder
         │ publishes Incident
         ▼
     EventBus (Observer)
         ├── HealthScoreEngine (subscriber)
         ├── SecurityEngine (subscriber)
         └── NotificationManager (subscriber — Phase 10)
```

### 3.1 — Event Bus (Internal Pub/Sub)

**`backend/app/core/event_bus.py`**:
```python
from collections import defaultdict
from typing import Callable, Any

class EventBus:
    """
    Async in-process event bus. Decouples producers from consumers.
    Engines subscribe to event types; pipeline publishes them.
    """
    _subscribers: dict[str, list[Callable]] = defaultdict(list)

    @classmethod
    def subscribe(cls, event_type: str, handler: Callable) -> None:
        cls._subscribers[event_type].append(handler)

    @classmethod
    async def publish(cls, event_type: str, payload: Any) -> None:
        handlers = cls._subscribers.get(event_type, [])
        await asyncio.gather(*[h(payload) for h in handlers])

# Event types (constants)
class Events:
    EVENT_PROCESSED = "event.processed"
    INCIDENT_CREATED = "incident.created"
    INCIDENT_UPDATED = "incident.updated"
    HEALTH_SCORE_UPDATED = "health.score.updated"
    THREAT_DETECTED = "security.threat.detected"
    PREDICTION_GENERATED = "prediction.generated"
    NOTIFICATION_READY = "notification.ready"
```

### 3.2 — Severity Classifier (Strategy Pattern)

**`backend/app/processors/severity.py`**:
```python
class SeverityStrategy(ABC):
    @abstractmethod
    def classify(self, event: EventModel) -> Severity: ...

class WindowsEventIdSeverityStrategy(SeverityStrategy):
    """Maps Windows Event IDs to severity levels."""
    EVENT_SEVERITY_MAP: dict[str, Severity] = {
        "1102": Severity.CRITICAL,  # Audit log cleared
        "4625": Severity.MEDIUM,    # Failed login
        "4732": Severity.CRITICAL,  # Added to Administrators
        ...
    }
    def classify(self, event: EventModel) -> Severity:
        return self.EVENT_SEVERITY_MAP.get(event.source_id, Severity.INFO)

class FrequencyEscalationStrategy(SeverityStrategy):
    """
    Escalates severity based on frequency within time window.
    5+ same event in 10min → escalate by 1 level.
    """
    async def classify(self, event: EventModel) -> Severity:
        recent_count = await self._count_recent_similar(event, minutes=10)
        base_severity = event.severity
        if recent_count >= 10:
            return self._escalate(base_severity, steps=2)
        elif recent_count >= 5:
            return self._escalate(base_severity, steps=1)
        return base_severity

class CompositeSeverityClassifier:
    """Runs all strategies, takes the highest severity."""
    strategies: list[SeverityStrategy] = [
        WindowsEventIdSeverityStrategy(),
        FrequencyEscalationStrategy(),
    ]
    async def classify(self, event: EventModel) -> Severity:
        severities = [await s.classify(event) for s in self.strategies]
        return max(severities, key=lambda s: SEVERITY_ORDER[s])
```

### 3.3 — Event Correlator

**`backend/app/processors/correlator.py`**:
```python
class CorrelationRule(ABC):
    """One correlation rule. Each rule defines what constitutes a group."""
    @abstractmethod
    def matches(self, event: EventModel, candidate: EventModel) -> bool: ...

class SameUserRule(CorrelationRule):
    def matches(self, event, candidate) -> bool:
        return (event.user_name and
                event.user_name == candidate.user_name and
                event.category == candidate.category)

class SameProcessRule(CorrelationRule):
    def matches(self, event, candidate) -> bool:
        return (event.process_name and
                event.process_name == candidate.process_name)

class EventCorrelator:
    """
    Groups related events into Incidents using configurable rules.
    Time window: events within last 15 minutes are candidates.
    """
    WINDOW_MINUTES = 15
    MIN_EVENTS_FOR_INCIDENT = 2

    def __init__(self, rules: list[CorrelationRule] | None = None):
        self._rules = rules or [SameUserRule(), SameProcessRule()]

    async def correlate(
        self,
        event: EventModel,
        repo: EventRepository
    ) -> IncidentModel | None:
        candidates = await repo.get_since(
            since=event.occurred_at - timedelta(minutes=self.WINDOW_MINUTES)
        )
        related = [c for c in candidates if self._is_related(event, c)]

        if len(related) >= self.MIN_EVENTS_FOR_INCIDENT:
            return await self._build_or_update_incident(event, related)
        return None

    def _is_related(self, event: EventModel, candidate: EventModel) -> bool:
        return any(rule.matches(event, candidate) for rule in self._rules)
```

### 3.4 — Event Processing Pipeline

**`backend/app/processors/pipeline.py`**:
```python
class EventProcessingPipeline:
    """
    Orchestrates the full event processing flow.
    Each step is independently testable and replaceable.
    """
    def __init__(
        self,
        classifier: CompositeSeverityClassifier,
        enricher: EventEnricher,
        correlator: EventCorrelator,
        event_bus: EventBus,
    ):
        self._classifier = classifier
        self._enricher = enricher
        self._correlator = correlator
        self._bus = event_bus

    async def process(
        self,
        event: EventModel,
        event_repo: EventRepository,
        incident_repo: IncidentRepository,
    ) -> EventModel:
        # Step 1: Classify severity (may escalate based on frequency)
        event.severity = await self._classifier.classify(event)

        # Step 2: Enrich with context (hostname, OS version, etc.)
        event = await self._enricher.enrich(event)

        # Step 3: Save event
        await event_repo.save(event)

        # Step 4: Correlate → may create/update incident
        incident = await self._correlator.correlate(event, event_repo)
        if incident:
            await incident_repo.save(incident)
            await self._bus.publish(Events.INCIDENT_CREATED, incident)

        # Step 5: Notify observers (health engine, security engine, etc.)
        await self._bus.publish(Events.EVENT_PROCESSED, event)

        return event
```

### 3.5 — Health Score Engine

**`backend/app/engines/health_score.py`**:
```python
@dataclass
class ScoreFactors:
    security_events_24h: int
    failed_logins_24h: int
    critical_events_24h: int
    avg_cpu_1h: float
    avg_ram_1h: float
    disk_usage_pct: float
    hardware_warnings: int
    app_crashes_24h: int
    network_errors_1h: int

class HealthScoreEngine:
    """
    Computes all health scores from raw metrics.
    Each sub-score is independently calculated and testable.
    Observer: subscribes to Events.EVENT_PROCESSED.
    """
    WEIGHTS = {
        "security": 0.30,
        "performance": 0.25,
        "hardware": 0.20,
        "network": 0.15,
        "storage": 0.10,
    }

    def compute_security_score(self, factors: ScoreFactors) -> int:
        score = 100
        score -= min(factors.critical_events_24h * 15, 45)
        score -= min(factors.failed_logins_24h * 3, 20)
        score -= min(factors.security_events_24h * 1, 15)
        return max(0, score)

    def compute_performance_score(self, factors: ScoreFactors) -> int:
        score = 100
        if factors.avg_cpu_1h > 90: score -= 30
        elif factors.avg_cpu_1h > 70: score -= 15
        if factors.avg_ram_1h > 90: score -= 25
        elif factors.avg_ram_1h > 80: score -= 10
        score -= min(factors.app_crashes_24h * 5, 20)
        return max(0, score)

    def compute_overall_score(self, sub_scores: dict[str, int]) -> int:
        return int(sum(
            sub_scores[k] * w for k, w in self.WEIGHTS.items()
        ))

    async def calculate_and_store(self, session: AsyncSession) -> HealthScoreModel:
        factors = await self._gather_factors(session)
        scores = {
            "security": self.compute_security_score(factors),
            "performance": self.compute_performance_score(factors),
            "hardware": self.compute_hardware_score(factors),
            "network": self.compute_network_score(factors),
            "storage": self.compute_storage_score(factors),
        }
        overall = self.compute_overall_score(scores)
        record = HealthScoreModel(overall_score=overall, **scores)
        await HealthScoreRepository(session).save(record)
        await EventBus.publish(Events.HEALTH_SCORE_UPDATED, record)
        return record
```

### 3.6 — APScheduler Setup (Background Services)

**`backend/app/core/scheduler.py`**:
```python
class MonitoringScheduler:
    """
    All scheduled background jobs.
    Adding a new job = one method + one scheduler.add_job() call.
    """
    def __init__(self, orchestrator: CollectorOrchestrator, ...):
        self._scheduler = AsyncIOScheduler(timezone="UTC")
        self._orchestrator = orchestrator

    def start(self) -> None:
        # Hardware metrics: every 30 seconds
        self._scheduler.add_job(
            self._collect_metrics, "interval",
            seconds=30, id="metrics", max_instances=1
        )
        # Event log collection: every 60 seconds
        self._scheduler.add_job(
            self._collect_events, "interval",
            seconds=60, id="events", max_instances=1
        )
        # Health score: every 5 minutes
        self._scheduler.add_job(
            self._update_health_score, "interval",
            minutes=5, id="health_score", max_instances=1
        )
        # Security analysis: every 5 minutes
        self._scheduler.add_job(
            self._run_security_analysis, "interval",
            minutes=5, id="security", max_instances=1
        )
        # Predictions: every hour
        self._scheduler.add_job(
            self._run_predictions, "interval",
            hours=1, id="predictions", max_instances=1
        )
        # Daily report: 8 AM
        self._scheduler.add_job(
            self._generate_daily_report, "cron",
            hour=8, id="daily_report", max_instances=1
        )
        # Cleanup: 3 AM
        self._scheduler.add_job(
            self._cleanup_old_data, "cron",
            hour=3, id="cleanup", max_instances=1
        )
        self._scheduler.start()
```

### 3.7 — Phase 3 Tests

```python
async def test_severity_escalation_on_frequency():
    """5+ same events in 10 min escalates severity by 1 level."""

async def test_event_correlator_groups_related_events():
    """Events from same user within 15 min form an Incident."""

async def test_event_correlator_no_false_grouping():
    """Unrelated events don't form an incident."""

async def test_health_score_perfect_system():
    """Zero events → score = 100."""

async def test_health_score_deducts_for_critical_events():
    """1 critical event → security_score drops by 15."""

async def test_pipeline_publishes_to_event_bus():
    """processed event triggers EVENT_PROCESSED on bus."""

async def test_scheduler_initializes_all_jobs():
    """All 7 scheduled jobs are registered."""
```

### Phase 3 Gate

| Check | Target |
|-------|--------|
| Pipeline processes event end-to-end without errors | ✅ |
| Severity escalation on frequency works | ✅ |
| Incident created from 2+ related events | ✅ |
| Health score correctly deducts for events | ✅ |
| EventBus delivers to all subscribers | ✅ |
| All 7 scheduler jobs registered | ✅ |
| Coverage on `app/processors/`, `app/engines/`, `app/core/` | ≥ 80% |

---

## Phase 4 — Tauri Shell & Next.js Frontend Foundation

> **Goal**: Desktop window opens. Sidebar + routing works. Custom title bar. System tray. Backend process spawned by Tauri.

### 4.1 — Tauri Configuration & Rust

**`apps/desktop/src-tauri/tauri.conf.json`**:
```json
{
  "build": {
    "beforeDevCommand": "npm run dev --prefix frontend",
    "devUrl": "http://localhost:3000",
    "frontendDist": "../frontend/out"
  },
  "app": {
    "windows": [{
      "title": "SystemGuardian AI",
      "width": 1400, "height": 900,
      "minWidth": 1080, "minHeight": 700,
      "decorations": false,
      "transparent": true,
      "center": true
    }],
    "trayIcon": {
      "iconPath": "icons/tray.png",
      "iconAsTemplate": true,
      "menuOnLeftClick": false
    }
  }
}
```

**`src/services/backend_process.rs`**:
```rust
pub struct BackendProcess {
    child: Mutex<Option<Child>>,
    port: u16,
}

impl BackendProcess {
    pub async fn start(&self, app_handle: &AppHandle) -> Result<()> {
        let backend_path = app_handle
            .path()
            .resource_dir()?
            .join("backend")
            .join("sgai-backend.exe");  // PyInstaller exe in production

        // In dev: use Python directly
        #[cfg(debug_assertions)]
        let cmd = Command::new("python")
            .args(["-m", "uvicorn", "app.main:app",
                   "--host", "127.0.0.1", "--port", &self.port.to_string()])
            .spawn()?;

        *self.child.lock().await = Some(cmd);
        self.wait_for_ready().await
    }

    async fn wait_for_ready(&self) -> Result<()> {
        // Poll /health for up to 10 seconds
        for _ in 0..20 {
            if reqwest::get(format!("http://127.0.0.1:{}/health", self.port))
                .await.is_ok() { return Ok(()); }
            tokio::time::sleep(Duration::from_millis(500)).await;
        }
        Err(anyhow!("Backend failed to start"))
    }
}
```

### 4.2 — Next.js Setup

```
apps/desktop/frontend/
├── next.config.js          output: 'export', images: unoptimized
├── tailwind.config.ts      Custom tokens (navy/blue palette)
├── app/
│   ├── layout.tsx          ThemeProvider + QueryClientProvider
│   ├── globals.css         CSS custom properties
│   ├── (dashboard)/
│   │   ├── layout.tsx      Sidebar + TopBar + main
│   │   └── overview/
│   │       └── page.tsx    Dashboard placeholder
│   └── onboarding/
│       └── page.tsx        Shown on first launch
└── components/
    └── layout/
        ├── Sidebar.tsx
        ├── TopBar.tsx      Custom title bar with window controls
        └── WindowControls.tsx  Minimize/Max/Close via Tauri invoke()
```

**`tailwind.config.ts`** Design System:
```typescript
colors: {
  // Dark surfaces
  surface: {
    base:     "hsl(222 22% 8%)",    // background
    card:     "hsl(222 20% 11%)",   // cards
    elevated: "hsl(222 18% 14%)",   // modals
    hover:    "hsl(222 15% 18%)",   // hover state
    border:   "hsl(222 15% 22%)",   // borders
  },
  // Brand
  guardian: {
    400: "hsl(220 90% 65%)",
    500: "hsl(220 90% 56%)",  // primary
    600: "hsl(220 90% 48%)",  // hover
  },
  // Severity
  critical: "hsl(0 85% 55%)",
  high:     "hsl(25 95% 55%)",
  medium:   "hsl(45 95% 55%)",
  low:      "hsl(200 80% 55%)",
},
fontFamily: {
  sans:  ["Inter", "sans-serif"],
  mono:  ["JetBrains Mono", "monospace"],
},
```

**`components/layout/Sidebar.tsx`** — Navigation items:
```typescript
const NAV_ITEMS = [
  { href: "/overview",     icon: LayoutDashboard, label: "Overview" },
  { href: "/security",     icon: Shield,          label: "Security" },
  { href: "/performance",  icon: Activity,        label: "Performance" },
  { href: "/hardware",     icon: Cpu,             label: "Hardware" },
  { href: "/network",      icon: Network,         label: "Network" },
  { href: "/storage",      icon: HardDrive,       label: "Storage" },
  { href: "/incidents",    icon: AlertTriangle,   label: "Incidents" },
  { href: "/ai-assistant", icon: Bot,             label: "AI Assistant" },
  { href: "/reports",      icon: FileText,        label: "Reports" },
  { href: "/settings",     icon: Settings,        label: "Settings" },
] as const
```

### 4.3 — API Client Layer

**`lib/api-client.ts`** — Typed API client (no fetch() calls scattered in components):
```typescript
class APIClient {
  private baseUrl = "http://127.0.0.1:8765/api/v1"

  private async request<T>(
    path: string,
    options?: RequestInit
  ): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers: { "Content-Type": "application/json", ...options?.headers }
    })
    if (!res.ok) throw new APIError(res.status, await res.text())
    return res.json()
  }

  // Typed methods for each endpoint
  health = {
    getScores: () => this.request<HealthScores>("/health/scores/breakdown"),
    getHistory: (days: number) =>
      this.request<HealthScoreHistory[]>(`/health/history?days=${days}`),
  }

  events = {
    list: (params: EventListParams) =>
      this.request<EventListResponse>(`/events?${new URLSearchParams(params as any)}`),
    getById: (id: string) =>
      this.request<EventRead>(`/events/${id}`),
  }
  // ... all endpoints
}

export const api = new APIClient()
```

### 4.4 — Phase 4 Tests

```typescript
// frontend: component tests with Vitest + Testing Library
test("Sidebar renders all 10 nav items", () => {
  render(<Sidebar />)
  expect(screen.getAllByRole("link")).toHaveLength(10)
})

test("WindowControls call Tauri invoke on click", async () => {
  const mockInvoke = vi.fn()
  vi.mock("@tauri-apps/api/core", () => ({ invoke: mockInvoke }))
  render(<WindowControls />)
  await userEvent.click(screen.getByLabelText("Close"))
  expect(mockInvoke).toHaveBeenCalledWith("close_window")
})

test("APIClient throws APIError on 4xx response", async () => {
  server.use(http.get("*/health/scores*", () => HttpResponse.error()))
  await expect(api.health.getScores()).rejects.toBeInstanceOf(APIError)
})
```

```rust
// Rust: backend process starts and /health returns 200
#[tauri::test]
async fn test_backend_starts_successfully() { ... }
```

### Phase 4 Gate

| Check | Target |
|-------|--------|
| Tauri dev window opens | ✅ |
| All 10 sidebar navigation links route correctly | ✅ |
| Custom title bar window controls work | ✅ |
| System tray appears with menu | ✅ |
| API client returns typed data | ✅ |
| Frontend component tests pass | ✅ |
| `cargo check` passes | ✅ |
| `tsc --noEmit` passes (zero TS errors) | ✅ |

---

## Phase 5 — Live Dashboard & Real-Time Updates

> **Goal**: Dashboard shows real system data. WebSocket streams live updates. Health scores animate. Charts update in real-time.

### 5.1 — FastAPI REST Endpoints (Phase 5 scope)

**`backend/app/api/v1/health.py`**:
```python
router = APIRouter(prefix="/health", tags=["health"])

@router.get("/scores/breakdown", response_model=HealthScoresBreakdown)
async def get_scores_breakdown(
    session: AsyncSession = Depends(get_db),
    engine: HealthScoreEngine = Depends(get_health_engine)
) -> HealthScoresBreakdown:
    return await engine.get_latest_breakdown(session)

@router.get("/history", response_model=list[HealthScoreRead])
async def get_history(
    days: int = Query(default=30, ge=1, le=365),
    session: AsyncSession = Depends(get_db)
) -> list[HealthScoreRead]:
    return await HealthScoreRepository(session).get_history(days=days)
```

### 5.2 — WebSocket Real-Time Layer

**`backend/app/api/websocket.py`**:
```python
class ConnectionManager:
    """Manages WebSocket connections. Thread-safe."""
    def __init__(self):
        self._connections: set[WebSocket] = set()
        self._lock = asyncio.Lock()

    async def connect(self, ws: WebSocket) -> None:
        await ws.accept()
        async with self._lock:
            self._connections.add(ws)

    async def disconnect(self, ws: WebSocket) -> None:
        async with self._lock:
            self._connections.discard(ws)

    async def broadcast(self, message: dict) -> None:
        dead = set()
        for ws in self._connections:
            try:
                await ws.send_json(message)
            except WebSocketDisconnect:
                dead.add(ws)
        self._connections -= dead

metrics_manager = ConnectionManager()
events_manager = ConnectionManager()

@ws_router.websocket("/ws/metrics")
async def metrics_ws(websocket: WebSocket):
    await metrics_manager.connect(websocket)
    try:
        while True:
            await websocket.receive_text()  # Keep-alive
    except WebSocketDisconnect:
        await metrics_manager.disconnect(websocket)
```

EventBus bridge → WebSocket broadcast:
```python
# Subscribe at startup
EventBus.subscribe(Events.HEALTH_SCORE_UPDATED,
    lambda score: metrics_manager.broadcast({"type": "health_score", "data": score.dict()}))
EventBus.subscribe(Events.EVENT_PROCESSED,
    lambda event: events_manager.broadcast({"type": "event", "data": event.dict()}))
```

### 5.3 — Zustand State Stores

**`stores/health-store.ts`**:
```typescript
interface HealthStore {
  scores: HealthScores | null
  history: HealthScoreHistory[]
  loading: boolean
  lastUpdated: Date | null
  fetchScores: () => Promise<void>
  updateFromWebSocket: (scores: HealthScores) => void
}

export const useHealthStore = create<HealthStore>()(
  subscribeWithSelector((set) => ({
    scores: null, history: [], loading: false, lastUpdated: null,

    fetchScores: async () => {
      set({ loading: true })
      const scores = await api.health.getScores()
      set({ scores, loading: false, lastUpdated: new Date() })
    },

    updateFromWebSocket: (scores) =>
      set({ scores, lastUpdated: new Date() }),
  }))
)
```

**`hooks/use-websocket.ts`**:
```typescript
export function useMetricsWebSocket() {
  const updateScores = useHealthStore(s => s.updateFromWebSocket)

  useEffect(() => {
    const ws = new WebSocket("ws://127.0.0.1:8765/ws/metrics")
    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data)
      if (msg.type === "health_score") updateScores(msg.data)
    }
    ws.onclose = () => setTimeout(() => reconnect(), 3000)  // Auto-reconnect
    return () => ws.close()
  }, [])
}
```

### 5.4 — Dashboard Components

**`components/dashboard/HealthScoreRing.tsx`**:
```typescript
// Animated SVG ring. Score animates from 0 to value on mount.
export function HealthScoreRing({ score, size = 120, label }: Props) {
  const circumference = 2 * Math.PI * 45
  const strokeDashoffset = circumference - (score / 100) * circumference
  const color = getScoreColor(score)  // Uses CSS custom property

  return (
    <div className="relative flex items-center justify-center">
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size/2} cy={size/2} r={45} className="stroke-surface-border fill-none"
          strokeWidth={8} />
        <motion.circle cx={size/2} cy={size/2} r={45}
          strokeWidth={8} fill="none"
          stroke={color}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset }}
          transition={{ duration: 1.5, ease: "easeOut" }}
        />
      </svg>
      <div className="absolute text-center">
        <span className="text-2xl font-bold tabular-nums">{score}</span>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  )
}
```

**Dashboard layout** (`app/(dashboard)/overview/page.tsx`):
- Row 1: Overall Health Score (large) + 5 category scores (grid)
- Row 2: Live CPU/RAM/Disk strip (updates every 5s via WS)
- Row 3: Recent Events list (last 10, live updating)
- Row 4: Active Predictions panel + Quick Actions

### 5.5 — Phase 5 Tests

```typescript
test("HealthScoreRing renders correct score", () => {
  render(<HealthScoreRing score={87} label="Security" />)
  expect(screen.getByText("87")).toBeInTheDocument()
})

test("Dashboard fetches scores on mount", async () => {
  server.use(http.get("*/health/scores*", () => HttpResponse.json(mockScores)))
  render(<DashboardOverviewPage />)
  await waitFor(() => expect(screen.getByText("87")).toBeInTheDocument())
})

test("WebSocket reconnects after disconnect", async () => {
  // Simulate close → verify reconnect after 3s
})
```

```python
async def test_websocket_broadcasts_on_health_score_update(test_client):
    """Health score update triggers WS broadcast to connected clients."""

async def test_health_api_returns_current_scores(test_client, db_with_scores):
    response = test_client.get("/api/v1/health/scores/breakdown")
    assert response.status_code == 200
    assert "overall_score" in response.json()
```

### Phase 5 Gate

| Check | Target |
|-------|--------|
| Dashboard loads with real data in < 500ms | ✅ |
| Health score ring animates on load | ✅ |
| CPU/RAM metrics update every 5 seconds via WS | ✅ |
| New events appear in event list without page refresh | ✅ |
| WebSocket auto-reconnects on disconnect | ✅ |
| All API endpoints return correct status codes | ✅ |

---

## Phase 6 — AI Integration Layer

> **Goal**: Every significant event has an AI explanation. Provider falls back Ollama → Gemini automatically. AI explanations are stored and displayed.

### Design Principle: Provider Abstraction + Fallback Chain

```
AIProviderFactory
    │
    ▼
FallbackAIProvider ──► OllamaProvider (primary)
                   └──► GeminiProvider  (fallback)
                   └──► [cached response if both fail]
```

### 6.1 — AI Provider Abstraction

**`backend/app/ai/base.py`**:
```python
class AIProvider(ABC):
    name: str

    @abstractmethod
    async def generate(
        self, system_prompt: str, user_message: str,
        temperature: float = 0.3, max_tokens: int = 1024
    ) -> AIResponse: ...

    @abstractmethod
    async def stream(
        self, system_prompt: str, user_message: str
    ) -> AsyncIterator[str]: ...

    @abstractmethod
    async def is_available(self) -> bool: ...

@dataclass
class AIResponse:
    content: str
    provider: str
    model: str
    tokens_used: int | None = None
    latency_ms: float = 0.0
```

**`backend/app/ai/providers/ollama.py`**:
```python
class OllamaProvider(AIProvider):
    name = "ollama"

    async def is_available(self) -> bool:
        try:
            async with httpx.AsyncClient(timeout=5) as client:
                r = await client.get(f"{self._base_url}/api/tags")
                return r.status_code == 200
        except Exception:
            return False

    async def generate(self, system_prompt, user_message, **kwargs) -> AIResponse:
        async with httpx.AsyncClient(timeout=self._timeout) as client:
            r = await client.post(f"{self._base_url}/api/generate", json={
                "model": self._model,
                "system": system_prompt,
                "prompt": user_message,
                "stream": False,
                "format": "json",
                "options": {
                    "temperature": kwargs.get("temperature", 0.3),
                    "num_predict": kwargs.get("max_tokens", 1024),
                },
            })
            data = r.json()
            return AIResponse(
                content=data["response"],
                provider=self.name,
                model=self._model,
                tokens_used=data.get("eval_count"),
            )
```

**`backend/app/ai/fallback_provider.py`**:
```python
class FallbackAIProvider(AIProvider):
    """
    Tries providers in order. Falls back automatically.
    Logs every fallback event for observability.
    """
    name = "fallback"

    def __init__(self, providers: list[AIProvider]):
        self._providers = providers  # [OllamaProvider, GeminiProvider]

    async def generate(self, system_prompt, user_message, **kwargs) -> AIResponse:
        last_error: Exception | None = None
        for provider in self._providers:
            if not await provider.is_available():
                logger.warning("ai_provider_unavailable", provider=provider.name)
                continue
            try:
                response = await provider.generate(
                    system_prompt, user_message, **kwargs
                )
                logger.info("ai_provider_used", provider=provider.name)
                return response
            except Exception as e:
                last_error = e
                logger.warning("ai_provider_failed",
                    provider=provider.name, error=str(e))

        # All providers failed → return graceful degradation message
        logger.error("all_ai_providers_failed", error=str(last_error))
        return AIResponse(
            content=self._fallback_message(),
            provider="none", model="none"
        )

    def _fallback_message(self) -> str:
        return json.dumps({
            "what_happened": "AI analysis temporarily unavailable.",
            "why_it_happened": "Could not connect to any AI provider.",
            "severity": "unknown",
            "recommended_action": "Check AI provider settings.",
            "can_ignore": True,
            "simple_summary": "AI is offline. Manual review recommended."
        })
```

### 6.2 — Prompt Template System

**`backend/app/ai/prompts.py`**:
```python
class PromptLibrary:
    """Single source of truth for all AI prompts."""

    EXPLAIN_EVENT = """
You are SystemGuardian AI, a friendly system health advisor.
Analyze this system event. Respond ONLY with valid JSON matching this schema:
{
  "what_happened": "Simple explanation (max 2 sentences)",
  "why_it_happened": "Probable cause",
  "severity": "critical|high|medium|low|info",
  "frequency_context": "How often this occurs",
  "risk_assessment": "Risk to the user",
  "recommended_action": "Specific actionable step",
  "can_ignore": true or false,
  "simple_summary": "One sentence for non-technical users"
}
Use plain English. Be empathetic. Do NOT use jargon. Do NOT be alarmist.
"""

    ROOT_CAUSE_ANALYSIS = """
You are a system reliability engineer analyzing an incident.
Given the incident timeline and supporting events, identify the root cause.
Respond with JSON: {
  "primary_cause": "...",
  "contributing_factors": ["..."],
  "evidence": ["..."],
  "confidence": 0.0-1.0,
  "recommended_fix": "..."
}
"""

    ASSISTANT_SYSTEM = """
You are SystemGuardian AI, an intelligent assistant for system monitoring.
You have access to real system data provided in the context.
Answer questions clearly. Reference specific events and metrics when relevant.
Be concise. Use bullet points for lists. Provide actionable advice.
"""

    PREDICTION_ANALYSIS = """
Analyze the trend data and generate a prediction.
Respond with JSON: {
  "prediction": "...",
  "probability": 0.0-1.0,
  "confidence": 0.0-1.0,
  "time_horizon": "...",
  "key_signals": ["..."],
  "recommended_actions": ["..."]
}
"""
```

### 6.3 — Explanation Engine

**`backend/app/ai/explanation_engine.py`**:
```python
class ExplanationEngine:
    """Generates AI explanations for events and incidents."""

    def __init__(self, provider: FallbackAIProvider, repo: AIInsightRepository):
        self._provider = provider
        self._repo = repo

    async def explain_event(
        self, event: EventModel, context: EventContext
    ) -> AIInsightModel:
        # Check cache first — don't re-explain same event type twice today
        cached = await self._repo.get_recent_explanation(
            entity_type="event",
            source_id=event.source_id,
            hours=24
        )
        if cached:
            return cached

        user_message = self._build_event_context(event, context)
        response = await self._provider.generate(
            system_prompt=PromptLibrary.EXPLAIN_EVENT,
            user_message=user_message,
            temperature=0.2,  # Low temp = consistent explanations
        )

        insight = AIInsightModel(
            entity_type="event",
            entity_id=event.id,
            provider=response.provider,
            model=response.model,
            insight_type="explanation",
            content=response.content,
            tokens_used=response.tokens_used,
        )
        return await self._repo.save(insight)

    def _build_event_context(
        self, event: EventModel, context: EventContext
    ) -> str:
        return f"""
Event Type: {event.source_id} ({event.title})
Category: {event.category}
Time: {event.occurred_at.isoformat()}
User: {event.user_name or 'System'}
Process: {event.process_name or 'Unknown'}
Frequency Today: {context.count_today} occurrences
Recent Similar Events: {context.recent_count} in last hour
System State: CPU {context.cpu_pct}%, RAM {context.ram_pct}%
Raw Details: {json.dumps(event.normalized_data, indent=2)}
"""
```

### 6.4 — UI: Event Detail with AI Explanation

**`components/events/EventDetailPanel.tsx`**:
```typescript
export function EventDetailPanel({ eventId }: { eventId: string }) {
  const { data: event, isLoading } = useQuery({
    queryKey: ["event", eventId],
    queryFn: () => api.events.getById(eventId)
  })

  return (
    <div className="grid gap-4">
      <EventMetadata event={event} />

      {/* AI Explanation Card */}
      <Card className="border-guardian-500/20 bg-guardian-500/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bot className="h-4 w-4 text-guardian-400" />
            AI Analysis
          </CardTitle>
        </CardHeader>
        <CardContent>
          {event?.ai_insight ? (
            <AIExplanationDisplay insight={event.ai_insight} />
          ) : (
            <AIExplanationSkeleton />  // Pulsing skeleton while AI generates
          )}
        </CardContent>
      </Card>
    </div>
  )
}
```

### 6.5 — Phase 6 Tests

```python
async def test_ollama_provider_generates_valid_json():
    """Ollama returns parseable JSON explanation."""

async def test_fallback_provider_falls_to_gemini_when_ollama_unavailable(
    mock_ollama_down, mock_gemini_up
):
    """When Ollama is down, Gemini is used."""

async def test_fallback_provider_returns_graceful_message_when_all_fail():
    """Both providers down → returns degraded message, no crash."""

async def test_explanation_engine_caches_within_24h():
    """Same source_id within 24h returns cached result without API call."""

async def test_explanation_engine_builds_correct_context(db_with_events):
    """Context includes frequency, recent count, system state."""

async def test_prompt_library_valid_json_prompts():
    """All prompts produce parseable AI JSON responses."""
```

### Phase 6 Gate

| Check | Target |
|-------|--------|
| Ollama provider connects and generates | ✅ |
| Gemini fallback activates when Ollama unavailable | ✅ |
| Events in UI show AI explanation within 30s | ✅ |
| 24-hour explanation caching works | ✅ |
| Both providers down → graceful degradation, no crash | ✅ |
| AI insight stored in `ai_insights` table | ✅ |

---

## Phase 7 — Incident Management & Security UI

> **Goal**: Security engine detects threats. Incidents appear. Security, Performance, Hardware pages show real data.

### 7.1 — Security Engine

**`backend/app/engines/security_engine.py`**:
```python
@dataclass
class DetectionRule:
    id: str
    name: str
    mitre_technique: str
    severity: Severity
    # Pure function — easily testable
    matcher: Callable[[list[EventModel]], bool]
    risk_score: int  # 0-100

class SecurityEngine:
    """
    MITRE ATT&CK aligned threat detection.
    New rules added by extending RULES list — no other code changes.
    """
    RULES: list[DetectionRule] = [
        DetectionRule(
            id="SEC-001", name="Brute Force Attack",
            mitre_technique="T1110",
            severity=Severity.HIGH, risk_score=75,
            matcher=lambda evts: sum(
                1 for e in evts
                if e.source_id == "4625" and e.occurred_at > utcnow() - td(minutes=10)
            ) >= 5
        ),
        DetectionRule(
            id="SEC-002", name="Audit Log Cleared",
            mitre_technique="T1070.001",
            severity=Severity.CRITICAL, risk_score=95,
            matcher=lambda evts: any(e.source_id == "1102" for e in evts)
        ),
        DetectionRule(
            id="SEC-003", name="New Service Installed",
            mitre_technique="T1543.003",
            severity=Severity.HIGH, risk_score=70,
            matcher=lambda evts: any(e.source_id == "7045" for e in evts)
        ),
        DetectionRule(
            id="SEC-004", name="Privilege Escalation",
            mitre_technique="T1078.001",
            severity=Severity.CRITICAL, risk_score=90,
            matcher=lambda evts: any(
                e.source_id in {"4728", "4732", "4756"} for e in evts
            )
        ),
        # ... 10+ more rules
    ]

    async def analyze(
        self, recent_events: list[EventModel], session: AsyncSession
    ) -> list[ThreatDetection]:
        threats = []
        for rule in self.RULES:
            if rule.matcher(recent_events):
                threat = ThreatDetection(
                    rule_id=rule.id,
                    rule_name=rule.name,
                    mitre_technique=rule.mitre_technique,
                    severity=rule.severity,
                    risk_score=rule.risk_score,
                    detected_at=utcnow(),
                )
                threats.append(threat)
                await EventBus.publish(Events.THREAT_DETECTED, threat)
        return threats
```

### 7.2 — Security, Performance, Hardware Pages

Each page follows the same data-fetching pattern:

```typescript
// Standard page pattern (no code repetition)
function usePageData<T>(fetcher: () => Promise<T>, refetchInterval = 30_000) {
  return useQuery({ queryFn: fetcher, refetchInterval })
}

// Security page
export default function SecurityPage() {
  const { data: threats } = usePageData(api.security.getThreats)
  const { data: score } = usePageData(api.health.getScores)
  const { data: loginEvents } = usePageData(api.security.getLoginEvents)

  return (
    <PageLayout title="Security" icon={<Shield />}>
      <SecurityScoreHeader score={score?.security_score} />
      <ThreatGrid threats={threats} />
      <LoginActivityTimeline events={loginEvents} />
    </PageLayout>
  )
}
```

### 7.3 — Phase 7 Tests

```python
async def test_brute_force_detection_triggers_at_5_events():
    events = [make_event("4625")] * 5
    threats = await engine.analyze(events, session)
    assert any(t.rule_id == "SEC-001" for t in threats)

async def test_brute_force_not_triggered_at_4_events():
    events = [make_event("4625")] * 4
    threats = await engine.analyze(events, session)
    assert not any(t.rule_id == "SEC-001" for t in threats)

async def test_all_15_security_rules_have_test_coverage():
    """Every rule has at least one positive and one negative test."""

async def test_incident_api_returns_timeline(test_client, db_with_incident):
    r = test_client.get(f"/api/v1/incidents/{incident_id}")
    assert r.json()["timeline"] is not None
```

### Phase 7 Gate

| Check | Target |
|-------|--------|
| All security rules detect their target patterns | ✅ |
| False positive rate on neutral events = 0 | ✅ |
| Incidents appear in UI with correct timeline | ✅ |
| Security/Performance/Hardware pages load real data | ✅ |
| Security score reflects detected threats | ✅ |

---

## Phase 8 — AI Chat Assistant

> **Goal**: User can ask natural language questions and get contextual answers backed by real event data.

### 8.1 — Intent Parser + Context Builder

**`backend/app/ai/assistant.py`**:
```python
class AssistantContextBuilder:
    """Fetches relevant DB data based on parsed query intent."""

    async def build_context(
        self, query: str, session: AsyncSession
    ) -> AssistantContext:
        # Determine time range from query
        time_range = self._extract_time_range(query)
        # Determine focus areas
        categories = self._extract_categories(query)

        context = AssistantContext()

        if not categories or "performance" in categories:
            context.recent_events += await EventRepository(session).get_by_category(
                EventCategory.PERFORMANCE, **time_range
            )
            context.hardware_metrics = await HardwareMetricRepository(
                session
            ).get_average(time_range)

        if not categories or "security" in categories:
            context.recent_events += await EventRepository(session).get_by_category(
                EventCategory.SECURITY, **time_range
            )

        context.active_incidents = await IncidentRepository(
            session
        ).get_open(limit=5)
        context.health_scores = await HealthScoreRepository(
            session
        ).get_latest()

        return context

class AIAssistant:
    def __init__(
        self,
        provider: FallbackAIProvider,
        context_builder: AssistantContextBuilder,
        chat_repo: ChatMessageRepository,
    ):
        self._provider = provider
        self._context_builder = context_builder
        self._chat_repo = chat_repo

    async def chat_stream(
        self, message: str, session_id: str, db: AsyncSession
    ) -> AsyncIterator[str]:
        # Build context
        context = await self._context_builder.build_context(message, db)
        history = await self._chat_repo.get_session_history(session_id, limit=10)

        # Build prompt
        user_prompt = f"""
User Question: {message}

=== System Context ===
{context.to_prompt_string()}

=== Recent Chat History ===
{self._format_history(history)}
"""

        # Stream response
        full_response = ""
        async for chunk in self._provider.stream(
            system_prompt=PromptLibrary.ASSISTANT_SYSTEM,
            user_message=user_prompt
        ):
            full_response += chunk
            yield chunk

        # Persist conversation
        await self._chat_repo.save(ChatMessageModel(
            session_id=session_id, role="user", content=message
        ))
        await self._chat_repo.save(ChatMessageModel(
            session_id=session_id, role="assistant", content=full_response
        ))
```

### 8.2 — Streaming Chat UI

**`app/(dashboard)/ai-assistant/page.tsx`**:
```typescript
export default function AIAssistantPage() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")

  async function sendMessage(text: string) {
    setMessages(prev => [...prev, { role: "user", content: text }])
    setMessages(prev => [...prev, { role: "assistant", content: "", streaming: true }])

    const response = await fetch("/api/v1/ai/chat", {
      method: "POST",
      body: JSON.stringify({ message: text, session_id: sessionId }),
      headers: { "Content-Type": "application/json" },
    })

    const reader = response.body!.getReader()
    const decoder = new TextDecoder()
    let accumulated = ""

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      accumulated += decoder.decode(value)
      // Update last message with streamed content
      setMessages(prev => [
        ...prev.slice(0, -1),
        { role: "assistant", content: accumulated, streaming: false }
      ])
    }
  }

  return (
    <div className="flex h-full gap-4">
      <ChatPane messages={messages} onSend={sendMessage} input={input} setInput={setInput} />
      <ContextPane />  {/* Shows referenced events/metrics */}
    </div>
  )
}
```

### Phase 8 Gate

| Check | Target |
|-------|--------|
| Chat streams responses in real-time | ✅ |
| "Why was my PC slow yesterday?" returns event-backed answer | ✅ |
| Chat history persists across sessions | ✅ |
| Context panel shows referenced events | ✅ |
| Works with both Ollama and Gemini | ✅ |

---

## Phase 9 — Predictive Analytics Engine

> **Goal**: System predicts SSD failure, battery degradation, storage exhaustion, and crash probability. Predictions show on dashboard.

### 9.1 — Predictor Base + Strategy

**`backend/app/engines/predictors/base.py`**:
```python
class BasePredictor(ABC):
    name: str
    prediction_type: str

    @abstractmethod
    async def predict(self, session: AsyncSession) -> Prediction | None: ...

    def _linear_trend(self, values: list[float]) -> TrendResult:
        """Shared trend calculation — no duplication across predictors."""
        if len(values) < 3:
            return TrendResult(slope=0.0, r_squared=0.0)
        x = np.arange(len(values), dtype=float)
        y = np.array(values)
        slope, intercept, r_value, *_ = stats.linregress(x, y)
        return TrendResult(
            slope=float(slope),
            r_squared=float(r_value**2),
            predicted_next=float(intercept + slope * len(values)),
        )

    def _to_prediction(self, probability: float, **kwargs) -> Prediction | None:
        if probability < 0.1:
            return None  # Not worth showing
        return Prediction(
            prediction_type=self.prediction_type,
            probability=round(probability, 3),
            **kwargs
        )
```

**`backend/app/engines/predictors/disk_failure.py`**:
```python
@PredictorRegistry.register
class DiskFailurePredictor(BasePredictor):
    name = "disk_failure"
    prediction_type = "ssd_failure"

    async def predict(self, session: AsyncSession) -> Prediction | None:
        smart_history = await DiskMetricRepository(session).get_smart_history(days=30)
        if len(smart_history) < 5:
            return None

        reallocated = [r.smart_data.get("reallocated_sectors", 0) for r in smart_history]
        trend = self._linear_trend(reallocated)

        # Probability = normalized slope capped at 0.95
        probability = min(trend.slope * 0.4, 0.95) if trend.slope > 0 else 0.0

        return self._to_prediction(
            probability=probability,
            confidence=trend.r_squared,
            title="SSD Degradation Detected",
            description=f"Reallocated sector count growing at {trend.slope:.1f}/day",
            time_horizon=self._estimate_horizon(trend),
            severity=Severity.HIGH if probability > 0.5 else Severity.MEDIUM,
            recommended_actions=[
                "Back up your data immediately",
                "Run a full disk diagnostic",
                "Plan SSD replacement within 30-60 days",
            ]
        )
```

All 7 predictors follow identical base pattern:
- `DiskFailurePredictor`
- `BatteryDegradationPredictor`
- `StorageExhaustionPredictor`
- `CrashProbabilityPredictor`
- `ThermalThrottlingPredictor`
- `DriverInstabilityPredictor`
- `MemoryDegradationPredictor`

### Phase 9 Gate

| Check | Target |
|-------|--------|
| All 7 predictors return valid `Prediction` objects | ✅ |
| Predictions appear in dashboard panel | ✅ |
| Zero false positives on fresh system (trend = 0) | ✅ |
| Prediction stored and expires after TTL | ✅ |

---

## Phase 10 — Reports & Notification System

> **Goal**: Daily/weekly reports generate automatically. Desktop notifications fire for critical events. Full notification management UI.

### 10.1 — Report Builder (Builder Pattern)

**`backend/app/reports/builder.py`**:
```python
class ReportBuilder(ABC):
    """Base for all report types. Subclasses override build_*() methods."""

    def __init__(self, session: AsyncSession, ai: FallbackAIProvider):
        self._session = session
        self._ai = ai

    async def build(self, period_start: datetime, period_end: datetime) -> Report:
        """Template method — ensures consistent structure across all report types."""
        data = ReportData(
            period=(period_start, period_end),
            health_scores=await self.build_health_section(),
            security=await self.build_security_section(),
            performance=await self.build_performance_section(),
            hardware=await self.build_hardware_section(),
            incidents=await self.build_incidents_section(),
            predictions=await self.build_predictions_section(),
            recommendations=await self.build_recommendations_section(),
            ai_narrative=await self.generate_ai_narrative(data),  # AI-generated summary
        )
        return Report(type=self.report_type, data=data, ...)

class DailyReportBuilder(ReportBuilder):
    report_type = ReportType.DAILY
    # Inherits all build_*() — only overrides sections needing daily-specific logic

class WeeklyReportBuilder(ReportBuilder):
    report_type = ReportType.WEEKLY
    async def build_trend_analysis(self) -> TrendAnalysis:
        """Weekly adds 7-day trend analysis — not in daily."""
        ...
```

### 10.2 — Exporter Factory

**`backend/app/reports/exporters/factory.py`**:
```python
class ExporterFactory:
    _exporters: dict[str, Type[BaseExporter]] = {
        "pdf":  PDFExporter,
        "json": JSONExporter,
        "csv":  CSVExporter,
        "html": HTMLExporter,
    }

    @classmethod
    def create(cls, format: str) -> BaseExporter:
        if format not in cls._exporters:
            raise ValueError(f"Unsupported format: {format}")
        return cls._exporters[format]()
```

### 10.3 — Notification Manager

**`backend/app/notifications/manager.py`**:
```python
class NotificationManager:
    """
    Observer: subscribes to EventBus.
    Manages cooldown, dedup, and routing to channels.
    """
    def __init__(self, channels: list[BaseNotificationChannel]):
        self._channels = channels
        self._cooldown_cache: dict[str, datetime] = {}

        # Subscribe to relevant bus events
        EventBus.subscribe(Events.THREAT_DETECTED, self._on_threat)
        EventBus.subscribe(Events.INCIDENT_CREATED, self._on_incident)
        EventBus.subscribe(Events.PREDICTION_GENERATED, self._on_prediction)

    async def _on_threat(self, threat: ThreatDetection) -> None:
        if threat.severity in (Severity.CRITICAL, Severity.HIGH):
            await self._dispatch(Notification.from_threat(threat))

    async def _dispatch(self, notification: Notification) -> None:
        cooldown_key = f"{notification.category}:{notification.title}"
        if self._is_in_cooldown(cooldown_key, minutes=15):
            return

        for channel in self._channels:
            await channel.send(notification)

        self._cooldown_cache[cooldown_key] = utcnow()
        await NotificationRepository(self._session).save(notification)
        await EventBus.publish(Events.NOTIFICATION_READY, notification)
```

### Phase 10 Gate

| Check | Target |
|-------|--------|
| Daily report generates with correct data | ✅ |
| PDF export produces valid, styled document | ✅ |
| Desktop notification appears for CRITICAL event (manual test) | ✅ |
| Notification cooldown prevents spam | ✅ |
| Notification bell shows unread count | ✅ |
| All export formats produce valid output | ✅ |

---

## Phase 11 — Onboarding Wizard & Settings

> **Goal**: First-time users see guided setup. Settings page fully functional. Quick action buttons work.

### 11.1 — Onboarding Wizard (4-step, state machine)

```typescript
// Wizard is a state machine — each step has: component, validation, next
const WIZARD_STEPS = [
  { id: "modules",   component: ModuleSelectionStep,  title: "Choose Monitoring" },
  { id: "ai",        component: AIProviderStep,        title: "Configure AI" },
  { id: "frequency", component: FrequencyStep,         title: "Monitoring Frequency" },
  { id: "ready",     component: ReadyStep,             title: "All Set!" },
] as const

export function OnboardingWizard() {
  const [step, setStep] = useState(0)
  const [config, setConfig] = useOnboardingConfig()

  const handleComplete = async () => {
    await api.settings.saveOnboarding(config)
    // Mark onboarding complete in settings table
    await api.settings.set("onboarding_complete", true)
    router.push("/overview")
  }
  ...
}
```

First launch detection (Tauri side):
```rust
// On startup: check settings DB for "onboarding_complete"
// If not set → navigate to /onboarding
// If set → navigate to /overview
```

### 11.2 — Settings Page

Settings organized by section:

```typescript
const SETTINGS_SECTIONS = [
  { id: "general",       title: "General",       icon: Settings },
  { id: "modules",       title: "Modules",        icon: ToggleLeft },
  { id: "ai",            title: "AI Provider",    icon: Bot },
  { id: "notifications", title: "Notifications",  icon: Bell },
  { id: "data",          title: "Data & Privacy", icon: Database },
] as const
```

Settings are backed by the `SettingModel` (key-value) in SQLite.

### Phase 11 Gate

| Check | Target |
|-------|--------|
| First launch shows onboarding (not dashboard) | ✅ |
| Completing onboarding saves settings + redirects | ✅ |
| AI provider setup page detects Ollama availability | ✅ |
| All settings changes persist across app restart | ✅ |
| Quick actions execute and show feedback | ✅ |

---

## Phase 12 — Production Build, Installer & CI/CD

> **Goal**: `SystemGuardianAI-Setup.exe` installable on a clean Windows machine. Full CI/CD pipeline.

### 12.1 — PyInstaller Backend Bundle

**`backend/backend.spec`**:
```python
a = Analysis(
    ["app/main.py"],
    pathex=["backend"],
    datas=[
        ("app/ai/prompts.py", "app/ai"),
        ("app/reports/templates", "app/reports/templates"),
    ],
    hiddenimports=["win32api", "win32con", "win32evtlog", "win32security",
                   "wmi", "psutil", "aiosqlite", "uvicorn.logging"],
    collect_all=["uvicorn", "fastapi", "sqlalchemy"],
)
exe = EXE(a.pure, a.scripts, a.binaries, a.zipfiles, a.datas,
    name="sgai-backend",
    onefile=True,  # Single executable
    windowed=False,  # Console hidden from user
)
```

### 12.2 — Tauri Production Build

```json
// tauri.conf.json bundle section
"bundle": {
  "identifier": "ai.systemguardian.app",
  "icon": ["icons/32x32.png", "icons/128x128.png", "icons/icon.ico"],
  "resources": ["../../../backend/dist/sgai-backend.exe"],
  "targets": ["msi", "nsis"],
  "windows": {
    "nsis": {
      "installMode": "perMachine",
      "installerIcon": "icons/installer.ico",
      "headerImage": "icons/header.bmp",
      "sidebarImage": "icons/sidebar.bmp",
      "license": "LICENSE.txt"
    }
  }
}
```

### 12.3 — Full CI/CD Pipeline

**`.github/workflows/build-windows.yml`**:
```yaml
name: Build Windows Installer
on:
  push:
    tags: ['v*']

jobs:
  build:
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v4

      # Backend
      - uses: actions/setup-python@v5
        with: { python-version: '3.11' }
      - run: pip install pyinstaller && pip install -r requirements.txt
        working-directory: backend
      - run: pyinstaller backend.spec
        working-directory: backend

      # Frontend
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - run: npm ci && npm run build
        working-directory: apps/desktop/frontend

      # Tauri
      - uses: dtolnay/rust-toolchain@stable
      - uses: tauri-apps/tauri-action@v0
        with:
          projectPath: apps/desktop
        env:
          TAURI_SIGNING_PRIVATE_KEY: ${{ secrets.TAURI_KEY }}

      # Release
      - uses: softprops/action-gh-release@v2
        with:
          files: |
            apps/desktop/src-tauri/target/release/bundle/msi/*.msi
            apps/desktop/src-tauri/target/release/bundle/nsis/*.exe
```

### 12.4 — Phase 12 Tests (Production Validation)

| Test | Method |
|------|--------|
| Installer runs on clean Windows VM | Manual |
| App starts without Python/Node.js installed | Manual |
| Onboarding wizard appears on first launch | Manual |
| All 8 collectors produce data within 2 minutes | Manual |
| AI chat works (Ollama + Gemini tested separately) | Manual |
| Desktop notification fires for simulated threat | Manual |
| Daily report generates and exports to PDF | Manual |
| Uninstaller removes all app files | Manual |
| Memory usage < 150MB after 1 hour | Task Manager |
| CPU usage < 2% when idle | Task Manager |

### Phase 12 Gate

| Check | Target |
|-------|--------|
| Installer size < 50MB (without Ollama) | ✅ |
| Installation completes in < 30 seconds | ✅ |
| App cold start < 3 seconds | ✅ |
| All CI/CD jobs pass on tag push | ✅ |
| GitHub Release created with installer attached | ✅ |
| No console windows visible to user | ✅ |

---

## Complete Phase Summary

| Phase | Focus | Duration | Key Deliverable | Gate |
|-------|-------|----------|-----------------|------|
| **0** | Foundation & Tooling | 2 days | Monorepo + CI | CI green on push |
| **1** | Domain Layer & DB | 4 days | ORM + Repositories | ≥90% coverage |
| **2** | Collection Layer | 5 days | All 8 collectors | Real events in DB |
| **3** | Processing Pipeline | 5 days | Pipeline + Health Score | Events → scores |
| **4** | Tauri + Frontend Shell | 4 days | Desktop window opens | Tauri builds |
| **5** | Live Dashboard | 5 days | Real-time dashboard | WS updates work |
| **6** | AI Integration | 5 days | Event explanations | Fallback works |
| **7** | Incidents & Security | 4 days | Threat detection | All rules tested |
| **8** | AI Chat | 3 days | Chat with streaming | Context-aware |
| **9** | Predictions | 4 days | 7 predictors | Zero false pos. |
| **10** | Reports & Notifs | 4 days | PDF report + alerts | Desktop notifs |
| **11** | Onboarding & Settings | 3 days | Complete wizard | First-launch flow |
| **12** | Build & Release | 4 days | Installable `.exe` | Clean VM test |

**Total: ~52 development days**

---

## Key Architectural Decisions

| Decision | Choice | Reason |
|----------|--------|--------|
| State management | Zustand + React Query | Zustand for global state, RQ for server-state caching |
| Async in Python | `asyncio` throughout | Non-blocking I/O for all collectors and AI calls |
| DB access pattern | Repository + async SQLAlchemy | Testable, swappable, no raw SQL in business logic |
| AI fallback | Ollama → Gemini chain | Privacy-first with reliability fallback |
| Collector discovery | Decorator-based registry | Open/Closed — add collectors without touching orchestrator |
| Severity classification | Composite strategy | Multiple classifiers combined, easily extensible |
| Event routing | Internal EventBus (pub/sub) | Decouples pipeline from downstream consumers |
| Report structure | Builder pattern | Consistent structure, subclasses add type-specific sections |
| Frontend components | ShadCN primitives + custom | Accessible base, no UI code repetition |

# SystemGuardian AI — Backend

FastAPI backend for the SystemGuardian AI desktop application.

## Structure

```
backend/
├── app/
│   ├── main.py              # FastAPI app entry point + lifespan
│   ├── config.py            # Settings (pydantic-settings)
│   ├── core/                # Shared infrastructure
│   │   ├── database.py      # DatabaseManager + session factory
│   │   ├── repository.py    # BaseRepository[T]
│   │   ├── event_bus.py     # Async in-process pub/sub
│   │   └── scheduler.py     # APScheduler wrapper
│   ├── domain/
│   │   └── enums.py         # Severity, EventCategory, etc.
│   ├── models/              # SQLAlchemy ORM models
│   ├── schemas/             # Pydantic v2 request/response schemas
│   ├── repositories/        # Domain-specific DB access
│   ├── collectors/          # Windows data collection layer
│   │   ├── base.py          # BaseCollector ABC
│   │   ├── registry.py      # CollectorRegistry
│   │   ├── orchestrator.py  # CollectorOrchestrator
│   │   └── windows/         # Platform-specific collectors
│   ├── processors/          # Event processing pipeline
│   ├── engines/             # Health score, security, prediction engines
│   └── api/                 # FastAPI routers
│       └── v1/
├── alembic/                 # DB migrations
├── tests/                   # pytest test suite
└── pyproject.toml
```

## Development

```powershell
# From repo root
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -e ".[dev]"

# Run server
uvicorn app.main:app --reload --port 8765

# Run tests
pytest
```

## API

Base URL: `http://127.0.0.1:8765/api/v1`

Interactive docs (dev only): `http://127.0.0.1:8765/docs`

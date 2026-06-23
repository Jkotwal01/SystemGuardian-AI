from datetime import UTC, datetime

import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import DatabaseManager
from app.domain.enums import EventCategory, IncidentStatus, Severity
from app.models.event import EventModel
from app.models.incident import IncidentModel
from app.models.setting import SettingModel
from app.repositories.event_repository import EventRepository
from app.repositories.incident_repository import IncidentRepository
from app.repositories.setting_repository import SettingRepository
from app.schemas.event import EventCreate


@pytest_asyncio.fixture
async def test_session():
    # DatabaseManager should be initialized in conftest.py or test setup
    factory = DatabaseManager.get_session_factory()
    async with factory() as session:
        yield session
        await session.rollback()


@pytest.mark.asyncio
async def test_event_model_create(test_session: AsyncSession):
    event = EventModel(
        source="test",
        category=EventCategory.SECURITY,
        severity=Severity.HIGH,
        title="Test Event",
        raw_data={"key": "value"},
        normalized_data={"key": "value"},
        occurred_at=datetime.now(UTC),
    )
    repo = EventRepository(test_session)
    saved_event = await repo.save(event)

    assert saved_event.id is not None
    assert saved_event.title == "Test Event"
    assert saved_event.category == EventCategory.SECURITY


@pytest.mark.asyncio
async def test_event_repository_get_by_severity(test_session: AsyncSession):
    repo = EventRepository(test_session)
    event = EventModel(
        source="test",
        category=EventCategory.PERFORMANCE,
        severity=Severity.CRITICAL,
        title="Critical Event",
        raw_data={},
        normalized_data={},
        occurred_at=datetime.now(UTC),
    )
    await repo.save(event)

    critical_events = await repo.get_by_severity(Severity.CRITICAL)
    assert len(critical_events) >= 1
    assert critical_events[0].severity == Severity.CRITICAL


@pytest.mark.asyncio
async def test_incident_repository_active_incidents(test_session: AsyncSession):
    repo = IncidentRepository(test_session)
    incident = IncidentModel(
        title="Active Incident",
        description="Test",
        severity=Severity.HIGH,
        status=IncidentStatus.OPEN,
    )
    await repo.save(incident)

    active = await repo.get_active_incidents()
    assert len(active) >= 1
    assert active[0].resolved_at is None


@pytest.mark.asyncio
async def test_settings_model_roundtrip(test_session: AsyncSession):
    repo = SettingRepository(test_session)
    setting = SettingModel(key="test_key", value="test_value")
    await repo.save(setting)

    val = await repo.get_value("test_key")
    assert val == "test_value"


def test_pydantic_schema_validation():
    event_data = {
        "source": "test",
        "category": "security",
        "severity": "high",
        "title": "Schema Test",
        "raw_data": {},
        "occurred_at": datetime.now(UTC),
    }
    schema = EventCreate(**event_data)
    assert schema.title == "Schema Test"
    assert schema.category == EventCategory.SECURITY

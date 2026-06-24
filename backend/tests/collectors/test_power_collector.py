from unittest.mock import MagicMock, patch

import pytest

from app.collectors.windows.power_collector import PowerCollector
from app.config import get_settings
from app.domain.enums import Severity


@pytest.fixture
def collector():
    settings = get_settings()
    session_mock = MagicMock()
    return PowerCollector(settings, session_mock)


@pytest.mark.asyncio
async def test_power_collector_on_ac_no_battery(collector: PowerCollector):
    mock_battery = MagicMock()
    mock_battery.percent = 100.0
    mock_battery.power_plugged = True
    mock_battery.secsleft = -1

    with patch("app.collectors.windows.power_collector.psutil.sensors_battery", return_value=mock_battery):
        events = await collector._collect()
        assert len(events) == 1
        assert events[0].title.startswith("Power")
        assert events[0].severity == Severity.INFO
        assert events[0].normalized_data["power_source"] == "AC"
        assert events[0].normalized_data["battery_percent"] == 100.0


@pytest.mark.asyncio
async def test_power_collector_on_battery_warning(collector: PowerCollector):
    mock_battery = MagicMock()
    mock_battery.percent = 15.0
    mock_battery.power_plugged = False
    mock_battery.secsleft = 1800  # 30 mins

    with patch("app.collectors.windows.power_collector.psutil.sensors_battery", return_value=mock_battery):
        events = await collector._collect()
        assert len(events) == 1
        assert "battery" in events[0].title.lower()
        assert events[0].severity == Severity.MEDIUM
        assert events[0].normalized_data["power_source"] == "Battery"
        assert events[0].normalized_data["battery_percent"] == 15.0


@pytest.mark.asyncio
async def test_power_collector_on_battery_critical(collector: PowerCollector):
    mock_battery = MagicMock()
    mock_battery.percent = 5.0
    mock_battery.power_plugged = False
    mock_battery.secsleft = 300  # 5 mins

    with patch("app.collectors.windows.power_collector.psutil.sensors_battery", return_value=mock_battery):
        events = await collector._collect()
        assert len(events) == 1
        assert events[0].severity in {Severity.HIGH, Severity.CRITICAL}


@pytest.mark.asyncio
async def test_power_collector_no_battery_sensor(collector: PowerCollector):
    with patch("app.collectors.windows.power_collector.psutil.sensors_battery", return_value=None):
        events = await collector._collect()
        assert len(events) == 1
        assert "Desktop" in events[0].title
        assert events[0].normalized_data["has_battery"] is False
        assert events[0].normalized_data["power_source"] == "AC"

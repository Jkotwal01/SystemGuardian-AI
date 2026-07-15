from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.collectors.windows.network_collector import NetworkCollector
from app.config import get_settings


@pytest.fixture
def collector():
    settings = get_settings()
    session_mock = MagicMock()
    session_mock.commit = AsyncMock()
    session_mock.refresh = AsyncMock()
    return NetworkCollector(settings, session_mock)


@pytest.mark.asyncio
async def test_network_collector_collects_metrics(collector: NetworkCollector):
    mock_counters = {
        "Ethernet": MagicMock(
            bytes_sent=1000,
            bytes_recv=2000,
            packets_sent=10,
            packets_recv=20,
            errin=0,
            errout=0,
            dropin=0,
            dropout=0,
        )
    }
    mock_stats = {"Ethernet": MagicMock(isup=True, speed=1000, duplex=2, mtu=1500)}

    net_io_patch = "app.collectors.windows.network_collector.psutil.net_io_counters"
    net_if_patch = "app.collectors.windows.network_collector.psutil.net_if_stats"

    with (
        patch(net_io_patch, return_value=mock_counters),
        patch(net_if_patch, return_value=mock_stats),
    ):
        events = await collector._collect()
        assert len(events) == 1
        assert len(events) >= 1


@pytest.mark.asyncio
async def test_network_collector_health_check_success(collector: NetworkCollector):
    net_io_patch = "app.collectors.windows.network_collector.psutil.net_io_counters"
    with patch(net_io_patch, return_value={}):
        assert await collector.health_check() is True


@pytest.mark.asyncio
async def test_network_collector_health_check_failure(collector: NetworkCollector):
    net_io_patch = "app.collectors.windows.network_collector.psutil.net_io_counters"
    with patch(net_io_patch, side_effect=Exception("Failed")):
        assert await collector.health_check() is False

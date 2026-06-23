from unittest.mock import MagicMock, patch

import pytest

from app.collectors.windows.network_collector import NetworkCollector
from app.config import get_settings


@pytest.fixture
def collector():
    settings = get_settings()
    session_mock = MagicMock()
    return NetworkCollector(settings, session_mock)


@pytest.mark.asyncio
async def test_network_collector_collects_metrics(collector: NetworkCollector):
    mock_counters = {
        "Ethernet": MagicMock(
            bytes_sent=1000, bytes_recv=2000, packets_sent=10, packets_recv=20, errin=0, errout=0, dropin=0, dropout=0
        )
    }
    mock_stats = {
        "Ethernet": MagicMock(isup=True, speed=1000, duplex=2, mtu=1500)
    }

    with (
        patch("app.collectors.windows.network_collector.psutil.net_io_counters", return_value=mock_counters),
        patch("app.collectors.windows.network_collector.psutil.net_if_stats", return_value=mock_stats),
    ):
        events = await collector._collect()
        assert len(events) == 1
        assert len(events) >= 1


@pytest.mark.asyncio
async def test_network_collector_health_check_success(collector: NetworkCollector):
    with patch("app.collectors.windows.network_collector.psutil.net_io_counters", return_value={}):
        assert await collector.health_check() is True


@pytest.mark.asyncio
async def test_network_collector_health_check_failure(collector: NetworkCollector):
    with patch("app.collectors.windows.network_collector.psutil.net_io_counters", side_effect=Exception("Failed")):
        assert await collector.health_check() is False

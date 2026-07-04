from typing import Any

import pytest
import pytest_asyncio

from app.core.event_bus import EventBus


@pytest_asyncio.fixture
async def bus():
    return EventBus()


@pytest.mark.asyncio
async def test_subscribe_and_publish(bus: EventBus):
    received = []

    async def handler(payload: Any):
        received.append(payload)

    bus.subscribe("test_topic", handler)
    await bus.publish("test_topic", {"key": "value"})

    assert len(received) == 1
    assert received[0] == {"key": "value"}


@pytest.mark.asyncio
async def test_unsubscribe(bus: EventBus):
    received = []

    async def handler(payload: Any):
        received.append(payload)

    bus.subscribe("test_topic", handler)
    bus.unsubscribe("test_topic", handler)

    await bus.publish("test_topic", {"key": "value"})
    assert len(received) == 0


@pytest.mark.asyncio
async def test_publish_no_subscribers(bus: EventBus):
    # Should not raise any errors
    await bus.publish("empty_topic", "test")


@pytest.mark.asyncio
async def test_handler_exception_isolation(bus: EventBus):
    received = []

    async def bad_handler(payload: Any):
        raise ValueError("Simulated failure")

    async def good_handler(payload: Any):
        received.append(payload)

    bus.subscribe("test_topic", bad_handler)
    bus.subscribe("test_topic", good_handler)

    # The bad_handler should fail, but good_handler should still succeed
    await bus.publish("test_topic", "payload")

    assert len(received) == 1
    assert received[0] == "payload"

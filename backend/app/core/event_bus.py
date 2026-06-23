import asyncio
from collections import defaultdict
from typing import Callable, Any, TypeVar, Coroutine
import structlog

logger = structlog.get_logger()

# Generic type for the event payload
TEventPayload = TypeVar("TEventPayload")

class EventBus:
    """
    Async in-process event bus. Decouples producers from consumers.
    Supports subscribing to string-based topic names with async handlers.
    """
    def __init__(self) -> None:
        self._subscribers: dict[str, list[Callable[[Any], Coroutine[Any, Any, None]]]] = defaultdict(list)

    def subscribe(self, topic: str, handler: Callable[[Any], Coroutine[Any, Any, None]]) -> None:
        """Register an async handler for a specific topic."""
        if handler not in self._subscribers[topic]:
            self._subscribers[topic].append(handler)
            logger.debug("event_bus.subscribed", topic=topic, handler=handler.__name__)

    def unsubscribe(self, topic: str, handler: Callable[[Any], Coroutine[Any, Any, None]]) -> None:
        """Remove a previously registered handler from a topic."""
        if handler in self._subscribers[topic]:
            self._subscribers[topic].remove(handler)
            logger.debug("event_bus.unsubscribed", topic=topic, handler=handler.__name__)

    async def publish(self, topic: str, payload: Any) -> None:
        """
        Publish an event payload to all handlers subscribed to the topic.
        Handlers are executed concurrently.
        """
        handlers = self._subscribers.get(topic, [])
        if not handlers:
            logger.debug("event_bus.no_subscribers", topic=topic)
            return

        # Execute all handlers concurrently, catching exceptions in individual handlers
        # so one failing handler doesn't crash the entire event delivery.
        async def safe_execute(handler: Callable[[Any], Coroutine[Any, Any, None]]) -> None:
            try:
                await handler(payload)
            except Exception as e:
                logger.error("event_bus.handler_failed", topic=topic, handler=handler.__name__, error=str(e), exc_info=True)

        tasks = [safe_execute(h) for h in handlers]
        await asyncio.gather(*tasks)
        logger.debug("event_bus.published", topic=topic, handlers_count=len(handlers))

# Global instance for the application
event_bus = EventBus()

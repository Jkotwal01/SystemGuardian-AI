"""
Event Enricher — adds system-level context to raw events.

Enriches each event with:
  - hostname (machine name)
  - OS version
  - collection timestamp
  - user-friendly display metadata
"""

from __future__ import annotations

import platform
import socket
from datetime import datetime, timezone

import structlog

from app.models.event import EventModel

logger = structlog.get_logger()

# Cached at module level — these values don't change at runtime
_HOSTNAME: str = socket.gethostname()
_OS_VERSION: str = platform.version()
_OS_RELEASE: str = platform.release()
_MACHINE: str = platform.machine()


class EventEnricher:
    """
    Adds system context metadata to events before they are persisted.

    The enricher is intentionally stateless — all context is derived from
    the local machine at startup and cached. This ensures minimal overhead
    per event.
    """

    def __init__(self) -> None:
        self._hostname = _HOSTNAME
        self._os_version = _OS_VERSION
        self._os_release = _OS_RELEASE
        self._machine = _MACHINE

    async def enrich(self, event: EventModel) -> EventModel:
        """
        Mutate the event in-place with enrichment metadata.
        Returns the same event for chaining convenience.
        """
        existing_meta: dict = dict(event.metadata_ or {})

        enrichment = {
            "hostname": self._hostname,
            "os_version": self._os_version,
            "os_release": self._os_release,
            "machine_arch": self._machine,
            "enriched_at": datetime.now(tz=timezone.utc).isoformat(),
        }

        event.metadata_ = {**existing_meta, **enrichment}

        logger.debug(
            "event.enriched",
            event_id=event.id,
            hostname=self._hostname,
        )
        return event

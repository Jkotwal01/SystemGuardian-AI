import asyncio
import logging
from typing import Any

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.core.event_bus import event_bus
from app.processors.pipeline import Events

logger = logging.getLogger(__name__)

ws_router = APIRouter(tags=["websocket"])

class ConnectionManager:
    """Manages WebSocket connections. Thread-safe."""
    def __init__(self):
        self._connections: set[WebSocket] = set()
        self._lock = asyncio.Lock()

    async def connect(self, ws: WebSocket) -> None:
        await ws.accept()
        async with self._lock:
            self._connections.add(ws)
            logger.info(f"WebSocket connected. Total: {len(self._connections)}")

    async def disconnect(self, ws: WebSocket) -> None:
        async with self._lock:
            self._connections.discard(ws)
            logger.info(f"WebSocket disconnected. Total: {len(self._connections)}")

    async def broadcast(self, message: dict[str, Any]) -> None:
        dead = set()
        for ws in self._connections:
            try:
                await ws.send_json(message)
            except Exception:
                dead.add(ws)
        
        if dead:
            async with self._lock:
                self._connections -= dead

metrics_manager = ConnectionManager()
events_manager = ConnectionManager()

# Background task to bridge EventBus and WebSockets
async def setup_websocket_bridge() -> None:
    """Subscribes to EventBus and broadcasts over WebSockets."""
    
    async def on_health_score(score: Any) -> None:
        if hasattr(score, "model_dump"):
            data = score.model_dump(mode="json")
        else:
            data = score
        await metrics_manager.broadcast({"type": "health_score", "data": data})

    async def on_event_processed(event: Any) -> None:
        if hasattr(event, "model_dump"):
            data = event.model_dump(mode="json")
        else:
            data = event
        await events_manager.broadcast({"type": "event", "data": data})

    async def on_incident_created(incident: Any) -> None:
        data = incident.model_dump(mode="json") if hasattr(incident, "model_dump") else incident
        await events_manager.broadcast({"type": "incident_created", "data": data})

    async def on_incident_updated(incident: Any) -> None:
        data = incident.model_dump(mode="json") if hasattr(incident, "model_dump") else incident
        await events_manager.broadcast({"type": "incident_updated", "data": data})

    event_bus.subscribe(Events.HEALTH_SCORE_UPDATED, on_health_score)
    event_bus.subscribe(Events.EVENT_PROCESSED, on_event_processed)
    event_bus.subscribe(Events.INCIDENT_CREATED, on_incident_created)
    event_bus.subscribe(Events.INCIDENT_UPDATED, on_incident_updated)
    logger.info("WebSocket bridge initialized.")


@ws_router.websocket("/ws/metrics")
async def metrics_ws(websocket: WebSocket) -> None:
    await metrics_manager.connect(websocket)
    try:
        while True:
            # Wait for any message from the client (keep-alive)
            await websocket.receive_text()
    except WebSocketDisconnect:
        await metrics_manager.disconnect(websocket)
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        await metrics_manager.disconnect(websocket)

@ws_router.websocket("/ws/events")
async def events_ws(websocket: WebSocket) -> None:
    await events_manager.connect(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        await events_manager.disconnect(websocket)
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        await events_manager.disconnect(websocket)

import json
from collections.abc import AsyncGenerator
from dataclasses import dataclass, field
from typing import Any

import structlog
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.ai.base import BaseAIProvider, GenerateOptions
from app.domain.enums import EventCategory
from app.models.chat_message import ChatMessageModel
from app.models.event import EventModel
from app.models.incident import IncidentModel
from app.repositories.chat_message_repository import ChatMessageRepository
from app.repositories.event_repository import EventRepository
from app.repositories.incident_repository import IncidentRepository
from app.repositories.metric_repository import (
    DiskMetricRepository,
    HardwareMetricRepository,
    NetworkMetricRepository,
)

logger = structlog.get_logger()


@dataclass
class AssistantContext:
    recent_events: list[EventModel] = field(default_factory=list)
    active_incidents: list[IncidentModel] = field(default_factory=list)
    system_metrics: dict[str, Any] = field(default_factory=dict)


class AssistantContextBuilder:
    """Builds context from the database to inject into the LLM prompt."""

    def _extract_categories(self, query: str) -> set[EventCategory]:
        """Simple keyword matching to guess user intent."""
        q = query.lower()
        cats = set()

        if any(w in q for w in ["network", "internet", "wifi", "download", "upload", "connection"]):
            cats.add(EventCategory.NETWORK)
        if any(w in q for w in ["security", "hack", "login", "threat", "virus", "password"]):
            cats.add(EventCategory.SECURITY)
        if any(w in q for w in ["slow", "cpu", "memory", "ram", "performance", "lag", "freeze"]):
            cats.add(EventCategory.PERFORMANCE)
        if any(w in q for w in ["disk", "storage", "space", "full", "drive"]):
            cats.add(EventCategory.STORAGE)
        if any(w in q for w in ["hardware", "temperature", "hot", "fan", "battery", "power"]):
            cats.add(EventCategory.HARDWARE)
            cats.add(EventCategory.POWER)

        return cats

    async def build_context(self, query: str, session: AsyncSession) -> AssistantContext:
        context = AssistantContext()
        categories = self._extract_categories(query)

        # 1. Fetch recent events based on inferred categories, or all if none matched
        event_repo = EventRepository(session)
        recent_events = []
        if not categories:
            # General query, just get the last 20 events
            recent_events = await event_repo.get_since_minutes(minutes=60)
            recent_events = recent_events[:20]
        else:
            for cat in categories:
                cat_events = await event_repo.get_by_category(cat, hours=24)
                recent_events.extend(cat_events[:10])

        context.recent_events = recent_events

        # 2. Fetch Active Incidents
        incident_repo = IncidentRepository(session)
        context.active_incidents = await incident_repo.get_active_incidents(limit=5)

        # 3. Fetch Latest Metrics
        metrics: dict[str, Any] = {}

        hw_repo = HardwareMetricRepository(session)
        hw_latest = await hw_repo.get_latest()
        if hw_latest:
            metrics["hardware"] = {
                "cpu_percent": hw_latest.cpu_usage_percent,
                "ram_used_percent": hw_latest.memory_usage_percent,
                "cpu_temperature": hw_latest.cpu_temperature_celsius,
                "battery_percent": hw_latest.battery_percent,
            }

        net_repo = NetworkMetricRepository(session)
        net_latest = await net_repo.get_latest_all()
        if net_latest:
            metrics["network"] = [
                {
                    "interface": n.interface,
                    "bytes_sent_sec": n.bytes_sent_per_sec,
                    "bytes_recv_sec": n.bytes_recv_per_sec,
                }
                for n in net_latest
            ]

        disk_repo = DiskMetricRepository(session)
        disk_latest = await disk_repo.get_latest_all()
        if disk_latest:
            metrics["storage"] = [
                {
                    "mountpoint": d.mountpoint,
                    "usage_percent": d.usage_percent,
                    "free_gb": round(d.free_bytes / 1024**3, 2),
                }
                for d in disk_latest
            ]

        context.system_metrics = metrics
        return context


class AIAssistant:
    """Coordinates chat streaming, context building, and history persistence."""

    SYSTEM_PROMPT = """You are System Guardian AI, an expert, local, privacy-first AI assistant integrated directly into the user's Windows operating system. 
You continuously monitor the system's events, health, security, and performance.

You are currently talking to the user. You have been provided with real-time context about their system below.
Answer their questions helpfully, concisely, and accurately based on the data provided.
If they ask about something not in the context, use your general OS knowledge to help them troubleshoot, but clarify that you don't see it in the recent logs.

=== SYSTEM CONTEXT ===
{context_str}
======================

Guidelines:
1. Be concise. Avoid huge walls of text. Use bullet points.
2. If citing an event, mention the time it occurred.
3. If there are active high-severity incidents, warn the user.
4. Format your output in Markdown.
"""

    def __init__(self, provider: BaseAIProvider, session_factory: async_sessionmaker[AsyncSession]) -> None:
        self._provider = provider
        self._session_factory = session_factory
        self._context_builder = AssistantContextBuilder()

    def _format_context(self, context: AssistantContext) -> str:
        lines = []

        if context.system_metrics:
            lines.append("CURRENT METRICS:")
            lines.append(json.dumps(context.system_metrics, indent=2))
            lines.append("")

        if context.active_incidents:
            lines.append("ACTIVE INCIDENTS:")
            for inc in context.active_incidents:
                lines.append(f"- [{inc.severity.upper()}] {inc.title}: {inc.description}")
            lines.append("")

        if context.recent_events:
            lines.append("RECENT OS EVENTS:")
            # Only include high value info to save tokens
            for ev in context.recent_events:
                time_str = ev.occurred_at.strftime("%H:%M:%S")
                lines.append(f"- [{time_str}] [{ev.severity.upper()}] [{ev.category}] {ev.title}")
                if ev.ai_insight:
                    lines.append(f"  AI Note: {ev.ai_insight.summary}")

        if not lines:
            return "No recent events or alerts."

        return "\n".join(lines)

    async def chat_stream(self, session_id: str, message: str) -> AsyncGenerator[str, None]:
        """Process a chat message, build context, save to DB, and stream response."""
        async with self._session_factory() as db:
            chat_repo = ChatMessageRepository(db)

            # Save user message
            user_msg = ChatMessageModel(session_id=session_id, role="user", content=message)
            await chat_repo.save(user_msg)

            # Build context
            context = await self._context_builder.build_context(message, db)
            context_str = self._format_context(context)
            sys_prompt = self.SYSTEM_PROMPT.replace("{context_str}", context_str)

            # Fetch history
            history = await chat_repo.get_session_history(session_id, limit=10)

            # Format chat history into the user message block for the LLM
            # Since FallbackProvider currently takes a single user_message string,
            # we'll prepend the history to the current message if it exists.
            full_prompt = ""
            if len(history) > 1:
                full_prompt += "Previous conversation:\n"
                for h in history[:-1]:  # Exclude the one we just saved
                    role_name = "User" if h.role == "user" else "Assistant"
                    full_prompt += f"{role_name}: {h.content}\n"
                full_prompt += "\n"

            full_prompt += f"User: {message}"

            # Stream response
            full_response = ""
            options = GenerateOptions(temperature=0.5, max_tokens=1500)

            try:
                async for chunk in self._provider.stream(sys_prompt, full_prompt, options):
                    full_response += chunk
                    yield chunk
            except Exception as e:
                logger.error("chat_stream.error", error=str(e))
                err_msg = "\n\n*(Error: AI Provider connection lost or timed out.)*"
                full_response += err_msg
                yield err_msg

            # Save assistant message
            if full_response:
                assistant_msg = ChatMessageModel(
                    session_id=session_id, role="assistant", content=full_response
                )
                await chat_repo.save(assistant_msg)

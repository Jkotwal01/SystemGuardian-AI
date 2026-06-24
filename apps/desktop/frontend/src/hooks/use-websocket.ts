import { useEffect, useRef } from "react";
import { useHealthStore } from "../stores/health-store";
import { useEventStore } from "../stores/event-store";
import { HealthScoreRead, EventRead } from "../lib/types";

const WS_BASE = "ws://127.0.0.1:8765/ws";

export function useWebSockets() {
  const updateHealth = useHealthStore((s) => s.updateFromWebSocket);
  const updateEvent = useEventStore((s) => s.updateFromWebSocket);
  
  const metricsWsRef = useRef<WebSocket | null>(null);
  const eventsWsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    let mounted = true;
    let metricsTimeout: NodeJS.Timeout;
    let eventsTimeout: NodeJS.Timeout;

    const connectMetrics = () => {
      if (!mounted) return;
      const ws = new WebSocket(`${WS_BASE}/metrics`);
      metricsWsRef.current = ws;

      ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data);
          if (msg.type === "health_score") {
            updateHealth(msg.data as HealthScoreRead);
          }
        } catch (err) {
          console.error("Metrics WS parse error", err);
        }
      };

      ws.onclose = () => {
        if (mounted) metricsTimeout = setTimeout(connectMetrics, 3000);
      };
    };

    const connectEvents = () => {
      if (!mounted) return;
      const ws = new WebSocket(`${WS_BASE}/events`);
      eventsWsRef.current = ws;

      ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data);
          if (msg.type === "event") {
            updateEvent(msg.data as EventRead);
          }
        } catch (err) {
          console.error("Events WS parse error", err);
        }
      };

      ws.onclose = () => {
        if (mounted) eventsTimeout = setTimeout(connectEvents, 3000);
      };
    };

    connectMetrics();
    connectEvents();

    return () => {
      mounted = false;
      clearTimeout(metricsTimeout);
      clearTimeout(eventsTimeout);
      if (metricsWsRef.current) metricsWsRef.current.close();
      if (eventsWsRef.current) eventsWsRef.current.close();
    };
  }, [updateHealth, updateEvent]);
}

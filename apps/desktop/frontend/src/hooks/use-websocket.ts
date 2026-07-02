import { useEffect, useRef } from "react";
import { useHealthStore } from "../stores/health-store";
import { useEventStore } from "../stores/event-store";
import { useIncidentStore } from "../stores/incident-store";
import { HealthScoreRead, EventRead, IncidentRead, NotificationRead } from "../lib/types";
import { isPermissionGranted, requestPermission, sendNotification } from "@tauri-apps/plugin-notification";

const WS_BASE = "ws://127.0.0.1:8765/ws";

export function useWebSockets() {
  const updateHealth = useHealthStore((s) => s.updateFromWebSocket);
  const updateEvent = useEventStore((s) => s.updateFromWebSocket);
  const addOrUpdateIncident = useIncidentStore((s) => s.addOrUpdateIncident);
  
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
          } else if (msg.type === "incident_created" || msg.type === "incident_updated") {
            addOrUpdateIncident(msg.data as IncidentRead);
          } else if (msg.type === "notification") {
            const notif = msg.data as NotificationRead;
            triggerNativeNotification(notif);
          }
        } catch (err) {
          console.error("Events WS parse error", err);
        }
      };

      ws.onclose = () => {
        if (mounted) eventsTimeout = setTimeout(connectEvents, 3000);
      };
    };

    const triggerNativeNotification = async (notif: NotificationRead) => {
      try {
        let permissionGranted = await isPermissionGranted();
        if (!permissionGranted) {
          const permission = await requestPermission();
          permissionGranted = permission === "granted";
        }
        if (permissionGranted) {
          sendNotification({ title: notif.title, body: notif.message });
        }
      } catch (err) {
        console.error("Failed to send native notification", err);
      }
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

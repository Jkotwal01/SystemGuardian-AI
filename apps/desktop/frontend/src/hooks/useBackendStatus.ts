import { useState, useEffect } from "react";
import { api } from "../lib/api-client";

export type BackendStatus = "online" | "offline" | "connecting";

export function useBackendStatus() {
  const [status, setStatus] = useState<BackendStatus>("connecting");

  useEffect(() => {
    let mounted = true;

    async function checkStatus() {
      try {
        await api.health.ping();
        if (mounted) setStatus("online");
      } catch {
        if (mounted) setStatus("offline");
      }
    }

    checkStatus();
    const interval = setInterval(checkStatus, 5000);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  return status;
}

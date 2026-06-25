import { create } from "zustand";
import { api } from "../lib/api-client";
import { EventRead } from "../lib/types";

interface EventStore {
  recentEvents: EventRead[];
  loading: boolean;
  fetchInitial: () => Promise<void>;
  updateFromWebSocket: (event: EventRead) => void;
}

/** Retry `fn` up to `maxAttempts` times with exponential back-off. */
async function withRetry<T>(
  fn: () => Promise<T>,
  maxAttempts = 8,
  baseDelayMs = 1000
): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const delay = baseDelayMs * Math.pow(2, attempt); // 1s, 2s, 4s, 8s …
      await new Promise((res) => setTimeout(res, Math.min(delay, 30_000)));
    }
  }
  throw lastErr;
}

export const useEventStore = create<EventStore>((set) => ({
  recentEvents: [],
  loading: false,

  fetchInitial: async () => {
    set({ loading: true });
    try {
      const res = await withRetry(() => api.events.list({ limit: "10" }));
      set({ recentEvents: res.items, loading: false });
    } catch (err) {
      console.error("Failed to fetch events", err);
      set({ loading: false });
    }
  },

  updateFromWebSocket: (event) => {
    set((state) => ({
      recentEvents: [event, ...state.recentEvents].slice(0, 10),
    }));
  },
}));

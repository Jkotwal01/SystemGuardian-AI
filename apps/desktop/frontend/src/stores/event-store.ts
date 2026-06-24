import { create } from "zustand";
import { api } from "../lib/api-client";
import { EventRead } from "../lib/types";

interface EventStore {
  recentEvents: EventRead[];
  loading: boolean;
  fetchInitial: () => Promise<void>;
  updateFromWebSocket: (event: EventRead) => void;
}

export const useEventStore = create<EventStore>((set) => ({
  recentEvents: [],
  loading: false,

  fetchInitial: async () => {
    set({ loading: true });
    try {
      const res = await api.events.list({ per_page: "10" });
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

import { create } from "zustand";
import { api } from "../lib/api-client";
import { HealthScoreRead } from "../lib/types";

interface HealthStore {
  latestScore: HealthScoreRead | null;
  history: HealthScoreRead[];
  loading: boolean;
  lastUpdated: Date | null;
  fetchInitial: () => Promise<void>;
  updateFromWebSocket: (score: HealthScoreRead) => void;
}

export const useHealthStore = create<HealthStore>((set) => ({
  latestScore: null,
  history: [],
  loading: false,
  lastUpdated: null,

  fetchInitial: async () => {
    set({ loading: true });
    try {
      const [latest, historyRes] = await Promise.all([
        api.healthScore.getLatest(),
        api.healthScore.getHistory(30),
      ]);
      set({
        latestScore: latest,
        history: historyRes.items,
        loading: false,
        lastUpdated: new Date(),
      });
    } catch (err) {
      console.error("Failed to fetch health scores", err);
      set({ loading: false });
    }
  },

  updateFromWebSocket: (score) => {
    set((state) => {
      // Keep last 30 in history
      const newHistory = [score, ...state.history].slice(0, 30);
      return {
        latestScore: score,
        history: newHistory,
        lastUpdated: new Date(),
      };
    });
  },
}));

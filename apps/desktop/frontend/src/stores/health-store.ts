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

export const useHealthStore = create<HealthStore>((set) => ({
  latestScore: null,
  history: [],
  loading: false,
  lastUpdated: null,

  fetchInitial: async () => {
    set({ loading: true });
    try {
      const [latest, historyRes] = await withRetry(() =>
        Promise.all([
          api.healthScore.getLatest(),
          api.healthScore.getHistory(30),
        ])
      );
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
      const newHistory = [score, ...state.history].slice(0, 30);
      return {
        latestScore: score,
        history: newHistory,
        lastUpdated: new Date(),
      };
    });
  },
}));

import {
  EventListResponse,
  EventRead,
  EventStatsResponse,
  IncidentListResponse,
  IncidentRead,
  HealthScoreRead,
  HealthScoreHistoryResponse,
  LiveMetricsResponse,
  HardwareMetricRead,
  SecurityStatsResponse,
  AIStatusResponse,
  ChatMessageRead,
  ChatSessionRead,
  PredictionRead,
} from "./types";

export class APIError extends Error {
  constructor(
    public status: number,
    message: string,
    public isNetworkError = false
  ) {
    super(message);
    this.name = "APIError";
  }
}

class APIClient {
  private baseUrl = "http://127.0.0.1:8765";

  private async request<T>(path: string, options?: RequestInit): Promise<T> {
    try {
      const res = await fetch(`${this.baseUrl}${path}`, {
        ...options,
        headers: {
          "Content-Type": "application/json",
          ...options?.headers,
        },
      });

      if (!res.ok) {
        throw new APIError(res.status, await res.text());
      }
      
      return res.json();
    } catch (error) {
      if (error instanceof APIError) throw error;

      // TypeError: Failed to fetch → backend is not running / ECONNREFUSED
      const message = error instanceof Error ? error.message : String(error);
      const isNetworkError =
        error instanceof TypeError &&
        (message.includes("Failed to fetch") ||
          message.includes("NetworkError") ||
          message.includes("ECONNREFUSED"));

      throw new APIError(0, isNetworkError ? "Backend offline — is the backend server running?" : message, isNetworkError);
    }
  }

  // ── System health ────────────────────────────────────────────────────────
  health = {
    ping: () => this.request<{ status: string; version: string }>("/health"),
  };

  // ── Events ───────────────────────────────────────────────────────────────
  events = {
    list: (params?: Record<string, string>) => {
      const qs = params ? "?" + new URLSearchParams(params).toString() : "";
      return this.request<EventListResponse>(`/api/v1/events${qs}`);
    },
    getById: (id: string) => this.request<EventRead>(`/api/v1/events/${id}`),
    getStats: () => this.request<EventStatsResponse>("/api/v1/events/stats/summary"),
  };

  // ── Incidents ────────────────────────────────────────────────────────────
  incidents = {
    list: () => this.request<IncidentListResponse>("/api/v1/incidents"),
    getById: (id: string) => this.request<IncidentRead>(`/api/v1/incidents/${id}`),
    updateStatus: (id: string, body: { status: string; resolution_notes?: string }) => 
      this.request<IncidentRead>(`/api/v1/incidents/${id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
  };

  // ── Health Score ─────────────────────────────────────────────────────────
  healthScore = {
    getLatest: () => this.request<HealthScoreRead | null>("/api/v1/health-score"),
    getHistory: (limit = 30) => 
      this.request<HealthScoreHistoryResponse>(`/api/v1/health-score/history?limit=${limit}`),
  };

  // ── Metrics ──────────────────────────────────────────────────────────────
  metrics = {
    getLive: () => this.request<LiveMetricsResponse>("/api/v1/metrics/live"),
    getHardwareHistory: (limit = 60) =>
      this.request<{ items: HardwareMetricRead[]; total: number }>(
        `/api/v1/metrics/hardware/history?limit=${limit}`
      ),
  };

  // ── Security ─────────────────────────────────────────────────────────────
  security = {
    getStats: () => this.request<SecurityStatsResponse>("/api/v1/security/stats"),
    getEvents: (hours = 24, limit = 100) =>
      this.request<EventListResponse>(
        `/api/v1/security/events?hours=${hours}&limit=${limit}`
      ),
  };

  // ── AI ───────────────────────────────────────────────────────────────────
  ai = {
    getStatus: () => this.request<AIStatusResponse>("/api/v1/ai/status"),
  };
  // ── Chat ─────────────────────────────────────────────────────────────────
  chat = {
    getSessions: (limit = 15) =>
      this.request<ChatSessionRead[]>(`/api/v1/chat/sessions?limit=${limit}`),
    deleteSession: (sessionId: string) =>
      this.request<{ deleted: number; session_id: string }>(`/api/v1/chat/sessions/${sessionId}`, { method: "DELETE" }),
    getHistory: (sessionId: string, limit = 50) =>
      this.request<ChatMessageRead[]>(`/api/v1/chat/${sessionId}?limit=${limit}`),
  };

  // ── Predictions ──────────────────────────────────────────────────────────
  predictions = {
    getActive: () => this.request<PredictionRead[]>("/api/v1/predictions"),
    run: () => this.request<{ status: string; message: string }>("/api/v1/predictions/run", { method: "POST" }),
  };

  // ── Notifications ────────────────────────────────────────────────────────
  notifications = {
    list: (limit = 50) => this.request<import('./types').NotificationRead[]>(`/api/v1/notifications?limit=${limit}`),
    getUnreadCount: () => this.request<{ count: number }>("/api/v1/notifications/unread-count"),
    markAsRead: (id: string) => this.request<{ status: string }>(`/api/v1/notifications/${id}/read`, { method: "PATCH" }),
    markAllAsRead: () => this.request<{ status: string }>("/api/v1/notifications/read-all", { method: "POST" }),
  };

  // ── Reports ─────────────────────────────────────────────────────────────
  reports = {
    list: (limit = 20) => this.request<import('./types').ReportRead[]>(`/api/v1/reports?limit=${limit}`),
    getById: (id: string) => this.request<import('./types').ReportDetailedRead>(`/api/v1/reports/${id}`),
    generate: (type: "daily" | "weekly") => this.request<{ status: string, report_id: string }>(`/api/v1/reports/generate?report_type=${type}`, { method: "POST" }),
    getExportUrl: (id: string, format: string) => `${this.baseUrl}/api/v1/reports/${id}/export?format=${format}`,
    getViewUrl: (id: string) => `${this.baseUrl}/api/v1/reports/${id}/view`,
    delete: (id: string) => this.request<{ status: string, report_id: string }>(`/api/v1/reports/${id}`, { method: "DELETE" }),
  };

  // ── Settings ─────────────────────────────────────────────────────────────
  settings = {
    get: () => this.request<import('./types').AppSettings>("/api/v1/settings"),
    update: (settings: Partial<import('./types').AppSettings>) =>
      this.request<import('./types').AppSettings>("/api/v1/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings }),
      }),
    testAI: () => this.request<import('./types').AITestResult>("/api/v1/settings/ai-test"),
  };

  // ── System ───────────────────────────────────────────────────────────────
  system = {
    getInfo: () => this.request<import('./types').SystemInfoRead>("/api/v1/system/info"),
  };
}

export const api = new APIClient();

//
// Shared TypeScript types for SystemGuardian AI.
// These types are auto-generated from Pydantic schemas in the backend.

// Until the code-generation pipeline is set up (Phase 4),
// this file is maintained manually.
//

export type Severity = "critical" | "high" | "medium" | "low" | "info";

export type EventCategory =
  | "security"
  | "performance"
  | "hardware"
  | "network"
  | "application"
  | "storage"
  | "driver"
  | "power"
  | "stability"
  | "informational";

export type IncidentStatus =
  | "open"
  | "investigating"
  | "resolved"
  | "dismissed";

export type AIProvider = "ollama" | "gemini" | "openai" | "anthropic";

export type ReportType = "daily" | "weekly" | "monthly" | "quarterly";

// ─── Health ───────────────────────────────────────────────────────────────────

export interface HealthScores {
  overall: number;
  security: number;
  performance: number;
  hardware: number;
  network: number;
  storage: number;
  lastUpdated: string; // ISO datetime
}

export interface HealthScoreHistory {
  id: string;
  overallScore: number;
  securityScore: number;
  performanceScore: number;
  hardwareScore: number;
  networkScore: number;
  storageScore: number;
  recordedAt: string;
}

// ─── Events ───────────────────────────────────────────────────────────────────

export interface EventRead {
  id: string;
  source: string;
  sourceId: string | null;
  category: EventCategory;
  severity: Severity;
  title: string;
  rawData: Record<string, unknown>;
  normalizedData: Record<string, unknown>;
  occurredAt: string;
  collectedAt: string;
  incidentId: string | null;
}

export interface EventListResponse {
  items: EventRead[];
  total: number;
  page: number;
  perPage: number;
}

export interface EventListParams {
  page?: number;
  perPage?: number;
  severity?: Severity;
  category?: EventCategory;
  since?: string;
  until?: string;
}

// ─── Incidents ────────────────────────────────────────────────────────────────

export interface IncidentRead {
  id: string;
  title: string;
  description: string | null;
  severity: Severity;
  status: IncidentStatus;
  category: EventCategory;
  eventCount: number;
  firstSeenAt: string;
  lastSeenAt: string;
  resolvedAt: string | null;
}

// ─── WebSocket Messages ───────────────────────────────────────────────────────

export type WebSocketMessage =
  | { type: "health_score"; data: HealthScores }
  | { type: "event"; data: EventRead }
  | { type: "incident_created"; data: IncidentRead }
  | { type: "incident_updated"; data: IncidentRead }
  | { type: "notification"; data: NotificationRead };

// ─── Notifications ────────────────────────────────────────────────────────────

export interface NotificationRead {
  id: string;
  title: string;
  body: string;
  severity: Severity;
  category: EventCategory;
  createdAt: string;
  readAt: string | null;
}

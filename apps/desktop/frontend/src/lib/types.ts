export type Severity = "critical" | "high" | "medium" | "low" | "info";

export type EventCategory = 
  | "security" | "performance" | "hardware" | "network" 
  | "application" | "storage" | "driver" | "power" 
  | "stability" | "informational";

export type IncidentStatus = "open" | "investigating" | "resolved" | "dismissed";

export interface AIInsightRead {
  id: string;
  summary: string;
  explanation: string;
  recommendation: string;
}

export interface EventRead {
  id: string;
  source: string;
  source_id: string | null;
  category: EventCategory;
  severity: Severity;
  title: string;
  occurred_at: string;
  collected_at: string;
  incident_id: string | null;
  ai_insight: AIInsightRead | null;
}

export interface EventListResponse {
  items: EventRead[];
  total: number;
  page: number;
  per_page: number;
}

export interface EventStatsResponse {
  total_24h: number;
  by_category: Record<string, number>;
  by_severity: Record<string, number>;
}

export interface IncidentRead {
  id: string;
  title: string;
  description: string;
  severity: Severity;
  status: IncidentStatus;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
  resolution_notes: string | null;
  events: EventRead[];
}

export interface IncidentListResponse {
  items: IncidentRead[];
  total: number;
}

export interface HealthScoreRead {
  id: string;
  overall_score: number;
  component_scores: Record<string, number>;
  timestamp: string;
}

export interface HealthScoreHistoryResponse {
  items: HealthScoreRead[];
  total: number;
}

// ── Metrics types ─────────────────────────────────────────────────────────────

export interface HardwareMetricRead {
  id: string;
  cpu_usage_percent: number;
  memory_usage_percent: number;
  memory_total_bytes: number;
  memory_available_bytes: number;
  cpu_temperature_celsius: number | null;
  battery_percent: number | null;
  is_plugged_in: boolean | null;
  timestamp: string;
}

export interface DiskMetricRead {
  id: string;
  device: string;
  mountpoint: string;
  total_bytes: number;
  used_bytes: number;
  free_bytes: number;
  usage_percent: number;
  read_bytes_per_sec: number;
  write_bytes_per_sec: number;
  timestamp: string;
}

export interface NetworkMetricRead {
  id: string;
  interface: string;
  bytes_sent_per_sec: number;
  bytes_recv_per_sec: number;
  packets_sent_per_sec: number;
  packets_recv_per_sec: number;
  errors_in: number;
  errors_out: number;
  timestamp: string;
}

export interface LiveMetricsResponse {
  hardware: HardwareMetricRead | null;
  disks: DiskMetricRead[];
  networks: NetworkMetricRead[];
}

// ── Security types ────────────────────────────────────────────────────────────

export interface SecurityStatsResponse {
  total_security_events_24h: number;
  failed_logins_24h: number;
  successful_logins_24h: number;
  brute_force_attempts: number;
  critical_events_24h: number;
  high_events_24h: number;
  unique_sources: number;
  threats_detected_24h: number;
}

// ── AI Status types ───────────────────────────────────────────────────────────

export interface AIStatusResponse {
  ollama_available: boolean;
  gemini_available: boolean;
  active_provider: "ollama" | "gemini" | "none";
  ollama_model: string;
}

export interface ChatMessageRead {
  id: string;
  session_id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export interface ChatSessionRead {
  session_id: string;
  updated_at: string;
  title: string;
}

export interface PredictionRead {
  id: string;
  component: string;
  failure_probability: number;
  predicted_time_to_failure_hours: number | null;
  severity: Severity;
  reason: string;
  metrics_snapshot: Record<string, any> | null;
  generated_at: string;
}

export interface NotificationRead {
  id: string;
  title: string;
  message: string;
  severity: Severity;
  is_read: boolean;
  action_url: string | null;
  created_at: string;
}

export interface ReportRead {
  id: string;
  report_type: 'daily' | 'weekly';
  title: string;
  period_start: string;
  period_end: string;
  generated_at: string;
}

export interface ReportDetailedRead extends ReportRead {
  content: Record<string, any>;
}

// ── Settings ────────────────────────────────────────────────────────────────
export interface AppSettings {
  ai_provider: "ollama" | "gemini";
  ollama_base_url: string;
  ollama_model: string;
  gemini_api_key: string;
  metrics_interval_seconds: string;
  event_poll_interval_seconds: string;
  notification_min_severity: "critical" | "high" | "warning";
  notification_cooldown_minutes: string;
  event_retention_days: string;
  metric_retention_days: string;
  module_security: string;
  module_performance: string;
  module_hardware: string;
  module_network: string;
  module_storage: string;
  module_application: string;
  module_driver: string;
  module_power: string;
  onboarding_complete: string;
  [key: string]: string;
}

export interface AITestResult {
  provider: string;
  available: boolean;
  error: string | null;
}

export interface SystemInfoRead {
  hostname: string;
  os_version: string;
  uptime_seconds: number;
}

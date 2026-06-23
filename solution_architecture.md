# SystemGuardian AI — Complete Solution Architecture

> **An AI-powered operating system intelligence platform** — Production-grade, privacy-first, local-first, commercial software for everyone from home users to IT administrators.

---

## Table of Contents

1. [Complete System Architecture](#1-complete-system-architecture)
2. [Folder Structure](#2-folder-structure)
3. [Database Schema](#3-database-schema)
4. [API Design](#4-api-design)
5. [FastAPI Backend Design](#5-fastapi-backend-design)
6. [Tauri Desktop Architecture](#6-tauri-desktop-architecture)
7. [Next.js Frontend Architecture](#7-nextjs-frontend-architecture)
8. [SQLite Schema](#8-sqlite-schema)
9. [AI Workflow Design](#9-ai-workflow-design)
10. [Log Collection Design](#10-log-collection-design)
11. [Security Detection Design](#11-security-detection-design)
12. [Predictive Analytics Design](#12-predictive-analytics-design)
13. [Report Generation System](#13-report-generation-system)
14. [Notification System](#14-notification-system)
15. [Background Monitoring Services](#15-background-monitoring-services)
16. [Deployment Strategy](#16-deployment-strategy)
17. [MVP Roadmap](#17-mvp-roadmap)
18. [Production Roadmap](#18-production-roadmap)
19. [Scaling Strategy](#19-scaling-strategy)
20. [Startup Monetization Plan](#20-startup-monetization-plan)

---

## 1. Complete System Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        TAURI DESKTOP SHELL                          │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                    NEXT.JS FRONTEND                          │   │
│  │   Dashboard │ Incidents │ AI Chat │ Reports │ Settings       │   │
│  └──────────────────────┬───────────────────────────────────────┘   │
│                         │ HTTP / WebSocket / Tauri IPC              │
│  ┌──────────────────────▼───────────────────────────────────────┐   │
│  │                  FASTAPI BACKEND                             │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐   │   │
│  │  │  Log     │ │  Event   │ │   AI     │ │   Report     │   │   │
│  │  │ Collector│ │ Processor│ │ Engine   │ │  Generator   │   │   │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────────┘   │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐   │   │
│  │  │ Security │ │ Perf.    │ │Predictive│ │ Notification │   │   │
│  │  │ Engine   │ │ Engine   │ │ Engine   │ │  Engine      │   │   │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────────┘   │   │
│  └──────────────────────┬───────────────────────────────────────┘   │
│                         │                                           │
│  ┌──────────────────────▼───────────────────────────────────────┐   │
│  │                  SQLITE DATABASE                             │   │
│  │   Events │ Incidents │ Metrics │ Reports │ AI Insights       │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                  OS COLLECTION LAYER                         │   │
│  │   Windows Event Log │ WMI │ SMART │ ETW │ Perf Counters      │   │
│  │   Linux: Journald │ Syslog │ Proc FS │ Auditd               │   │
│  └──────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
                              │ Optional
                   ┌──────────▼──────────┐
                   │   AI PROVIDERS      │
                   │  Ollama (Local)     │
                   │  Gemini / OpenAI    │
                   │  Anthropic          │
                   └─────────────────────┘
```

### Core Subsystem Relationships

```
OS Events
   │
   ▼
[Log Collector] ──► [Event Normalizer] ──► [Severity Classifier]
                                                    │
                          ┌─────────────────────────┤
                          │                         │
                    [Correlation Engine]    [Security Engine]
                          │                         │
                    [Incident Builder]     [Threat Detector]
                          │                         │
                          └─────────────┬───────────┘
                                        │
                              [AI Explanation Engine]
                                        │
                              [Predictive Analytics]
                                        │
                              [Recommendation Engine]
                                        │
                    ┌───────────────────┴────────────────────┐
                    │                                        │
              [Report Engine]                    [Notification Engine]
                    │                                        │
              [SQLite Store]                     [Desktop Alerts]
```

---

## 2. Folder Structure

```
system-guardian-ai/
├── .github/
│   ├── workflows/
│   │   ├── build-windows.yml
│   │   ├── build-linux.yml
│   │   └── release.yml
│   └── ISSUE_TEMPLATE/
│
├── apps/
│   ├── desktop/                          # Tauri App
│   │   ├── src-tauri/
│   │   │   ├── src/
│   │   │   │   ├── main.rs
│   │   │   │   ├── commands/
│   │   │   │   │   ├── mod.rs
│   │   │   │   │   ├── system.rs
│   │   │   │   │   ├── backend.rs
│   │   │   │   │   └── notifications.rs
│   │   │   │   ├── services/
│   │   │   │   │   ├── mod.rs
│   │   │   │   │   ├── backend_process.rs
│   │   │   │   │   ├── system_tray.rs
│   │   │   │   │   └── auto_start.rs
│   │   │   │   └── utils/
│   │   │   │       └── paths.rs
│   │   │   ├── tauri.conf.json
│   │   │   ├── Cargo.toml
│   │   │   └── icons/
│   │   │
│   │   └── frontend/                     # Next.js App
│   │       ├── app/
│   │       │   ├── layout.tsx
│   │       │   ├── page.tsx
│   │       │   ├── (dashboard)/
│   │       │   │   ├── layout.tsx
│   │       │   │   ├── overview/page.tsx
│   │       │   │   ├── security/page.tsx
│   │       │   │   ├── performance/page.tsx
│   │       │   │   ├── hardware/page.tsx
│   │       │   │   ├── network/page.tsx
│   │       │   │   ├── storage/page.tsx
│   │       │   │   ├── incidents/page.tsx
│   │       │   │   ├── incidents/[id]/page.tsx
│   │       │   │   ├── ai-assistant/page.tsx
│   │       │   │   ├── reports/page.tsx
│   │       │   │   └── settings/page.tsx
│   │       ├── components/
│   │       │   ├── ui/
│   │       │   ├── dashboard/
│   │       │   ├── security/
│   │       │   ├── ai/
│   │       │   ├── reports/
│   │       │   └── layout/
│   │       ├── hooks/
│   │       ├── lib/
│   │       ├── stores/
│   │       └── types/
│
├── backend/
│   ├── app/
│   │   ├── main.py
│   │   ├── config.py
│   │   ├── api/v1/
│   │   ├── core/
│   │   ├── models/
│   │   ├── schemas/
│   │   ├── collectors/
│   │   │   ├── windows/
│   │   │   └── linux/
│   │   ├── processors/
│   │   ├── engines/
│   │   ├── ai/
│   │   ├── reports/
│   │   ├── notifications/
│   │   └── services/
│   ├── alembic/
│   ├── tests/
│   └── requirements.txt
│
├── installer/
├── scripts/
├── docs/
└── README.md
```

---

## 3. Database Schema (Key Tables)

```sql
-- Events
CREATE TABLE events (
    id TEXT PRIMARY KEY,
    source TEXT NOT NULL,
    source_id TEXT,
    category TEXT NOT NULL,
    severity TEXT NOT NULL,
    title TEXT NOT NULL,
    raw_data TEXT,
    normalized_data TEXT,
    occurred_at DATETIME NOT NULL,
    collected_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    incident_id TEXT REFERENCES incidents(id)
);

-- Incidents
CREATE TABLE incidents (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    severity TEXT NOT NULL,
    status TEXT DEFAULT 'open',
    started_at DATETIME NOT NULL,
    ai_summary TEXT,
    ai_root_cause TEXT,
    ai_confidence REAL,
    recommendations TEXT
);

-- AI Insights
CREATE TABLE ai_insights (
    id TEXT PRIMARY KEY,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    provider TEXT NOT NULL,
    model TEXT,
    insight_type TEXT NOT NULL,
    content TEXT NOT NULL,
    confidence REAL,
    generated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Hardware Metrics (Time-Series)
CREATE TABLE hardware_metrics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    recorded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    cpu_usage REAL, cpu_temp REAL,
    ram_usage_pct REAL, ram_used_gb REAL,
    gpu_usage REAL, gpu_temp REAL,
    battery_pct REAL, battery_health REAL
);

-- Predictions
CREATE TABLE predictions (
    id TEXT PRIMARY KEY,
    prediction_type TEXT NOT NULL,
    probability REAL NOT NULL,
    confidence REAL NOT NULL,
    time_horizon TEXT,
    severity TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    recommended_actions TEXT
);

-- Health Scores (History)
CREATE TABLE health_scores (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    recorded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    overall_score INTEGER NOT NULL,
    security_score INTEGER,
    performance_score INTEGER,
    hardware_score INTEGER,
    network_score INTEGER,
    storage_score INTEGER
);

-- Reports
CREATE TABLE reports (
    id TEXT PRIMARY KEY,
    report_type TEXT NOT NULL,
    title TEXT NOT NULL,
    period_start DATETIME NOT NULL,
    period_end DATETIME NOT NULL,
    content TEXT NOT NULL,
    generated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Notifications
CREATE TABLE notifications (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    severity TEXT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Chat History
CREATE TABLE chat_messages (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

---

## 4. API Design

```
Base URL: http://localhost:8765/api/v1

GET    /health/scores/breakdown
GET    /events
GET    /events/{id}
GET    /events/stream              (SSE)
POST   /events/search
GET    /incidents
GET    /incidents/{id}
POST   /ai/explain
POST   /ai/chat
GET    /ai/recommendations
GET    /metrics/hardware
GET    /predictions
GET    /security/threats
GET    /reports
POST   /reports/generate
GET    /reports/{id}/export?format=pdf
GET    /notifications
POST   /actions/clear-temp-files
POST   /actions/run-health-scan
GET    /settings
PUT    /settings

WS     /ws/events
WS     /ws/metrics
WS     /ws/notifications
```

---

## 5. AI Workflow Design

```
Event/Incident → Context Builder → Prompt Template
→ AI Provider (Ollama/Gemini/OpenAI) → Structured Response
→ Store in ai_insights → Push to Frontend
```

### AI Providers

- **Ollama** (Local — default): Llama 3.2, Gemma 2, Mistral
- **Gemini** (Cloud — optional)
- **OpenAI** (Cloud — optional)
- **Anthropic** (Cloud — optional)

### AI Use Cases

| Use Case | Input | Output |
|----------|-------|--------|
| Event Explanation | Raw event data | Natural language explanation |
| Root Cause Analysis | Incident + related events | Cause chain + evidence |
| Predictive Analysis | Trend data | Probability + time horizon |
| AI Assistant | User question | Contextual answer |
| Recommendations | Health data | Actionable steps |
| Report Narrative | Report data | Human-readable summary |

---

## 6. Security Detection Design

### MITRE ATT&CK Aligned Rules

| Rule ID | Threat | Event Signal | MITRE ID | Default Severity |
|---------|--------|--------------|----------|-----------------|
| SEC-001 | Brute Force | Event 4625 × 5 in 10 min | T1110 | High |
| SEC-002 | Log Tampering | Event 1102 | T1070.001 | Critical |
| SEC-003 | New Service | Event 7045 | T1543.003 | High |
| SEC-004 | Privilege Escalation | Event 4728/4732 | T1078 | Critical |
| SEC-005 | Account Lockout | Event 4740 | T1110.001 | Medium |
| SEC-006 | Scheduled Task Created | Event 4698 | T1053.005 | High |
| SEC-007 | Unexpected Reboot | Event 41/6008 | T1529 | High |
| SEC-008 | Defender Disabled | Service stopped | T1562.001 | Critical |

---

## 7. Predictive Analytics Design

| Predictor | Data | Key Metric | Threshold |
|-----------|------|-----------|-----------|
| SSD Failure | SMART | Reallocated sectors trend | slope > 0.5 |
| Battery Degradation | Battery API | Capacity vs original | < 80% |
| Thermal Throttling | Temp history | Sustained > 85°C | > 3 hours |
| Storage Exhaustion | Disk usage | Growth rate | > 95% in 30 days |
| Crash Probability | Crash events | Frequency trend | > 3/week |
| Driver Instability | Driver events | Error rate | > 5/day |

---

## 8. Deployment Strategy

### Build Pipeline

```
Next.js → Static Export
Python Backend → PyInstaller → Single .exe
Tauri bundles → Frontend + Backend .exe → Installer
Windows: .msi + NSIS Setup
Linux: .deb + .rpm + AppImage
```

---

## 9. MVP Roadmap (16 Weeks)

### Phase 1 (Weeks 1-4): Foundation
- Tauri + Next.js + FastAPI skeleton
- SQLite setup
- Windows Event Log collection
- Basic performance metrics
- Simple dashboard

### Phase 2 (Weeks 5-8): Intelligence
- Security detection rules
- AI event explanation
- Event correlation
- Desktop notifications

### Phase 3 (Weeks 9-12): AI & Reports
- AI chat assistant
- Root cause analysis
- Daily/weekly reports + PDF export
- Predictive analytics (SSD, battery)

### Phase 4 (Weeks 13-16): Polish & Release
- Onboarding wizard
- Windows installer (.msi)
- Linux packages
- Cloud AI providers
- Full UI polish

---

## 10. Monetization Plan

| Tier | Price | Features |
|------|-------|---------|
| Free | $0 | Basic monitoring, 7-day history, Ollama AI |
| Personal Pro | $4.99/mo | All modules, 90-day history, all AI providers, PDF reports |
| Developer | $9.99/mo | Pro + API access, CLI, webhooks |
| Business | $29/mo | Up to 10 devices, team dashboard |
| Enterprise | Custom | Fleet monitoring, compliance, SIEM integration |

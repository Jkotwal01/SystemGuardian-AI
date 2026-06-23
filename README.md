# SystemGuardian AI

> **AI-powered operating system intelligence platform** — Local-first, privacy-first, production-grade desktop application for Windows.

[![CI](https://github.com/your-org/system-guardian-ai/actions/workflows/ci.yml/badge.svg)](https://github.com/your-org/system-guardian-ai/actions/workflows/ci.yml)
[![License](https://img.shields.io/badge/license-Commercial-blue.svg)]()
[![Platform](https://img.shields.io/badge/platform-Windows%2010%2F11-blue.svg)]()

---

## What It Does

SystemGuardian AI continuously monitors your Windows PC, collects OS logs, analyzes events with AI, detects problems before they cause failures, and explains everything in plain language.

**8 Monitoring Modules:**
- 🔐 Security — Login failures, privilege escalation, audit log tampering
- ⚡ Performance — CPU, RAM, process anomalies
- 🖥️ Hardware — Temperatures, fan speeds, SMART disk health
- 🌐 Network — I/O stats, firewall events, connection anomalies
- 📦 Application — App crashes, error events
- 💾 Storage — Disk usage, SMART predictions
- 🔌 Driver — Driver failures, service crashes
- 🔋 Power — Battery health, power events

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Desktop shell | **Tauri 2** (Rust) |
| Frontend | **Next.js 14** (TypeScript) |
| Backend | **FastAPI** (Python 3.11) |
| Database | **SQLite** via SQLAlchemy 2 async |
| AI (primary) | **Ollama** (local LLM) |
| AI (fallback) | **Google Gemini** (bring your own key) |

---

## Prerequisites

- **Windows 10** (build 1903+) or **Windows 11**
- **Node.js** 20+
- **Python** 3.11+
- **Rust** (stable) + Cargo
- **Ollama** (for local AI) — [install separately](https://ollama.ai)

---

## Quick Start (Development)

```powershell
# 1. Clone the repository
git clone https://github.com/your-org/system-guardian-ai.git
cd system-guardian-ai

# 2. Set up backend virtual environment
cd backend
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -e ".[dev]"
cd ..

# 3. Install frontend dependencies
cd apps/desktop/frontend
npm install
cd ../../..

# 4. Start everything (one command)
pwsh scripts/dev.ps1
```

---

## Project Structure

```
system-guardian-ai/
├── .github/workflows/      # CI/CD pipelines
├── apps/desktop/
│   ├── src-tauri/          # Rust — Tauri shell + backend process manager
│   └── frontend/           # Next.js — UI
├── backend/                # FastAPI — monitoring engine + AI + API
├── shared/types/           # Shared TypeScript types
├── scripts/                # dev.ps1, test.ps1, build.ps1
└── docs/                   # Architecture, API reference
```

---

## Running Tests

```powershell
# All tests
pwsh scripts/test.ps1

# Backend only (pytest + coverage)
pwsh scripts/test.ps1 -Backend

# Frontend only (Vitest + TypeScript)
pwsh scripts/test.ps1 -Frontend

# Rust only (cargo test + check)
pwsh scripts/test.ps1 -Rust
```

---

## Implementation Phases

See [`implemt_plan.md`](implemt_plan.md) for the full 12-phase plan.

| Phase | Description | Status |
|-------|-------------|--------|
| 0 | Project Foundation & Tooling | 🔄 In Progress |
| 1 | Domain Layer & Database | ⏳ Pending |
| 2 | Windows Data Collection | ⏳ Pending |
| 3 | Event Processing Pipeline | ⏳ Pending |
| 4 | Tauri Shell & Next.js Foundation | ⏳ Pending |
| 5 | Live Dashboard & Real-Time | ⏳ Pending |
| 6 | AI Integration | ⏳ Pending |
| 7 | Incident Management & Security UI | ⏳ Pending |
| 8 | AI Chat Assistant | ⏳ Pending |
| 9 | Predictive Analytics | ⏳ Pending |
| 10 | Reports & Notifications | ⏳ Pending |
| 11 | Onboarding & Settings | ⏳ Pending |
| 12 | Production Build & Installer | ⏳ Pending |

---

## Architecture

See [`solution_architecture.md`](solution_architecture.md) for the full architecture document covering system design, database schema, API design, AI workflow, security detection, and deployment strategy.

---

## License

Commercial — All rights reserved. See LICENSE for details.

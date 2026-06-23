#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Start all SystemGuardian AI services for local development.
.DESCRIPTION
    Launches FastAPI backend, Next.js frontend, and Tauri dev window.
    All services must be healthy before the Tauri window opens.
.EXAMPLE
    pwsh scripts/dev.ps1
#>

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$RootDir   = Split-Path -Parent $PSScriptRoot
$BackendDir = Join-Path $RootDir "backend"
$FrontendDir = Join-Path $RootDir "apps\desktop\frontend"
$TauriDir   = Join-Path $RootDir "apps\desktop"

function Write-Step {
    param([string]$Message)
    Write-Host "`n==> $Message" -ForegroundColor Cyan
}

function Test-BackendReady {
    param([string]$Url = "http://127.0.0.1:8765/health", [int]$MaxAttempts = 20)
    for ($i = 0; $i -lt $MaxAttempts; $i++) {
        try {
            $resp = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 2 -ErrorAction Stop
            if ($resp.StatusCode -eq 200) { return $true }
        } catch { <# not ready yet #> }
        Start-Sleep -Milliseconds 500
    }
    return $false
}

# ─── 1. Backend ──────────────────────────────────────────────────────────────
Write-Step "Starting FastAPI backend (port 8765)..."
$backendJob = Start-Process pwsh -ArgumentList @(
    "-NoExit", "-c",
    "Set-Location '$BackendDir'; " +
    "if (-not (Test-Path .venv)) { python -m venv .venv }; " +
    ".venv\Scripts\Activate.ps1; " +
    "pip install -q -e '.[dev]'; " +
    "python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8765"
) -PassThru

Write-Host "  Waiting for backend to be ready..." -ForegroundColor Yellow
if (-not (Test-BackendReady)) {
    Write-Error "Backend failed to become ready within 10 seconds."
    exit 1
}
Write-Host "  Backend is ready!" -ForegroundColor Green

# ─── 2. Frontend ─────────────────────────────────────────────────────────────
Write-Step "Starting Next.js frontend (port 3000)..."
Start-Process pwsh -ArgumentList @(
    "-NoExit", "-c",
    "Set-Location '$FrontendDir'; npm install; npm run dev"
)

# Give Next.js a moment to start
Start-Sleep -Seconds 3

# ─── 3. Tauri ────────────────────────────────────────────────────────────────
Write-Step "Starting Tauri dev window..."
Set-Location $TauriDir
cargo tauri dev

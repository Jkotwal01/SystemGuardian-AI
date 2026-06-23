#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Build SystemGuardian AI production installer.
.DESCRIPTION
    1. Packages the FastAPI backend with PyInstaller
    2. Builds the Next.js frontend (static export)
    3. Bundles everything with Tauri into a Windows installer (.msi + .exe)
.EXAMPLE
    pwsh scripts/build.ps1
    pwsh scripts/build.ps1 -SkipBackend  # Skip PyInstaller (dev build)
#>

param(
    [switch]$SkipBackend,
    [switch]$SkipFrontend
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$RootDir     = Split-Path -Parent $PSScriptRoot
$BackendDir  = Join-Path $RootDir "backend"
$FrontendDir = Join-Path $RootDir "apps\desktop\frontend"
$TauriDir    = Join-Path $RootDir "apps\desktop"

function Write-Step {
    param([string]$Message)
    Write-Host "`n==> $Message" -ForegroundColor Cyan
}

# ─── 1. Backend → PyInstaller ─────────────────────────────────────────────────
if (-not $SkipBackend) {
    Write-Step "Building backend executable with PyInstaller..."
    Push-Location $BackendDir
    if (Test-Path .venv) { .venv\Scripts\Activate.ps1 }
    pip install -q pyinstaller
    pyinstaller `
        --name sgai-backend `
        --onefile `
        --hidden-import uvicorn.logging `
        --hidden-import uvicorn.loops.auto `
        --hidden-import uvicorn.protocols.http.auto `
        --hidden-import uvicorn.protocols.websockets.auto `
        --hidden-import uvicorn.lifespan.on `
        --add-data "alembic;alembic" `
        --add-data "alembic.ini;." `
        app/main.py
    Pop-Location
    Write-Host "  Backend executable: backend/dist/sgai-backend.exe" -ForegroundColor Green
}

# ─── 2. Frontend → Static Export ─────────────────────────────────────────────
if (-not $SkipFrontend) {
    Write-Step "Building Next.js frontend (static export)..."
    Push-Location $FrontendDir
    npm ci
    npm run build
    Pop-Location
    Write-Host "  Frontend output: apps/desktop/frontend/out/" -ForegroundColor Green
}

# ─── 3. Tauri → Installer ────────────────────────────────────────────────────
Write-Step "Building Tauri installer..."
Push-Location $TauriDir
cargo tauri build
Pop-Location

Write-Host ""
Write-Host "✅ Build complete!" -ForegroundColor Green
Write-Host "  Installer: apps/desktop/src-tauri/target/release/bundle/" -ForegroundColor Yellow

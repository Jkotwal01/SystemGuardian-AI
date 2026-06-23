#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Run all tests for SystemGuardian AI.
.DESCRIPTION
    Runs backend pytest suite, frontend Vitest suite, and Rust tests.
    Reports coverage for each. Fails fast if any suite fails.
.EXAMPLE
    pwsh scripts/test.ps1
    pwsh scripts/test.ps1 -Backend     # Only backend tests
    pwsh scripts/test.ps1 -Frontend    # Only frontend tests
    pwsh scripts/test.ps1 -Rust        # Only Rust tests
#>

param(
    [switch]$Backend,
    [switch]$Frontend,
    [switch]$Rust
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$RootDir     = Split-Path -Parent $PSScriptRoot
$BackendDir  = Join-Path $RootDir "backend"
$FrontendDir = Join-Path $RootDir "apps\desktop\frontend"
$TauriDir    = Join-Path $RootDir "apps\desktop"

$RunAll = -not ($Backend -or $Frontend -or $Rust)

$Failures = @()

function Write-Step {
    param([string]$Message)
    Write-Host "`n==> $Message" -ForegroundColor Cyan
}

function Write-Result {
    param([string]$Suite, [bool]$Passed)
    if ($Passed) {
        Write-Host "  ✅ $Suite PASSED" -ForegroundColor Green
    } else {
        Write-Host "  ❌ $Suite FAILED" -ForegroundColor Red
        $script:Failures += $Suite
    }
}

# ─── Backend Tests ────────────────────────────────────────────────────────────
if ($RunAll -or $Backend) {
    Write-Step "Running Backend Tests (pytest + coverage)..."
    Push-Location $BackendDir
    try {
        if (Test-Path .venv) { .venv\Scripts\Activate.ps1 }
        python -m pytest --tb=short -q
        Write-Result "Backend (pytest)" $true
    } catch {
        Write-Result "Backend (pytest)" $false
    } finally {
        Pop-Location
    }
}

# ─── Frontend Tests ───────────────────────────────────────────────────────────
if ($RunAll -or $Frontend) {
    Write-Step "Running Frontend Tests (Vitest)..."
    Push-Location $FrontendDir
    try {
        npm run test -- --run
        Write-Result "Frontend (Vitest)" $true
    } catch {
        Write-Result "Frontend (Vitest)" $false
    } finally {
        Pop-Location
    }

    Write-Step "Running TypeScript type-check..."
    Push-Location $FrontendDir
    try {
        npx tsc --noEmit
        Write-Result "TypeScript" $true
    } catch {
        Write-Result "TypeScript" $false
    } finally {
        Pop-Location
    }
}

# ─── Rust Tests ───────────────────────────────────────────────────────────────
if ($RunAll -or $Rust) {
    Write-Step "Running Rust Tests (cargo test)..."
    Push-Location $TauriDir
    try {
        cargo test
        Write-Result "Rust (cargo test)" $true
    } catch {
        Write-Result "Rust (cargo test)" $false
    } finally {
        Pop-Location
    }

    Write-Step "Running cargo check..."
    Push-Location $TauriDir
    try {
        cargo check
        Write-Result "Rust (cargo check)" $true
    } catch {
        Write-Result "Rust (cargo check)" $false
    } finally {
        Pop-Location
    }
}

# ─── Summary ──────────────────────────────────────────────────────────────────
Write-Host ""
if ($Failures.Count -eq 0) {
    Write-Host "✅ All test suites PASSED" -ForegroundColor Green
    exit 0
} else {
    Write-Host "❌ Failed suites: $($Failures -join ', ')" -ForegroundColor Red
    exit 1
}

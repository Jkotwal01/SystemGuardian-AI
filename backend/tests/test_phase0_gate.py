"""
Phase 0 Gate Tests
==================
These tests verify the monorepo foundation is correctly set up.
All must pass before Phase 1 work begins.

Run with:  pytest tests/test_phase0_gate.py -v
"""

from __future__ import annotations

import importlib
import sys
from pathlib import Path

# ─── Environment Checks ───────────────────────────────────────────────────────


def test_python_version_is_311_or_higher() -> None:
    """Python version must be 3.11+ for StrEnum and other modern features."""
    major, minor = sys.version_info.major, sys.version_info.minor
    assert (major, minor) >= (3, 11), (
        f"Python 3.11+ required, got {major}.{minor}. "
        "Python 3.11, 3.12, and 3.13 are all supported."
    )


def test_fastapi_importable() -> None:
    """FastAPI must be installed."""
    fastapi = importlib.import_module("fastapi")
    assert fastapi is not None


def test_sqlalchemy_importable() -> None:
    """SQLAlchemy 2.x must be installed."""
    sa = importlib.import_module("sqlalchemy")
    version = tuple(int(x) for x in sa.__version__.split(".")[:2])
    assert version >= (2, 0), f"SQLAlchemy 2.x required, got {sa.__version__}"


def test_pydantic_v2_importable() -> None:
    """Pydantic v2 must be installed."""
    pydantic = importlib.import_module("pydantic")
    version = tuple(int(x) for x in pydantic.__version__.split(".")[:2])
    assert version >= (2, 0), f"Pydantic v2 required, got {pydantic.__version__}"


def test_uvicorn_importable() -> None:
    """Uvicorn must be installed."""
    uvicorn = importlib.import_module("uvicorn")
    assert uvicorn is not None


def test_structlog_importable() -> None:
    """structlog must be installed for structured logging."""
    structlog = importlib.import_module("structlog")
    assert structlog is not None


def test_aiosqlite_importable() -> None:
    """aiosqlite must be installed for async SQLite support."""
    aiosqlite = importlib.import_module("aiosqlite")
    assert aiosqlite is not None


def test_apscheduler_importable() -> None:
    """APScheduler must be installed for background jobs."""
    apscheduler = importlib.import_module("apscheduler")
    assert apscheduler is not None


# ─── Folder Structure Checks ──────────────────────────────────────────────────

ROOT = Path(__file__).parent.parent.parent  # backend/ parent = repo root


def test_backend_package_structure() -> None:
    """All required backend packages must exist."""
    required_dirs = [
        "app",
        "app/core",
        "app/domain",
        "app/models",
        "app/schemas",
        "app/repositories",
        "app/collectors",
        "app/collectors/windows",
        "app/processors",
        "app/engines",
        "app/api",
        "app/api/v1",
    ]
    backend_root = Path(__file__).parent.parent  # backend/
    for d in required_dirs:
        assert (backend_root / d).is_dir(), f"Missing directory: backend/{d}"
        assert (backend_root / d / "__init__.py").exists(), f"Missing __init__.py in: backend/{d}"


def test_scripts_exist() -> None:
    """All PowerShell scripts must exist."""
    scripts_dir = ROOT / "scripts"
    for script in ["dev.ps1", "test.ps1", "build.ps1"]:
        assert (scripts_dir / script).exists(), f"Missing script: scripts/{script}"


def test_github_workflows_exist() -> None:
    """All GitHub Actions workflows must exist."""
    workflows_dir = ROOT / ".github" / "workflows"
    for workflow in ["ci.yml", "build-windows.yml", "release.yml"]:
        assert (workflows_dir / workflow).exists(), (
            f"Missing workflow: .github/workflows/{workflow}"
        )


def test_gitignore_exists() -> None:
    """Root .gitignore must exist."""
    assert (ROOT / ".gitignore").exists()


def test_editorconfig_exists() -> None:
    """Root .editorconfig must exist."""
    assert (ROOT / ".editorconfig").exists()


def test_root_package_json_exists() -> None:
    """Root package.json must exist with workspaces config."""
    import json

    pkg_path = ROOT / "package.json"
    assert pkg_path.exists()
    pkg = json.loads(pkg_path.read_text())
    assert "workspaces" in pkg
    assert "apps/desktop/frontend" in pkg["workspaces"]


# ─── App Startup Checks ───────────────────────────────────────────────────────


def test_app_main_importable() -> None:
    """app.main must be importable without errors."""
    main = importlib.import_module("app.main")
    assert hasattr(main, "app"), "app.main must expose 'app' (FastAPI instance)"


def test_health_endpoint_returns_ok() -> None:
    """GET /health must return 200 {"status": "ok"}."""
    from fastapi.testclient import TestClient

    from app.main import app

    with TestClient(app) as client:
        response = client.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ok"
        assert "version" in data

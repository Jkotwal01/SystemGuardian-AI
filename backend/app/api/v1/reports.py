from typing import Any
from collections.abc import AsyncGenerator
from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import DatabaseManager
from app.domain.enums import ReportType
from app.reports.builder import DailyReportBuilder, WeeklyReportBuilder, ReportBuilder
from app.reports.exporters.factory import ExporterFactory
from app.repositories.report_repository import ReportRepository

router = APIRouter(prefix="/reports", tags=["reports"])


async def get_session() -> AsyncGenerator[AsyncSession, None]:
    async with DatabaseManager.get_session_factory()() as session:
        yield session


def utcnow() -> datetime:
    return datetime.now(tz=UTC)


# ── Fixed-path routes first (must come before /{report_id}) ──────────────────


@router.get("")
@router.get("/")
async def get_reports(limit: int = 20, db: AsyncSession = Depends(get_session)) -> Any:
    """List historical reports, newest first."""
    repo = ReportRepository(db)
    reports = await repo.get_recent(limit=limit)
    return [
        {
            "id": r.id,
            "report_type": r.report_type,
            "title": r.title,
            "period_start": r.period_start,
            "period_end": r.period_end,
            "generated_at": r.generated_at,
        }
        for r in reports
    ]


@router.post("/generate")
async def generate_report(
    request: Request,
    report_type: ReportType = Query(ReportType.DAILY),
    db: AsyncSession = Depends(get_session),
) -> Any:
    """Manually trigger report generation (with AI analysis)."""
    end = utcnow()

    # Get AI provider from app state if available
    ai_provider = getattr(request.app.state, "ai_assistant", None)
    if ai_provider:
        ai_provider = ai_provider._provider  # Extract the raw provider from AIAssistant

    if report_type == ReportType.DAILY:
        start = end - timedelta(days=1)
        builder: ReportBuilder = DailyReportBuilder(db, ai_provider=ai_provider)
    else:
        start = end - timedelta(days=7)
        builder = WeeklyReportBuilder(db, ai_provider=ai_provider)

    report = await builder.build(start, end)
    repo = ReportRepository(db)
    await repo.save(report)
    return {"status": "success", "report_id": report.id}


# ── Parameterized routes (/{report_id}) ──────────────────────────────────────


@router.get("/{report_id}/view", response_class=Response)
async def view_report_html(report_id: str, db: AsyncSession = Depends(get_session)) -> Any:
    """Render the report as HTML inline (same as HTML export but no download header)."""
    repo = ReportRepository(db)
    report = await repo.get_by_id(report_id)
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    exporter = ExporterFactory.create("html")
    export_data = {
        "title": report.title,
        "report_type": report.report_type,
        "period_start": report.period_start.isoformat(),
        "period_end": report.period_end.isoformat(),
        "generated_at": report.generated_at.isoformat(),
        "content": report.content,
    }
    html_content = exporter.export(export_data)
    if isinstance(html_content, str):
        html_content = html_content.encode("utf-8")
    return Response(content=html_content, media_type="text/html")


@router.get("/{report_id}/export")
async def export_report(
    report_id: str, format: str = Query("html"), db: AsyncSession = Depends(get_session)
) -> Any:
    """Export a report as a downloadable file (html or json)."""
    repo = ReportRepository(db)
    report = await repo.get_by_id(report_id)
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    try:
        exporter = ExporterFactory.create(format)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    export_data = {
        "title": report.title,
        "report_type": report.report_type,
        "period_start": report.period_start.isoformat(),
        "period_end": report.period_end.isoformat(),
        "generated_at": report.generated_at.isoformat(),
        "content": report.content,
    }

    content = exporter.export(export_data)
    headers = {
        "Content-Disposition": f'attachment; filename="report_{report_id}.{exporter.get_extension()}"'
    }
    if isinstance(content, str):
        content = content.encode("utf-8")

    return Response(content=content, media_type=exporter.get_content_type(), headers=headers)


@router.get("/{report_id}")
async def get_report(report_id: str, db: AsyncSession = Depends(get_session)) -> Any:
    """Get a specific report with full content payload."""
    repo = ReportRepository(db)
    report = await repo.get_by_id(report_id)
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    return {
        "id": report.id,
        "report_type": report.report_type,
        "title": report.title,
        "period_start": report.period_start.isoformat(),
        "period_end": report.period_end.isoformat(),
        "generated_at": report.generated_at.isoformat(),
        "content": report.content,
    }


@router.delete("/{report_id}")
async def delete_report(report_id: str, db: AsyncSession = Depends(get_session)) -> Any:
    """Permanently delete a report from the database."""
    repo = ReportRepository(db)
    deleted = await repo.delete(report_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Report not found")
    return {"status": "deleted", "report_id": report_id}

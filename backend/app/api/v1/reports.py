from datetime import datetime, timedelta, timezone
from collections.abc import AsyncGenerator
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import DatabaseManager
from app.repositories.report_repository import ReportRepository
from app.reports.builder import DailyReportBuilder, WeeklyReportBuilder
from app.reports.exporters.factory import ExporterFactory
from app.domain.enums import ReportType

router = APIRouter(prefix="/reports", tags=["reports"])

async def get_session() -> AsyncGenerator[AsyncSession, None]:
    async with DatabaseManager.get_session_factory()() as session:
        yield session

def utcnow() -> datetime:
    return datetime.now(tz=timezone.utc)

@router.get("")
@router.get("/")
async def get_reports(limit: int = 20, db: AsyncSession = Depends(get_session)):
    """List historical reports."""
    repo = ReportRepository(db)
    reports = await repo.get_recent(limit=limit)
    return [{
        "id": r.id,
        "report_type": r.report_type,
        "title": r.title,
        "period_start": r.period_start,
        "period_end": r.period_end,
        "generated_at": r.generated_at
    } for r in reports]

@router.post("/generate")
async def generate_report(
    report_type: ReportType = Query(ReportType.DAILY),
    db: AsyncSession = Depends(get_session)
):
    """Manually trigger report generation."""
    end = utcnow()
    if report_type == ReportType.DAILY:
        start = end - timedelta(days=1)
        builder = DailyReportBuilder(db)
    else:
        start = end - timedelta(days=7)
        builder = WeeklyReportBuilder(db)

    report = await builder.build(start, end)
    repo = ReportRepository(db)
    await repo.save(report)
    return {"status": "success", "report_id": report.id}

@router.get("/{report_id}/export")
async def export_report(
    report_id: str,
    format: str = Query("json"),
    db: AsyncSession = Depends(get_session)
):
    """Export a report in the specified format (json, html, csv, pdf)."""
    repo = ReportRepository(db)
    report = await repo.get_by_id(report_id)
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    try:
        exporter = ExporterFactory.create(format)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    # Construct the data object to export
    export_data = {
        "title": report.title,
        "report_type": report.report_type,
        "period_start": report.period_start.isoformat(),
        "period_end": report.period_end.isoformat(),
        "generated_at": report.generated_at.isoformat(),
        "content": report.content
    }

    content = exporter.export(export_data)
    
    headers = {
        "Content-Disposition": f'attachment; filename="report_{report_id}.{exporter.get_extension()}"'
    }
    
    # If the exporter returned string, encode it to bytes.
    if isinstance(content, str):
        content = content.encode("utf-8")

    return Response(content=content, media_type=exporter.get_content_type(), headers=headers)

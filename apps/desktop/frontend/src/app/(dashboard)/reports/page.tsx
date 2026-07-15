"use client";

import { useEffect, useState } from "react";
import { FileText, Play, Clock, Eye, FileDown, Trash2, AlertCircle } from "lucide-react";
import { open } from "@tauri-apps/plugin-shell";
import { api } from "@/lib/api-client";
import { ReportRead } from "@/lib/types";
import { ReportViewerModal } from "@/components/reports/ReportViewerModal";

export default function ReportsPage() {
  const [reports, setReports] = useState<ReportRead[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [selectedReport, setSelectedReport] = useState<ReportRead | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  async function fetchReports() {
    try {
      const data = await api.reports.list();
      setReports(data);
    } catch (error) {
      console.error("Failed to fetch reports:", error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchReports();
  }, []);

  async function handleGenerate(type: "daily" | "weekly") {
    setGenerating(true);
    try {
      await api.reports.generate(type);
      await fetchReports();
    } catch (error) {
      console.error("Failed to generate report:", error);
    } finally {
      setGenerating(false);
    }
  }

  async function handleExportHtml(id: string) {
    const url = api.reports.getExportUrl(id, "html");
    try {
      await open(url);
    } catch {
      const a = document.createElement("a");
      a.href = url;
      a.download = `report_${id}.html`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    try {
      await api.reports.delete(id);
      setReports(prev => prev.filter(r => r.id !== id));
      if (selectedReport?.id === id) setSelectedReport(null);
    } catch (error) {
      console.error("Failed to delete report:", error);
    } finally {
      setDeletingId(null);
      setConfirmDeleteId(null);
    }
  }

  return (
    <div className="flex h-full flex-col gap-6 p-6 overflow-y-auto">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-[var(--color-text-primary)]">Reports</h2>
          <p className="text-sm text-[var(--color-text-secondary)] mt-1">
            AI-powered system health and incident summaries.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => handleGenerate("daily")}
            disabled={generating}
            className="flex items-center gap-2 px-4 py-2 rounded-md font-medium text-sm transition-colors shadow-sm bg-[var(--color-surface-700)] text-[var(--color-text-primary)] hover:bg-[var(--color-surface-600)] border border-[var(--color-surface-600)] disabled:opacity-50"
          >
            {generating ? <Clock className="animate-spin w-4 h-4" /> : <Play className="w-4 h-4" />}
            Generate Daily
          </button>
          <button
            onClick={() => handleGenerate("weekly")}
            disabled={generating}
            className="flex items-center gap-2 px-4 py-2 rounded-md font-medium text-sm transition-colors shadow-sm bg-[var(--color-primary-main)] text-white hover:bg-[var(--color-primary-hover)] disabled:opacity-50"
          >
            {generating ? <Clock className="animate-spin w-4 h-4" /> : <Play className="w-4 h-4" />}
            Generate Weekly
          </button>
        </div>
      </div>

      {/* Generating banner */}
      {generating && (
        <div className="flex items-center gap-3 p-4 rounded-xl border border-[var(--color-primary-main)]/30 bg-[var(--color-primary-main)]/10 text-sm text-[var(--color-primary-main)]">
          <Clock className="w-4 h-4 animate-spin flex-shrink-0" />
          <span>Generating report — the AI is analysing your PC data, this may take 30–60 seconds…</span>
        </div>
      )}

      {/* Reports List */}
      <div className="grid grid-cols-1 gap-4">
        {loading ? (
          <div className="text-sm text-[var(--color-text-secondary)] p-8 text-center border border-dashed border-[var(--color-surface-600)] rounded-lg">
            Loading reports…
          </div>
        ) : reports.length === 0 ? (
          <div className="text-sm text-[var(--color-text-secondary)] p-12 text-center border border-dashed border-[var(--color-surface-600)] rounded-lg flex flex-col items-center gap-3">
            <FileText className="w-8 h-8 opacity-40" />
            <p>No reports generated yet. Click <strong>Generate Daily</strong> to create your first report.</p>
          </div>
        ) : (
          reports.map(report => (
            <div
              key={report.id}
              className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-xl border border-[var(--color-surface-600)] bg-[var(--color-surface-800)] shadow-sm hover:border-[var(--color-surface-500)] hover:bg-[var(--color-surface-700)] transition-all group"
            >
              {/* Left: info */}
              <div className="flex items-start gap-4 min-w-0">
                <div className="p-3 bg-[var(--color-surface-700)] group-hover:bg-[var(--color-surface-600)] transition-colors rounded-lg text-[var(--color-primary-main)] shrink-0">
                  <FileText className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-semibold text-[var(--color-text-primary)] flex items-center gap-2 flex-wrap">
                    {report.title}
                    <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-[var(--color-primary-main)]/20 text-[var(--color-primary-main)] border border-[var(--color-primary-main)]/30">
                      {report.report_type}
                    </span>
                  </h3>
                  <div className="text-xs text-[var(--color-text-secondary)] mt-1 flex flex-wrap gap-x-4 gap-y-1">
                    <span>Generated: {new Date(report.generated_at).toLocaleString()}</span>
                    <span>Period: {new Date(report.period_start).toLocaleDateString()} — {new Date(report.period_end).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>

              {/* Right: actions */}
              <div className="flex items-center gap-2 shrink-0 border-t border-[var(--color-surface-700)] md:border-none pt-4 md:pt-0">
                {/* View */}
                <button
                  onClick={(e) => { e.stopPropagation(); setSelectedReport(report); }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-[var(--color-primary-main)] text-white hover:bg-[var(--color-primary-hover)] transition-colors"
                >
                  <Eye className="w-4 h-4" />
                  View
                </button>

                {/* Export HTML */}
                <button
                  onClick={(e) => { e.stopPropagation(); handleExportHtml(report.id); }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-[var(--color-surface-700)] text-[var(--color-text-primary)] hover:bg-[var(--color-surface-600)] transition-colors border border-[var(--color-surface-600)]"
                >
                  <FileDown className="w-4 h-4" />
                  HTML
                </button>

                {/* Delete */}
                {confirmDeleteId === report.id ? (
                  <div className="flex items-center gap-1.5 border border-[var(--color-status-error)]/40 rounded-lg overflow-hidden">
                    <span className="text-xs text-[var(--color-status-error)] px-2 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" /> Delete?
                    </span>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDelete(report.id); }}
                      disabled={deletingId === report.id}
                      className="px-2.5 py-1.5 text-xs font-bold text-white bg-[var(--color-status-error)] hover:opacity-90 transition-opacity disabled:opacity-50"
                    >
                      {deletingId === report.id ? "…" : "Yes"}
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(null); }}
                      className="px-2.5 py-1.5 text-xs font-medium text-[var(--color-text-secondary)] bg-[var(--color-surface-700)] hover:bg-[var(--color-surface-600)]"
                    >
                      No
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(report.id); }}
                    className="p-1.5 rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-status-error)] hover:bg-[var(--color-status-error)]/10 transition-colors border border-transparent hover:border-[var(--color-status-error)]/30"
                    title="Delete report"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Report Viewer Modal */}
      {selectedReport && (
        <ReportViewerModal
          reportId={selectedReport.id}
          reportTitle={selectedReport.title}
          onClose={() => setSelectedReport(null)}
        />
      )}
    </div>
  );
}

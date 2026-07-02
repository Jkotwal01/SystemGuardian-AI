"use client";

import { useEffect, useState } from "react";
import { FileText, Download, Play, CheckCircle2, Clock } from "lucide-react";
import { open } from "@tauri-apps/plugin-shell";
import { api } from "@/lib/api-client";
import { ReportRead } from "@/lib/types";

export default function ReportsPage() {
  const [reports, setReports] = useState<ReportRead[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    fetchReports();
  }, []);

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

  async function handleDownload(id: string, format: string) {
    const url = api.reports.getExportUrl(id, format);
    try {
      await open(url);
    } catch (e) {
      console.error("Failed to open report url:", e);
      // Fallback for non-Tauri environments (e.g. standard browser)
      const a = document.createElement('a');
      a.href = url;
      a.download = `report_${id}.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  }

  return (
    <div className="flex h-full flex-col gap-6 p-6 overflow-y-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-[var(--color-text-primary)]">Reports</h2>
          <p className="text-sm text-[var(--color-text-secondary)] mt-1">
            Historical system health and incident summaries.
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
            className="flex items-center gap-2 px-4 py-2 rounded-md font-medium text-sm transition-colors shadow-sm bg-[var(--color-primary-main)] text-[var(--color-text-primary)] hover:bg-[var(--color-primary-hover)] disabled:opacity-50"
          >
            {generating ? <Clock className="animate-spin w-4 h-4" /> : <Play className="w-4 h-4" />}
            Generate Weekly
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {loading ? (
          <div className="text-sm text-[var(--color-text-secondary)] p-4 text-center border border-dashed border-[var(--color-surface-600)] rounded-lg">
            Loading reports...
          </div>
        ) : reports.length === 0 ? (
          <div className="text-sm text-[var(--color-text-secondary)] p-12 text-center border border-dashed border-[var(--color-surface-600)] rounded-lg flex flex-col items-center gap-3">
            <FileText className="w-8 h-8 opacity-50" />
            <p>No reports generated yet.</p>
          </div>
        ) : (
          reports.map(report => (
            <div key={report.id} className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-lg border border-[var(--color-surface-600)] bg-[var(--color-surface-800)] shadow-sm hover:border-[var(--color-surface-500)] transition-colors">
              <div className="flex items-start gap-4">
                <div className="p-3 bg-[var(--color-surface-700)] rounded-lg text-[var(--color-primary-main)] shrink-0">
                  <FileText className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-semibold text-[var(--color-text-primary)] flex items-center gap-2">
                    {report.title}
                    <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-[var(--color-surface-700)] text-[var(--color-text-secondary)]">
                      {report.report_type}
                    </span>
                  </h3>
                  <div className="text-sm text-[var(--color-text-secondary)] mt-1 flex flex-wrap gap-x-4 gap-y-1">
                    <span>Generated: {new Date(report.generated_at).toLocaleString()}</span>
                    <span>Period: {new Date(report.period_start).toLocaleDateString()} - {new Date(report.period_end).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-2 shrink-0 border-t border-[var(--color-surface-700)] md:border-none pt-4 md:pt-0">
                <span className="text-xs font-medium text-[var(--color-text-muted)] mr-2 uppercase tracking-wider">Export As:</span>
                {['json', 'html', 'csv'].map(format => (
                  <button
                    key={format}
                    onClick={() => handleDownload(report.id, format)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-[var(--color-surface-700)] text-[var(--color-text-primary)] hover:bg-[var(--color-surface-600)] transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                    {format.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

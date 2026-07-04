"use client";

import { useState } from "react";
import { X, FileDown, Loader2 } from "lucide-react";
import { api } from "@/lib/api-client";
import { open } from "@tauri-apps/plugin-shell";

interface ReportViewerModalProps {
  reportId: string;
  reportTitle?: string;
  onClose: () => void;
}

export function ReportViewerModal({ reportId, reportTitle, onClose }: ReportViewerModalProps) {
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const [exporting, setExporting] = useState(false);

  const viewUrl = api.reports.getViewUrl(reportId);
  const exportUrl = api.reports.getExportUrl(reportId, "html");

  async function handleExportHtml() {
    setExporting(true);
    try {
      await open(exportUrl);
    } catch {
      // Fallback for non-Tauri
      const a = document.createElement("a");
      a.href = exportUrl;
      a.download = `report_${reportId}.html`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-center justify-center p-2 md:p-6">
      <div
        className="bg-[var(--color-surface-900)] w-full max-w-6xl h-full max-h-full rounded-xl border border-[var(--color-surface-600)] shadow-2xl flex flex-col overflow-hidden"
        style={{ animation: "slideUp 0.25s ease" }}
      >
        {/* ── Modal Header ─────────────────────────────── */}
        <div className="flex items-center justify-between px-4 md:px-5 py-3 border-b border-[var(--color-surface-700)] bg-[var(--color-surface-800)] flex-shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="text-base font-bold text-[var(--color-text-primary)] truncate">
              {reportTitle ?? "System Report"}
            </span>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Export HTML */}
            <button
              onClick={handleExportHtml}
              disabled={exporting}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-white bg-[var(--color-primary-main)] hover:bg-[var(--color-primary-hover)] transition-colors disabled:opacity-60"
            >
              {exporting
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : <FileDown className="w-4 h-4" />}
              Export HTML
            </button>

            {/* Close */}
            <button
              onClick={onClose}
              className="p-2 rounded-lg bg-[var(--color-surface-700)] hover:bg-[var(--color-surface-600)] text-[var(--color-text-secondary)] transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* ── iframe — renders identical HTML to the export ────── */}
        <div className="flex-1 relative overflow-hidden bg-[#0f1117]">
          {!iframeLoaded && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 z-10">
              <Loader2 className="w-8 h-8 animate-spin text-[var(--color-primary-main)]" />
              <p className="text-sm text-[var(--color-text-secondary)]">Rendering report…</p>
            </div>
          )}
          <iframe
            src={viewUrl}
            title="System Report"
            className="w-full h-full border-none"
            style={{ opacity: iframeLoaded ? 1 : 0, transition: "opacity 0.3s ease" }}
            onLoad={() => setIframeLoaded(true)}
          />
        </div>
      </div>

      <style>{`
        @keyframes slideUp {
          from { transform: translateY(20px); opacity: 0; }
          to   { transform: translateY(0);    opacity: 1; }
        }
      `}</style>
    </div>
  );
}

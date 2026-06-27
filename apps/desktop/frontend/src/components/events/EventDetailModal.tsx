"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X, Shield, Cpu, HardDrive, Network, Zap, Database, AlertTriangle, Activity, Info } from "lucide-react";
import { EventRead, Severity, EventCategory } from "@/lib/types";
import { api } from "@/lib/api-client";
import { AIInsightCard } from "./AIInsightCard";

// ── Helpers ────────────────────────────────────────────────────────────────────

const SEVERITY_CLASS: Record<Severity, string> = {
  critical: "severity-critical",
  high: "severity-high",
  medium: "severity-medium",
  low: "severity-low",
  info: "severity-info",
};

const CATEGORY_ICONS: Record<EventCategory, React.ComponentType<{ className?: string }>> = {
  security:      Shield,
  performance:   Activity,
  hardware:      Cpu,
  network:       Network,
  application:   Zap,
  storage:       HardDrive,
  driver:        Database,
  power:         Zap,
  stability:     AlertTriangle,
  informational: Activity,
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "medium",
  });
}

// ── Main Modal ─────────────────────────────────────────────────────────────────

interface Props {
  eventId: string | null;
  onClose: () => void;
}

export function EventDetailModal({ eventId, onClose }: Props) {
  const [event, setEvent] = useState<EventRead | null>(null);
  const [loading, setLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  // ── Fetch event (with AI polling) ─────────────────────────────────────────
  useEffect(() => {
    mountedRef.current = true;
    if (!eventId) return;

    let attempts = 0;
    const MAX_POLLS = 20; // 20 × 3s = 60s max wait for AI

    const fetchEvent = async (isFirstLoad = false) => {
      if (!mountedRef.current) return;

      if (isFirstLoad) setLoading(true);

      try {
        const data = await api.events.getById(eventId);
        if (!mountedRef.current) return;

        setEvent(data);
        setLoading(false);

        // Poll until ai_insight arrives (or max attempts reached)
        const isRecent = new Date(data.occurred_at).getTime() > Date.now() - 5 * 60 * 1000;
        const needsAI =
          (data.severity === "high" || data.severity === "critical") &&
          !data.ai_insight &&
          isRecent &&
          attempts < MAX_POLLS;

        if (needsAI) {
          attempts++;
          setAiLoading(true);
          pollRef.current = setTimeout(() => fetchEvent(false), 3000);
        } else {
          setAiLoading(false);
        }
      } catch {
        setLoading(false);
        setAiLoading(false);
      }
    };

    fetchEvent(true);

    return () => {
      mountedRef.current = false;
      if (pollRef.current) clearTimeout(pollRef.current);
    };
  }, [eventId]);

  // ── Close on Escape ───────────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  if (!eventId || !mounted) return null;

  const sev = event?.severity ?? "info";
  const sevClass = SEVERITY_CLASS[sev] ?? SEVERITY_CLASS.info;
  const cat = event?.category ?? "informational";
  const CategoryIcon = CATEGORY_ICONS[cat] ?? Activity;
  const showAICard = event && (event.severity === "high" || event.severity === "critical");

  return createPortal(
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[9998] bg-black/80 backdrop-blur-sm transition-opacity duration-300"
        onClick={onClose}
        aria-label="Close modal"
      />

      {/* Centered Modal Container */}
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 md:p-16 pointer-events-none">
        {/* Panel */}
        <div
          className="w-full max-w-6xl flex flex-col overflow-hidden pointer-events-auto rounded-2xl md:rounded-3xl animate-fade-in"
          style={{
            background: "var(--color-surface-900)",
            border: "1px solid var(--color-surface-700)",
            boxShadow: "0 40px 100px -20px rgba(0, 0, 0, 0.9), inset 0 1px 0 rgba(255, 255, 255, 0.05)",
            maxHeight: "calc(100vh - 4rem)",
            minHeight: "70vh",
          }}
        >
          {/* Header */}
          <div
            className="flex items-center justify-between px-6 py-6 md:px-12 md:py-8 flex-shrink-0 bg-[var(--color-surface-800)]/50"
            style={{ borderBottom: "1px solid var(--color-surface-700)" }}
          >
            <div className="flex items-center gap-4 md:gap-6">
              <div className={`p-3 md:p-4 rounded-xl md:rounded-2xl border flex items-center justify-center shadow-[inset_0_1px_0_rgba(255,255,255,0.1)] ${sevClass}`}>
                <CategoryIcon className="w-6 h-6 md:w-8 md:h-8" />
              </div>
              <div>
                <h2 className="text-lg md:text-xl font-medium tracking-tight text-[var(--color-text-primary)]">
                  {loading ? "Loading Event Details..." : event?.title ?? "Event Details"}
                </h2>
                <p className="text-[10px] md:text-sm font-medium tracking-widest uppercase text-[var(--color-text-muted)] mt-1 md:mt-2">
                  {event?.category && `${event.category} • `}{event?.source}
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-2 md:p-3 rounded-xl md:rounded-2xl transition-all duration-200 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-700)] cursor-pointer"
              aria-label="Close"
            >
              <X className="w-6 h-6 md:w-8 md:h-8" />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-6 md:p-12">
            {loading && (
              <div className="space-y-8 animate-pulse p-4">
                <div className="h-8 rounded bg-[var(--color-surface-700)] w-3/4" />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="h-32 rounded bg-[var(--color-surface-700)]" />
                  <div className="h-32 rounded bg-[var(--color-surface-700)]" />
                </div>
                <div className="h-64 rounded bg-[var(--color-surface-700)]" />
              </div>
            )}

            {!loading && event && (
              <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_1fr] gap-8 lg:gap-16 h-full">
                {/* Left Column: Metadata */}
                <div className="space-y-8 lg:space-y-12">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-8">
                    {[
                      { label: "Severity", value: (
                        <span className={`inline-flex items-center px-3 py-1 sm:px-4 sm:py-1.5 rounded-full text-xs sm:text-sm font-semibold uppercase shadow-[inset_0_1px_0_rgba(255,255,255,0.1)] ${sevClass}`}>
                          {event.severity}
                        </span>
                      )},
                      { label: "Category", value: <span className="capitalize">{event.category}</span> },
                      { label: "Source", value: event.source },
                      { label: "Event ID", value: <span className="font-mono text-[13px] sm:text-[15px] break-all">{(event as any).source_id || "—"}</span> },
                      { label: "Occurred", value: formatDate(event.occurred_at), span: true },
                    ].map((row, i) => (
                      <div
                        key={i}
                        className={`rounded-2xl sm:rounded-3xl p-5 sm:p-8 transition-all hover:bg-[var(--color-surface-800)]/80 border border-[var(--color-surface-700)] bg-[var(--color-surface-950)]/40 shadow-sm ${(row as any).span ? "col-span-1 sm:col-span-2" : ""}`}
                      >
                        <p className="text-[10px] sm:text-xs font-semibold uppercase tracking-widest text-[var(--color-text-muted)] mb-2 sm:mb-4">
                          {row.label}
                        </p>
                        <div className="text-base sm:text-lg font-medium text-[var(--color-text-primary)] leading-snug break-words">
                          {row.value}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Raw normalized data */}
                  <div className="border-t border-[var(--color-surface-700)] pt-8 sm:pt-10">
                    <details className="group" open>
                      <summary
                        className="cursor-pointer text-xs sm:text-[13px] font-semibold uppercase tracking-widest text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors select-none flex items-center gap-3"
                      >
                        <Database className="w-4 h-4 sm:w-5 sm:h-5" />
                        <span>View Raw Event Payload</span>
                      </summary>
                      <div className="mt-4 sm:mt-6 rounded-xl sm:rounded-2xl border border-[var(--color-surface-700)] overflow-hidden shadow-sm">
                        <pre
                          className="text-[11px] sm:text-sm leading-relaxed p-4 sm:p-6 overflow-x-auto font-mono"
                          style={{
                            background: "var(--color-surface-950)",
                            color: "var(--color-text-secondary)",
                            maxHeight: "350px",
                          }}
                        >
                          {JSON.stringify(event, null, 2)}
                        </pre>
                      </div>
                    </details>
                  </div>
                </div>

                {/* Right Column: AI Insight */}
                <div className="space-y-8 h-full min-h-[300px] lg:min-h-[400px]">
                  <div className="h-full">
                    {showAICard && (
                      <AIInsightCard
                        insight={event.ai_insight}
                        loading={aiLoading && !event.ai_insight}
                      />
                    )}
                    {!showAICard && (
                      <div className="h-full flex flex-col items-center justify-center p-6 sm:p-12 text-center rounded-2xl sm:rounded-3xl border border-dashed border-[var(--color-surface-700)] bg-[var(--color-surface-950)]/20 min-h-[250px] lg:min-h-[400px]">
                        <Info className="w-10 h-10 sm:w-12 sm:h-12 text-[var(--color-text-muted)] opacity-40 mb-4 sm:mb-6" />
                        <p className="text-lg sm:text-xl font-medium text-[var(--color-text-secondary)]">AI Insight Restricted</p>
                        <p className="text-sm sm:text-base text-[var(--color-text-muted)] mt-3 sm:mt-4 max-w-md leading-relaxed mx-auto">
                          AI analysis is reserved for High and Critical severity events to focus resources on critical infrastructure threats.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>,
    document.body
  );
}

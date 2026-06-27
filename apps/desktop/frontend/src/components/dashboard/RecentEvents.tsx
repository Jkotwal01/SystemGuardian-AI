"use client";

import { useState } from "react";
import { useEventStore } from "@/stores/event-store";
import { EventDetailModal } from "@/components/events/EventDetailModal";
import { formatDistanceToNow } from "date-fns";
import { Zap } from "lucide-react";

export function RecentEvents() {
  const { recentEvents, loading } = useEventStore();
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);

  if (loading && recentEvents.length === 0) {
    return <div className="glass-card p-6 h-64 flex items-center justify-center animate-pulse text-sm text-[var(--color-text-muted)]">Loading events...</div>;
  }

  if (recentEvents.length === 0) {
    return <div className="glass-card p-6 h-64 flex items-center justify-center text-sm text-[var(--color-text-muted)]">No recent events.</div>;
  }

  return (
    <>
      <div className="glass-card overflow-hidden flex flex-col h-full">
        <div className="px-5 py-3 border-b border-[var(--color-surface-700)] bg-[var(--color-surface-800)]/50 flex items-center justify-between">
          <h3 className="font-medium text-[11px] tracking-widest uppercase text-[var(--color-text-secondary)]">Activity Stream</h3>
          <span className="text-[11px] text-[var(--color-text-muted)]">Click row for AI analysis</span>
        </div>
        <div className="flex-1 overflow-y-auto p-1.5">
          <div className="flex flex-col gap-0.5">
            {recentEvents.map((event, i) => {
              const isHighSeverity = event.severity === "high" || event.severity === "critical";
              const hasAI = !!(event as any).ai_insight;

              return (
                <button
                  key={event.id}
                  onClick={() => setSelectedEventId(event.id)}
                  className="w-full text-left flex items-start gap-3.5 px-3.5 py-3 rounded-lg hover:bg-[var(--color-surface-700)] transition-colors animate-slide-left cursor-pointer group border border-transparent hover:border-[var(--color-surface-600)]"
                  style={{ animationDelay: `${i * 30}ms` }}
                >
                  {/* Severity indicator */}
                  <div className="mt-1.5 flex-shrink-0 flex items-center justify-center w-2 h-2 rounded-full bg-severity-[var(--color-surface-500)] shadow-[0_0_8px_var(--color-surface-500)]">
                     <div className={`w-full h-full rounded-full bg-severity-${event.severity}`} />
                  </div>

                  <div className="flex flex-col min-w-0 flex-1">
                    <p className="text-[13px] font-medium text-[var(--color-text-primary)] truncate">
                      {event.title}
                    </p>
                    <div className="flex items-center gap-2 mt-1 text-[11px] text-[var(--color-text-muted)]">
                      <span className="capitalize">{event.category}</span>
                      <span className="w-0.5 h-0.5 rounded-full bg-[var(--color-surface-500)]" />
                      <span>{event.source}</span>
                      <span className="w-0.5 h-0.5 rounded-full bg-[var(--color-surface-500)]" />
                      <span>
                        {formatDistanceToNow(new Date(event.occurred_at), { addSuffix: true })}
                      </span>
                    </div>
                  </div>

                  {/* AI indicator for high-severity events */}
                  {isHighSeverity && (
                    <div className="flex-shrink-0 mt-0.5">
                      <Zap
                        className={`w-3.5 h-3.5 transition-colors ${
                          hasAI ? "text-indigo-400" : "text-indigo-400/30 group-hover:text-indigo-400/60"
                        }`}
                        aria-label={hasAI ? "AI analysis available" : "AI analysis pending"}
                      />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Event Detail Modal */}
      <EventDetailModal
        eventId={selectedEventId}
        onClose={() => setSelectedEventId(null)}
      />
    </>
  );
}


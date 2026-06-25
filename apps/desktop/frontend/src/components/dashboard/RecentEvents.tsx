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
    return <div className="glass-card p-6 h-64 flex items-center justify-center animate-pulse text-sm opacity-50">Loading events...</div>;
  }

  if (recentEvents.length === 0) {
    return <div className="glass-card p-6 h-64 flex items-center justify-center text-sm opacity-50">No recent events.</div>;
  }

  return (
    <>
      <div className="glass-card overflow-hidden flex flex-col">
        <div className="p-4 border-b border-[var(--color-surface-700)] bg-[var(--color-surface-800)]/50 flex items-center justify-between">
          <h3 className="font-semibold text-sm tracking-wide uppercase opacity-80">Recent Activity Stream</h3>
          <span className="text-xs opacity-40">Click row for AI analysis</span>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          <div className="flex flex-col gap-1">
            {recentEvents.map((event, i) => {
              const isHighSeverity = event.severity === "high" || event.severity === "critical";
              const hasAI = !!(event as any).ai_insight;

              return (
                <button
                  key={event.id}
                  onClick={() => setSelectedEventId(event.id)}
                  className="w-full text-left flex items-start gap-3 p-3 rounded-lg hover:bg-[var(--color-surface-700)] transition-colors animate-slide-left cursor-pointer group"
                  style={{ animationDelay: `${i * 50}ms` }}
                >
                  {/* Severity dot */}
                  <div className={`mt-1.5 w-2 h-2 rounded-full flex-shrink-0 bg-severity-${event.severity}`} />

                  <div className="flex flex-col min-w-0 flex-1">
                    <p className="text-sm font-medium text-[var(--color-text-primary)] truncate">
                      {event.title}
                    </p>
                    <div className="flex items-center gap-2 mt-1 opacity-60 text-xs">
                      <span className="capitalize">{event.category}</span>
                      <span>•</span>
                      <span>{event.source}</span>
                      <span>•</span>
                      <span>
                        {formatDistanceToNow(new Date(event.occurred_at), { addSuffix: true })}
                      </span>
                    </div>
                  </div>

                  {/* AI indicator for high-severity events */}
                  {isHighSeverity && (
                    <div className="flex-shrink-0 mt-1">
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


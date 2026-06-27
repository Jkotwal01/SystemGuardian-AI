"use client";

import { useEffect } from "react";
import { HealthScoreRing } from "@/components/dashboard/HealthScoreRing";
import { MetricsStrip } from "@/components/dashboard/MetricsStrip";
import { RecentEvents } from "@/components/dashboard/RecentEvents";
import { useWebSockets } from "@/hooks/use-websocket";
import { useHealthStore } from "@/stores/health-store";
import { useEventStore } from "@/stores/event-store";

export default function OverviewPage() {
  const { latestScore, fetchInitial: fetchHealth } = useHealthStore();
  const { fetchInitial: fetchEvents } = useEventStore();
  
  // Connect WebSockets
  useWebSockets();

  // Initial data fetch
  useEffect(() => {
    fetchHealth();
    fetchEvents();
  }, [fetchHealth, fetchEvents]);

  return (
    <div className="p-4 md:p-6 flex flex-col gap-4 md:gap-6 h-full max-h-full overflow-hidden">
      <div className="grid grid-cols-1 xl:grid-cols-[300px_1fr] gap-4 md:gap-6">
        {/* Main Health Score */}
        <div className="glass-card p-6 flex flex-col items-center justify-center animate-fade-in gap-4">
          <h2 className="text-sm font-semibold tracking-wide uppercase opacity-70">
            System Health
          </h2>
          <HealthScoreRing 
            score={latestScore?.overall_score ?? 0} 
            size={180} 
          />
        </div>

        {/* Top Strip */}
        <div className="flex flex-col gap-6">
          <MetricsStrip />
          
          <div className="flex-1 glass-card p-6 flex items-center justify-center opacity-50 animate-fade-in stagger-2">
            <p className="text-sm text-center">
              Active AI Predictions & Anomalies<br />
              <span className="text-xs opacity-70">(Coming in Phase 6)</span>
            </p>
          </div>
        </div>
      </div>

      {/* Bottom Half */}
      <div className="flex-1 min-h-0">
        <RecentEvents />
      </div>
    </div>
  );
}

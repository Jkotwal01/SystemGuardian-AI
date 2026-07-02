"use client";

import { useState } from "react";
import { useHealthStore } from "@/stores/health-store";
import { useEventStore } from "@/stores/event-store";
import { Activity, Cpu, HardDrive, MemoryStick, Zap, Gauge } from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { EventDetailModal } from "@/components/events/EventDetailModal";

function MetricBar({ label, icon: Icon, value, colorClass }: { label: string, icon: any, value: number, colorClass: string }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex justify-between items-end">
        <span className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-widest text-[var(--color-text-muted)]">
          <Icon className="w-3.5 h-3.5 opacity-60" /> {label}
        </span>
        <span className="text-[13px] font-medium font-mono text-[var(--color-text-primary)]">{value}%</span>
      </div>
      <div className="h-1.5 w-full bg-[var(--color-surface-800)] rounded-full overflow-hidden shadow-[inset_0_1px_2px_rgba(0,0,0,0.5)]">
        <div 
          className={`h-full rounded-full ${colorClass} transition-all duration-1000 ease-out`}
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
}

export default function PerformancePage() {
  const { latestScore } = useHealthStore();
  const { recentEvents } = useEventStore();
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);

  const cpuHealth = latestScore?.component_scores?.cpu ?? 100;
  const memHealth = latestScore?.component_scores?.memory ?? 100;
  const diskHealth = latestScore?.component_scores?.disk ?? 100;

  const performanceEvents = recentEvents.filter((e) => e.category === "performance");

  return (
    <div className="flex flex-col min-h-full gap-4 md:gap-6 p-4 md:p-6 animate-fade-in overflow-y-auto bg-[var(--color-surface-950)]">
      {/* Top Section: Metrics Overview */}
      <div className="flex flex-col gap-3">
        <h2 className="text-[11px] font-medium tracking-widest uppercase text-[var(--color-text-secondary)] pl-1">Metrics Overview</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
          <div className="glass-card p-4 md:p-6 rounded-lg border border-[var(--color-surface-700)] bg-[var(--color-surface-900)]">
            <MetricBar 
              label="CPU Health" 
              icon={Cpu} 
              value={cpuHealth} 
              colorClass={cpuHealth < 70 ? "bg-[var(--color-severity-high)]" : "bg-[var(--color-brand-400)]"} 
            />
          </div>
          <div className="glass-card p-6 rounded-lg border border-[var(--color-surface-700)] bg-[var(--color-surface-900)]">
            <MetricBar 
              label="Memory Health" 
              icon={MemoryStick} 
              value={memHealth} 
              colorClass={memHealth < 70 ? "bg-[var(--color-severity-high)]" : "bg-[hsl(267_100%_60%)]"} 
            />
          </div>
          <div className="glass-card p-6 rounded-lg border border-[var(--color-surface-700)] bg-[var(--color-surface-900)]">
            <MetricBar 
              label="Disk Health" 
              icon={HardDrive} 
              value={diskHealth} 
              colorClass={diskHealth < 70 ? "bg-[var(--color-severity-high)]" : "bg-[hsl(175_100%_40%)]"} 
            />
          </div>
        </div>
      </div>

      {/* Main Content: Performance Events */}
      <div className="flex-1 flex flex-col min-h-0 gap-3">
        <div className="flex items-center justify-between pl-1 pr-2">
           <h2 className="text-[11px] font-medium tracking-widest uppercase text-[var(--color-text-secondary)] flex items-center gap-2">
             <Gauge className="w-3.5 h-3.5 text-[var(--color-brand-400)] opacity-80" /> Performance Event Stream
           </h2>
           <span className="text-[10px] px-2 py-0.5 rounded border border-[var(--color-surface-700)] bg-[var(--color-surface-800)] text-[var(--color-text-muted)] font-medium tracking-widest uppercase shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
             Live Workload Engine
           </span>
        </div>

        <div className="flex-1 glass-card rounded-lg border border-[var(--color-surface-700)] overflow-hidden flex flex-col bg-[var(--color-surface-900)]">
          <div className="flex-1 p-4 flex flex-col gap-2">
            {performanceEvents.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-3 text-[var(--color-text-muted)]">
                <div className="w-10 h-10 rounded-full bg-[var(--color-surface-800)] flex items-center justify-center border border-[var(--color-surface-700)] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] mb-1">
                  <Activity className="w-4 h-4 opacity-50" />
                </div>
                <p className="text-[13px] font-medium">No performance anomalies detected.</p>
                <p className="text-[11px] opacity-70">System is running optimally.</p>
              </div>
            ) : (
              performanceEvents.map((event, i) => {
                 const hasAI = !!event.ai_insight;
                 const isHigh = event.severity === "high" || event.severity === "critical";
                 
                 return (
                   <button
                     key={event.id}
                     onClick={() => setSelectedEventId(event.id)}
                     className="w-full text-left p-4 rounded-md border border-[var(--color-surface-700)] bg-[var(--color-surface-800)]/40 hover:bg-[var(--color-surface-800)] hover:border-[var(--color-surface-500)] transition-all duration-200 flex flex-col gap-2 group shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]"
                     style={{ animationDelay: `${i * 30}ms` }}
                   >
                     <div className="flex justify-between items-center w-full">
                       <div className="flex items-center gap-2 text-[11px] font-medium text-[var(--color-text-muted)]">
                         <div className={`w-2 h-2 rounded-full ring-2 ring-[var(--color-surface-900)] bg-severity-${event.severity}`} />
                         <span className="text-[var(--color-brand-400)] ml-1">
                           {format(new Date(event.occurred_at), "HH:mm:ss.SSS")}
                         </span>
                       </div>
                       <div className="flex items-center gap-2">
                         <span className="text-[10px] font-medium uppercase tracking-widest text-[var(--color-text-muted)]">{event.source}</span>
                         {isHigh && (
                           <Zap className={`w-3.5 h-3.5 ${hasAI ? "text-indigo-400" : "text-indigo-400/30"} transition-colors`} />
                         )}
                       </div>
                     </div>
                     <p className="font-medium text-[13px] text-[var(--color-text-primary)] pl-4 leading-relaxed">
                       {event.title}
                     </p>
                   </button>
                 );
              })
            )}
          </div>
        </div>
      </div>
      
      <EventDetailModal
        eventId={selectedEventId}
        onClose={() => setSelectedEventId(null)}
      />
    </div>
  );
}

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
        <span className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-[var(--color-text-primary)]">
          <Icon className="w-4 h-4 opacity-50" /> {label}
        </span>
        <span className="text-xl font-bold font-mono">{value}%</span>
      </div>
      <div className="h-2 w-full bg-[var(--color-surface-800)] rounded-full overflow-hidden">
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

  // Fallback to 100 if missing (meaning healthy/unused)
  // Actually, component scores are "health" scores, meaning 100 is good, 0 is bad.
  // Wait, if it's health score, a lower score means higher load.
  // We can display the health score as the metric.
  const cpuHealth = latestScore?.component_scores?.cpu ?? 100;
  const memHealth = latestScore?.component_scores?.memory ?? 100;
  const diskHealth = latestScore?.component_scores?.disk ?? 100;

  const performanceEvents = recentEvents.filter((e) => e.category === "performance");

  return (
    <div className="flex flex-col h-full gap-8 p-8 animate-fade-in overflow-y-auto">
      {/* Top Section: Metrics Overview */}
      <div className="grid grid-cols-3 gap-6">
        <div className="glass-card p-6 rounded-2xl border border-[var(--color-surface-700)] shadow-lg">
          <MetricBar 
            label="CPU Health" 
            icon={Cpu} 
            value={cpuHealth} 
            colorClass={cpuHealth < 70 ? "bg-orange-500" : "bg-blue-500"} 
          />
        </div>
        <div className="glass-card p-6 rounded-2xl border border-[var(--color-surface-700)] shadow-lg">
          <MetricBar 
            label="Memory Health" 
            icon={MemoryStick} 
            value={memHealth} 
            colorClass={memHealth < 70 ? "bg-orange-500" : "bg-purple-500"} 
          />
        </div>
        <div className="glass-card p-6 rounded-2xl border border-[var(--color-surface-700)] shadow-lg">
          <MetricBar 
            label="Disk Health" 
            icon={HardDrive} 
            value={diskHealth} 
            colorClass={diskHealth < 70 ? "bg-orange-500" : "bg-teal-500"} 
          />
        </div>
      </div>

      {/* Main Content: Performance Events */}
      <div className="flex-1 flex flex-col min-h-0 glass-card rounded-2xl border border-[var(--color-surface-700)] shadow-xl shadow-black/20 overflow-hidden">
        <div className="p-6 border-b border-[var(--color-surface-700)] bg-[var(--color-surface-800)]/30 flex items-center justify-between">
           <h2 className="text-xl font-bold flex items-center gap-3 text-white">
             <Gauge className="w-5 h-5 text-blue-400" /> Performance Event Stream
           </h2>
           <span className="text-xs px-3 py-1.5 rounded-full bg-[var(--color-surface-700)] opacity-80 font-semibold tracking-wider uppercase">
             Live Workload Engine
           </span>
        </div>

        <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-3">
          {performanceEvents.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-4 opacity-50">
              <Activity className="w-16 h-16 opacity-30" />
              <p className="text-lg font-medium">No performance anomalies detected.</p>
            </div>
          ) : (
            performanceEvents.map((event, i) => {
               const hasAI = !!event.ai_insight;
               const isHigh = event.severity === "high" || event.severity === "critical";
               
               return (
                 <button
                   key={event.id}
                   onClick={() => setSelectedEventId(event.id)}
                   className="w-full text-left p-5 rounded-2xl border border-[var(--color-surface-700)] bg-[var(--color-surface-800)]/40 hover:bg-[var(--color-surface-700)]/80 transition-all duration-300 flex flex-col gap-3 group"
                   style={{ animationDelay: `${i * 30}ms` }}
                 >
                   <div className="flex justify-between items-center w-full">
                     <div className="flex items-center gap-3">
                       <div className={`w-3 h-3 rounded-full bg-severity-${event.severity} shadow-sm`} />
                       <span className="text-sm font-mono opacity-60">
                         {format(new Date(event.occurred_at), "HH:mm:ss")}
                       </span>
                     </div>
                     <div className="flex items-center gap-3">
                       <span className="text-xs font-bold uppercase tracking-wider opacity-50">{event.source}</span>
                       {isHigh && (
                         <Zap className={`w-4 h-4 ${hasAI ? "text-indigo-400" : "text-indigo-400/30"} transition-colors`} />
                       )}
                     </div>
                   </div>
                   <p className="font-semibold text-base text-[var(--color-text-primary)] pl-6">
                     {event.title}
                   </p>
                 </button>
               );
            })
          )}
        </div>
      </div>
      
      <EventDetailModal
        eventId={selectedEventId}
        onClose={() => setSelectedEventId(null)}
      />
    </div>
  );
}

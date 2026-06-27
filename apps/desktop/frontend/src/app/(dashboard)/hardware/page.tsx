"use client";

import { useState } from "react";
import { useHealthStore } from "@/stores/health-store";
import { useEventStore } from "@/stores/event-store";
import { Server, HardDrive, Database, Usb, Battery, AlertTriangle, Zap, Cpu } from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { EventDetailModal } from "@/components/events/EventDetailModal";

function ComponentStatus({ name, icon: Icon, isHealthy }: { name: string, icon: any, isHealthy: boolean }) {
  return (
    <div className="glass-card p-4 rounded-lg flex items-center justify-between border border-[var(--color-surface-700)] bg-[var(--color-surface-900)]">
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-md border shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] ${isHealthy ? 'bg-[hsl(142_71%_45%_/_0.05)] border-[hsl(142_71%_45%_/_0.15)] text-green-500' : 'bg-[hsl(0_84%_60%_/_0.05)] border-[hsl(0_84%_60%_/_0.15)] text-red-500'}`}>
          <Icon className="w-5 h-5" />
        </div>
        <span className="font-medium text-[13px] text-[var(--color-text-primary)]">{name}</span>
      </div>
      <div className={`px-2 py-0.5 rounded text-[10px] font-medium uppercase tracking-widest shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] ${isHealthy ? 'bg-[hsl(142_71%_45%_/_0.1)] text-green-500' : 'bg-[hsl(0_84%_60%_/_0.15)] text-[var(--color-severity-critical)]'}`}>
        {isHealthy ? "Online" : "Alert"}
      </div>
    </div>
  );
}

export default function HardwarePage() {
  const { latestScore } = useHealthStore();
  const { recentEvents } = useEventStore();
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);

  const diskHealth = latestScore?.component_scores?.disk ?? 100;
  
  const isDiskHealthy = diskHealth > 50;
  const isServerHealthy = true; // Placeholder for now
  const isUsbHealthy = true; // Placeholder for now
  const isBatteryHealthy = true; // Placeholder for now

  // Filter hardware related events
  const hardwareEvents = recentEvents.filter((e) => 
    e.category === "hardware" || 
    e.category === "storage" || 
    e.category === "driver" || 
    e.category === "power"
  );

  return (
    <div className="flex flex-col h-full gap-6 p-6 animate-fade-in overflow-y-auto bg-[var(--color-surface-950)]">
      <div className="flex items-center gap-4 mb-1 pl-1">
        <div className="p-2.5 bg-[var(--color-surface-900)] rounded-lg text-[var(--color-text-primary)] border border-[var(--color-surface-700)] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
          <Server className="w-6 h-6 opacity-80" />
        </div>
        <div>
          <h2 className="text-xl font-medium tracking-tight text-[var(--color-text-primary)]">Hardware Telemetry</h2>
          <p className="text-[13px] text-[var(--color-text-secondary)] mt-0.5">Physical system components and driver health</p>
        </div>
      </div>

      {/* Top Section: Component Status Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <ComponentStatus name="Storage Arrays" icon={HardDrive} isHealthy={isDiskHealthy} />
        <ComponentStatus name="Memory Banks" icon={Database} isHealthy={isServerHealthy} />
        <ComponentStatus name="I/O & USB" icon={Usb} isHealthy={isUsbHealthy} />
        <ComponentStatus name="Power Supply" icon={Battery} isHealthy={isBatteryHealthy} />
      </div>

      {/* Main Content: Hardware Events */}
      <div className="flex-1 flex flex-col min-h-0 gap-3 mt-2">
        <div className="flex items-center justify-between pl-1 pr-2">
           <h3 className="text-[11px] font-medium tracking-widest uppercase text-[var(--color-text-secondary)] flex items-center gap-2">
             <AlertTriangle className="w-3.5 h-3.5 text-orange-400 opacity-80" /> Component Event Log
           </h3>
        </div>

        <div className="flex-1 glass-card rounded-lg border border-[var(--color-surface-700)] overflow-hidden flex flex-col bg-[var(--color-surface-900)]">
          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-2">
            {hardwareEvents.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-3 text-[var(--color-text-muted)]">
                <div className="w-10 h-10 rounded-full bg-[var(--color-surface-800)] flex items-center justify-center border border-[var(--color-surface-700)] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] mb-1">
                  <Server className="w-4 h-4 opacity-50" />
                </div>
                <p className="text-[13px] font-medium">All hardware components are operating normally.</p>
              </div>
            ) : (
              hardwareEvents.map((event, i) => {
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
                         <span className="text-[10px] font-medium uppercase tracking-widest text-[var(--color-brand-500)]">{event.category}</span>
                         <span className="text-[10px] font-medium uppercase tracking-widest text-[var(--color-text-muted)] opacity-50">•</span>
                         <span className="text-[10px] font-medium uppercase tracking-widest text-[var(--color-text-muted)]">{event.source}</span>
                         {isHigh && (
                           <Zap className={`w-3.5 h-3.5 ml-1 ${hasAI ? "text-indigo-400" : "text-indigo-400/30"} transition-colors`} />
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

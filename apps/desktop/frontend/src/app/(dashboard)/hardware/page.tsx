"use client";

import { useState } from "react";
import { useHealthStore } from "@/stores/health-store";
import { useEventStore } from "@/stores/event-store";
import { Server, HardDrive, Database, Usb, Battery, AlertTriangle, Zap } from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { EventDetailModal } from "@/components/events/EventDetailModal";

function ComponentStatus({ name, icon: Icon, isHealthy }: { name: string, icon: any, isHealthy: boolean }) {
  return (
    <div className="glass-card p-5 rounded-2xl flex items-center justify-between border border-[var(--color-surface-700)] shadow-md">
      <div className="flex items-center gap-4">
        <div className={`p-3 rounded-xl ${isHealthy ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
          <Icon className="w-6 h-6" />
        </div>
        <span className="font-medium text-[var(--color-text-primary)] text-lg">{name}</span>
      </div>
      <div className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider ${isHealthy ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
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
    <div className="flex flex-col h-full gap-8 p-8 animate-fade-in overflow-y-auto">
      <div className="flex items-center gap-4 mb-2">
        <div className="p-3 bg-[var(--color-surface-800)] rounded-xl text-[var(--color-text-primary)] border border-[var(--color-surface-700)]">
          <Server className="w-8 h-8 opacity-80" />
        </div>
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-[var(--color-text-primary)]">Hardware Telemetry</h2>
          <p className="text-[var(--color-text-secondary)]">Physical system components and driver health</p>
        </div>
      </div>

      {/* Top Section: Component Status Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
        <ComponentStatus name="Storage Arrays" icon={HardDrive} isHealthy={isDiskHealthy} />
        <ComponentStatus name="Memory Banks" icon={Database} isHealthy={isServerHealthy} />
        <ComponentStatus name="I/O & USB" icon={Usb} isHealthy={isUsbHealthy} />
        <ComponentStatus name="Power Supply" icon={Battery} isHealthy={isBatteryHealthy} />
      </div>

      {/* Main Content: Hardware Events */}
      <div className="flex-1 flex flex-col min-h-0 glass-card rounded-2xl border border-[var(--color-surface-700)] shadow-xl shadow-black/20 overflow-hidden">
        <div className="p-6 border-b border-[var(--color-surface-700)] bg-[var(--color-surface-800)]/30 flex items-center justify-between">
           <h2 className="text-xl font-bold flex items-center gap-3 text-white">
             <AlertTriangle className="w-5 h-5 text-orange-400" /> Component Event Log
           </h2>
        </div>

        <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-3">
          {hardwareEvents.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-4 opacity-50">
              <Server className="w-16 h-16 opacity-30" />
              <p className="text-lg font-medium">All hardware components are operating normally.</p>
            </div>
          ) : (
            hardwareEvents.map((event, i) => {
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
                       <span className="text-xs font-bold uppercase tracking-wider opacity-50 text-[var(--color-primary)]">{event.category}</span>
                       <span className="text-xs font-bold uppercase tracking-wider opacity-30">•</span>
                       <span className="text-xs font-bold uppercase tracking-wider opacity-50">{event.source}</span>
                       {isHigh && (
                         <Zap className={`w-4 h-4 ml-2 ${hasAI ? "text-indigo-400" : "text-indigo-400/30"} transition-colors`} />
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

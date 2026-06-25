"use client";

import { useState } from "react";
import { useHealthStore } from "@/stores/health-store";
import { useEventStore } from "@/stores/event-store";
import { useIncidentStore } from "@/stores/incident-store";
import { Shield, ShieldAlert, ShieldCheck, Activity, Zap, Search } from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { EventDetailModal } from "@/components/events/EventDetailModal";

export default function SecurityPage() {
  const { latestScore } = useHealthStore();
  const { recentEvents } = useEventStore();
  const { incidents } = useIncidentStore();

  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);

  const securityScore = latestScore?.component_scores?.security ?? 100;
  
  // Filter for security events
  const securityEvents = recentEvents.filter((e) => e.category === "security");
  
  // Filter for high/critical security-related incidents
  const highSeverityIncidents = incidents.filter(
    (i) => i.severity === "high" || i.severity === "critical"
  );

  const isSecure = securityScore >= 90;
  const isWarning = securityScore >= 70 && securityScore < 90;

  let ScoreIcon = ShieldCheck;
  let scoreColorClass = "text-green-400";
  let scoreBgClass = "bg-green-500/10 border-green-500/20";
  let scoreGlowClass = "shadow-green-500/20";

  if (!isSecure) {
    if (isWarning) {
      ScoreIcon = Shield;
      scoreColorClass = "text-yellow-400";
      scoreBgClass = "bg-yellow-500/10 border-yellow-500/20";
      scoreGlowClass = "shadow-yellow-500/20";
    } else {
      ScoreIcon = ShieldAlert;
      scoreColorClass = "text-red-400";
      scoreBgClass = "bg-red-500/10 border-red-500/20";
      scoreGlowClass = "shadow-red-500/20";
    }
  }

  return (
    <div className="flex flex-col h-full gap-8 p-8 animate-fade-in overflow-y-auto">
      {/* Top Bar: Security Score */}
      <div className={`glass-card flex items-center justify-between p-8 rounded-2xl border ${scoreBgClass} shadow-lg ${scoreGlowClass}`}>
        <div className="flex items-center gap-6">
          <div className={`p-4 rounded-full bg-[var(--color-surface-800)]/50 ${scoreColorClass}`}>
            <ScoreIcon className="w-10 h-10" />
          </div>
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-[var(--color-text-primary)]">Security Posture</h2>
            <p className="text-[var(--color-text-secondary)] mt-1">Live threat detection and system integrity</p>
          </div>
        </div>
        <div className="text-right">
          <div className={`text-5xl font-black tracking-tighter ${scoreColorClass}`}>
            {securityScore}<span className="text-2xl opacity-50">%</span>
          </div>
          <p className="text-sm uppercase tracking-widest opacity-50 mt-1 font-semibold">Integrity Score</p>
        </div>
      </div>

      <div className="flex gap-8 h-full min-h-0">
        {/* Left Column: Active Threats (Incidents) */}
        <div className="w-1/2 flex flex-col gap-5">
          <div className="flex items-center justify-between">
             <h3 className="text-xl font-bold flex items-center gap-2 text-white">
               <Activity className="w-5 h-5 opacity-60" /> Active Threats
             </h3>
             <span className="text-xs px-2.5 py-1 rounded-full bg-[var(--color-surface-800)] opacity-70">
               {highSeverityIncidents.length} High Severity
             </span>
          </div>
          
          <div className="flex-1 glass-card overflow-hidden flex flex-col border-[var(--color-surface-700)] shadow-lg shadow-black/20">
            {highSeverityIncidents.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-4 opacity-50 p-8 text-center">
                <ShieldCheck className="w-12 h-12 text-green-400 opacity-60" />
                <p className="text-lg font-medium">No active high-severity threats.</p>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
                {highSeverityIncidents.map((incident) => (
                  <div key={incident.id} className="p-5 rounded-2xl bg-red-500/5 border border-red-500/20 shadow-sm">
                    <div className="flex justify-between items-start mb-3">
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-red-500/20 text-red-400">
                        {incident.severity}
                      </span>
                      <span className="text-xs opacity-50">
                        {formatDistanceToNow(new Date(incident.created_at), { addSuffix: true })}
                      </span>
                    </div>
                    <h4 className="font-semibold text-[var(--color-text-primary)] text-lg mb-2">{incident.title}</h4>
                    <p className="text-sm opacity-70 leading-relaxed line-clamp-2">{incident.description}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Live Security Event Stream */}
        <div className="w-1/2 flex flex-col gap-5">
           <div className="flex items-center justify-between">
             <h3 className="text-xl font-bold flex items-center gap-2 text-white">
               <Search className="w-5 h-5 opacity-60" /> Event Stream
             </h3>
             <span className="text-xs px-2.5 py-1 rounded-full bg-[var(--color-surface-800)] opacity-70">
               Last 24h
             </span>
          </div>

          <div className="flex-1 glass-card overflow-hidden flex flex-col border-[var(--color-surface-700)] shadow-lg shadow-black/20">
            {securityEvents.length === 0 ? (
               <div className="flex flex-col items-center justify-center h-full gap-4 opacity-50 p-8 text-center">
                 <p className="text-lg font-medium">No security events detected recently.</p>
               </div>
            ) : (
               <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
                 {securityEvents.map((event, i) => {
                   const hasAI = !!event.ai_insight;
                   const isHigh = event.severity === "high" || event.severity === "critical";
                   
                   return (
                     <button
                       key={event.id}
                       onClick={() => setSelectedEventId(event.id)}
                       className="w-full text-left p-4 rounded-xl border border-[var(--color-surface-700)] bg-[var(--color-surface-800)]/40 hover:bg-[var(--color-surface-700)]/60 hover:border-[var(--color-primary)]/40 transition-all duration-300 flex items-start gap-4 group"
                       style={{ animationDelay: `${i * 30}ms` }}
                     >
                       <div className={`mt-1.5 w-2.5 h-2.5 rounded-full flex-shrink-0 bg-severity-${event.severity}`} />
                       <div className="flex-1 min-w-0">
                         <div className="flex justify-between items-start mb-1">
                           <span className="text-xs font-mono opacity-50">
                             {format(new Date(event.occurred_at), "HH:mm:ss")}
                           </span>
                           {isHigh && (
                             <Zap className={`w-3.5 h-3.5 ${hasAI ? "text-indigo-400" : "text-indigo-400/30"} transition-colors`} />
                           )}
                         </div>
                         <p className="font-medium text-sm text-white truncate mb-1.5">{event.title}</p>
                         <div className="flex items-center gap-2 text-xs uppercase tracking-wider font-semibold opacity-50">
                           <span>{event.source}</span>
                         </div>
                       </div>
                     </button>
                   );
                 })}
               </div>
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

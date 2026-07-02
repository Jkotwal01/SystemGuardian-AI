"use client";

import { useState, useEffect } from "react";
import { useHealthStore } from "@/stores/health-store";
import { useEventStore } from "@/stores/event-store";
import { useIncidentStore } from "@/stores/incident-store";
import { Shield, ShieldAlert, ShieldCheck, Activity, Zap, Search, LogIn, LogOut, AlertTriangle } from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { EventDetailModal } from "@/components/events/EventDetailModal";
import { api } from "@/lib/api-client";
import { SecurityStatsResponse } from "@/lib/types";

function StatPill({
  label,
  value,
  icon: Icon,
  colorClass,
  bgClass,
}: {
  label: string;
  value: number | string;
  icon: React.ElementType;
  colorClass: string;
  bgClass: string;
}) {
  return (
    <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${bgClass}`}>
      <Icon className={`w-3.5 h-3.5 ${colorClass} flex-shrink-0`} />
      <div className="min-w-0">
        <p className={`text-[14px] font-bold font-mono ${colorClass}`}>{value}</p>
        <p className="text-[10px] uppercase tracking-widest text-[var(--color-text-muted)] whitespace-nowrap">{label}</p>
      </div>
    </div>
  );
}

export default function SecurityPage() {
  const { latestScore } = useHealthStore();
  const { recentEvents } = useEventStore();
  const { incidents } = useIncidentStore();
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [securityStats, setSecurityStats] = useState<SecurityStatsResponse | null>(null);

  // Fetch security stats
  useEffect(() => {
    let mounted = true;
    async function fetchStats() {
      try {
        const data = await api.security.getStats();
        if (mounted) setSecurityStats(data);
      } catch {
        // Backend may not be ready
      }
    }
    fetchStats();
    const interval = setInterval(fetchStats, 30_000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

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
  let scoreColorClass = "text-green-500";
  let scoreBgClass = "bg-[hsl(142_71%_45%_/_0.05)] border-[hsl(142_71%_45%_/_0.15)] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]";

  if (!isSecure) {
    if (isWarning) {
      ScoreIcon = Shield;
      scoreColorClass = "text-yellow-500";
      scoreBgClass = "bg-[hsl(48_96%_53%_/_0.05)] border-[hsl(48_96%_53%_/_0.15)] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]";
    } else {
      ScoreIcon = ShieldAlert;
      scoreColorClass = "text-red-500";
      scoreBgClass = "bg-[hsl(0_84%_60%_/_0.05)] border-[hsl(0_84%_60%_/_0.15)] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]";
    }
  }

  return (
    <div className="flex flex-col min-h-full gap-4 md:gap-6 p-4 md:p-6 animate-fade-in overflow-y-auto bg-[var(--color-surface-950)]">
      {/* Top Bar: Security Score */}
      <div className={`flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 md:p-6 rounded-lg border gap-4 ${scoreBgClass}`}>
        <div className="flex items-center gap-4 md:gap-5">
          <div className={`p-3 rounded-md bg-[var(--color-surface-900)] border border-[var(--color-surface-800)] shadow-sm ${scoreColorClass}`}>
            <ScoreIcon className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg md:text-xl font-medium tracking-tight text-[var(--color-text-primary)]">Security Posture</h2>
            <p className="text-[12px] md:text-[13px] text-[var(--color-text-secondary)] mt-0.5">Live threat detection and system integrity</p>
          </div>
        </div>
        <div className="text-left sm:text-right w-full sm:w-auto pl-14 sm:pl-0">
          <div className={`text-3xl md:text-4xl font-semibold tracking-tight ${scoreColorClass}`}>
            {securityScore}<span className="text-lg md:text-xl opacity-50 ml-1">%</span>
          </div>
          <p className="text-[10px] md:text-[11px] uppercase tracking-widest text-[var(--color-text-muted)] mt-1 font-medium">Integrity Score</p>
        </div>
      </div>

      {/* Security Stats Pills */}
      {securityStats && (
        <div className="flex flex-wrap gap-2">
          <StatPill
            label="Failed Logins"
            value={securityStats.failed_logins_24h}
            icon={LogOut}
            colorClass={securityStats.failed_logins_24h > 10 ? "text-[var(--color-severity-high)]" : "text-[var(--color-text-secondary)]"}
            bgClass={securityStats.failed_logins_24h > 10
              ? "bg-[hsl(25_95%_55%_/_0.06)] border-[hsl(25_95%_55%_/_0.15)]"
              : "bg-[var(--color-surface-800)] border-[var(--color-surface-700)]"}
          />
          <StatPill
            label="Successful Logins"
            value={securityStats.successful_logins_24h}
            icon={LogIn}
            colorClass="text-emerald-400"
            bgClass="bg-[hsl(142_71%_45%_/_0.05)] border-[hsl(142_71%_45%_/_0.12)]"
          />
          <StatPill
            label="Threats Detected"
            value={securityStats.threats_detected_24h}
            icon={AlertTriangle}
            colorClass={securityStats.threats_detected_24h > 0 ? "text-[var(--color-severity-critical)]" : "text-[var(--color-text-muted)]"}
            bgClass={securityStats.threats_detected_24h > 0
              ? "bg-[hsl(0_85%_55%_/_0.08)] border-[hsl(0_85%_55%_/_0.2)]"
              : "bg-[var(--color-surface-800)] border-[var(--color-surface-700)]"}
          />
          <StatPill
            label="Brute Force"
            value={securityStats.brute_force_attempts > 0 ? "⚠ Detected" : "None"}
            icon={ShieldAlert}
            colorClass={securityStats.brute_force_attempts > 0 ? "text-[var(--color-severity-critical)]" : "text-[var(--color-text-muted)]"}
            bgClass={securityStats.brute_force_attempts > 0
              ? "bg-[hsl(0_85%_55%_/_0.08)] border-[hsl(0_85%_55%_/_0.2)]"
              : "bg-[var(--color-surface-800)] border-[var(--color-surface-700)]"}
          />
          <StatPill
            label="Total Events (24h)"
            value={securityStats.total_security_events_24h}
            icon={Activity}
            colorClass="text-[var(--color-text-secondary)]"
            bgClass="bg-[var(--color-surface-800)] border-[var(--color-surface-700)]"
          />
        </div>
      )}

      {/* Main Two-Column Layout — now fully responsive */}
      <div className="flex flex-col lg:flex-row gap-4 lg:gap-6 flex-1 min-h-0">
        {/* Left Column: Active Threats (Incidents) */}
        <div className="w-full lg:w-1/2 flex flex-col gap-3 min-h-[300px] lg:min-h-0">
          <div className="flex items-center justify-between pl-1 pr-2">
             <h3 className="text-[11px] font-medium tracking-widest uppercase text-[var(--color-text-secondary)] flex items-center gap-2">
               <Activity className="w-3.5 h-3.5 opacity-60 text-[var(--color-severity-high)]" /> Active Threats
             </h3>
             <span className="text-[10px] px-2 py-0.5 rounded border border-[var(--color-surface-700)] bg-[var(--color-surface-800)] text-[var(--color-text-muted)] font-medium tracking-widest uppercase shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
               {highSeverityIncidents.length} High Severity
             </span>
          </div>
          
          <div className="flex-1 glass-card overflow-hidden flex flex-col border-[var(--color-surface-700)] rounded-lg bg-[var(--color-surface-900)]">
            {highSeverityIncidents.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-3 p-8 text-center text-[var(--color-text-muted)]">
                <div className="w-10 h-10 rounded-full bg-[var(--color-surface-800)] flex items-center justify-center border border-[var(--color-surface-700)] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] mb-1">
                  <ShieldCheck className="w-5 h-5 text-green-500 opacity-80" />
                </div>
                <p className="text-[13px] font-medium">No active high-severity threats.</p>
                <p className="text-[11px] opacity-70">Your system is secure.</p>
              </div>
            ) : (
              <div className="flex-1 p-4 flex flex-col gap-2.5">
                {highSeverityIncidents.map((incident) => (
                  <div key={incident.id} className="p-4 rounded-md bg-[var(--color-surface-800)] border border-[var(--color-surface-700)] shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]">
                    <div className="flex justify-between items-start mb-2.5">
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium tracking-wide uppercase bg-[hsl(0_84%_60%_/_0.15)] text-[var(--color-severity-critical)] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
                        {incident.severity}
                      </span>
                      <span className="text-[11px] text-[var(--color-text-muted)] font-medium">
                        {formatDistanceToNow(new Date(incident.created_at), { addSuffix: true })}
                      </span>
                    </div>
                    <h4 className="font-medium text-[var(--color-text-primary)] text-[13px] leading-snug mb-2">{incident.title}</h4>
                    <p className="text-[13px] text-[var(--color-text-secondary)] leading-relaxed line-clamp-2">{incident.description}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Live Security Event Stream — now responsive (was w-1/2 fixed) */}
        <div className="w-full lg:w-1/2 flex flex-col gap-3 min-h-[300px] lg:min-h-0">
           <div className="flex items-center justify-between pl-1 pr-2">
             <h3 className="text-[11px] font-medium tracking-widest uppercase text-[var(--color-text-secondary)] flex items-center gap-2">
               <Search className="w-3.5 h-3.5 opacity-60 text-[var(--color-brand-400)]" /> Event Stream
             </h3>
             <span className="text-[10px] px-2 py-0.5 rounded border border-[var(--color-surface-700)] bg-[var(--color-surface-800)] text-[var(--color-text-muted)] font-medium tracking-widest uppercase shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
               Last 24h
             </span>
          </div>

          <div className="flex-1 glass-card overflow-hidden flex flex-col border-[var(--color-surface-700)] rounded-lg bg-[var(--color-surface-900)]">
            {securityEvents.length === 0 ? (
               <div className="flex flex-col items-center justify-center h-full gap-3 p-8 text-center text-[var(--color-text-muted)]">
                 <div className="w-10 h-10 rounded-full bg-[var(--color-surface-800)] flex items-center justify-center border border-[var(--color-surface-700)] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] mb-1">
                   <Activity className="w-4 h-4 opacity-50" />
                 </div>
                 <p className="text-[13px] font-medium">No security events detected recently.</p>
               </div>
            ) : (
               <div className="flex-1 p-4 flex flex-col gap-2">
                 {securityEvents.map((event, i) => {
                   const hasAI = !!event.ai_insight;
                   const isHigh = event.severity === "high" || event.severity === "critical";
                   
                   return (
                     <button
                       key={event.id}
                       onClick={() => setSelectedEventId(event.id)}
                       className="w-full text-left p-3.5 rounded-md border border-[var(--color-surface-700)] bg-[var(--color-surface-800)]/40 hover:bg-[var(--color-surface-800)] hover:border-[var(--color-surface-500)] transition-all duration-200 flex items-start gap-3.5 group shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]"
                       style={{ animationDelay: `${i * 30}ms` }}
                     >
                       <div className={`mt-1 w-2 h-2 rounded-full ring-2 ring-[var(--color-surface-900)] flex-shrink-0 bg-severity-${event.severity}`} />
                       <div className="flex-1 min-w-0">
                         <div className="flex justify-between items-start mb-1.5">
                           <span className="text-[11px] font-medium text-[var(--color-brand-400)]">
                             {format(new Date(event.occurred_at), "HH:mm:ss.SSS")}
                           </span>
                           {isHigh && (
                             <Zap className={`w-3.5 h-3.5 ${hasAI ? "text-indigo-400" : "text-indigo-400/30"} transition-colors`} />
                           )}
                         </div>
                         <p className="font-medium text-[13px] text-[var(--color-text-primary)] truncate mb-1.5">{event.title}</p>
                         <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest font-medium text-[var(--color-text-muted)]">
                           <span>{event.source}</span>
                           {event.source_id && (
                             <span className="text-[var(--color-brand-500)] font-mono">Event {event.source_id}</span>
                           )}
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

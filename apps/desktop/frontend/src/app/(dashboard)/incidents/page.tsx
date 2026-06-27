"use client";

import { useEffect, useState } from "react";
import { useIncidentStore } from "@/stores/incident-store";
import { formatDistanceToNow, format } from "date-fns";
import { AlertTriangle, CheckCircle2, ShieldAlert, AlertCircle, Info, Clock, Check, X } from "lucide-react";
import { EventDetailModal } from "@/components/events/EventDetailModal";

function SeverityBadge({ severity }: { severity: string }) {
  const styles = {
    critical: "severity-critical",
    high: "severity-high",
    medium: "severity-medium",
    low: "severity-low",
    info: "severity-info",
  };
  const Icons = {
    critical: ShieldAlert,
    high: AlertTriangle,
    medium: AlertCircle,
    low: Info,
    info: Info,
  };
  
  const Icon = Icons[severity as keyof typeof Icons] || Info;
  const style = styles[severity as keyof typeof styles] || styles.info;

  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium tracking-wide ${style} shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]`}>
      <Icon className="w-3 h-3" />
      <span className="capitalize">{severity}</span>
    </span>
  );
}

export default function IncidentsPage() {
  const { incidents, loading, fetchIncidents, updateIncidentStatus } = useIncidentStore();
  const [selectedIncidentId, setSelectedIncidentId] = useState<string | null>(null);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);

  useEffect(() => {
    fetchIncidents();
  }, [fetchIncidents]);

  // Select first incident if none selected
  useEffect(() => {
    if (!selectedIncidentId && incidents.length > 0) {
      setSelectedIncidentId(incidents[0].id);
    }
  }, [incidents, selectedIncidentId]);

  const selectedIncident = incidents.find(i => i.id === selectedIncidentId);

  return (
    <div className="flex h-full gap-6 p-6 animate-fade-in bg-[var(--color-surface-950)]">
      {/* Left Column: Incident List */}
      <div className="w-1/3 flex flex-col gap-4">
        <h2 className="text-[11px] font-medium tracking-widest uppercase text-[var(--color-text-secondary)] pl-1">Active Incidents</h2>
        <div className="flex-1 glass-card overflow-hidden flex flex-col">
          {loading && incidents.length === 0 ? (
            <div className="p-8 text-center text-sm text-[var(--color-text-muted)] animate-pulse">Loading incidents...</div>
          ) : incidents.length === 0 ? (
            <div className="p-8 text-center flex flex-col items-center justify-center h-full gap-3 text-[var(--color-text-muted)]">
               <CheckCircle2 className="w-8 h-8 text-green-500 opacity-80 mb-2" />
               <p className="text-[13px] font-medium">No active incidents</p>
               <p className="text-[11px] opacity-70">Your system is healthy.</p>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-1.5">
              {incidents.map((incident) => (
                <button
                  key={incident.id}
                  onClick={() => setSelectedIncidentId(incident.id)}
                  className={`w-full text-left p-3.5 rounded-lg border transition-all duration-200 ${
                    selectedIncidentId === incident.id
                      ? "bg-[var(--color-surface-700)] border-[var(--color-surface-500)] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]"
                      : "bg-transparent border-transparent hover:bg-[var(--color-surface-800)] hover:border-[var(--color-surface-600)]"
                  }`}
                >
                  <div className="flex justify-between items-start mb-2.5">
                    <SeverityBadge severity={incident.severity} />
                    <span className="text-[11px] text-[var(--color-text-muted)] flex items-center gap-1 font-medium">
                      {formatDistanceToNow(new Date(incident.created_at), { addSuffix: true })}
                    </span>
                  </div>
                  <h3 className="font-medium text-[var(--color-text-primary)] line-clamp-2 leading-relaxed text-[13px]">
                    {incident.title}
                  </h3>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right Column: Incident Details */}
      <div className="w-2/3 flex flex-col gap-4 h-full">
         <h2 className="text-[11px] font-medium tracking-widest uppercase text-[var(--color-text-secondary)] pl-1">Details</h2>
         <div className="flex-1 glass-card overflow-hidden flex flex-col relative bg-[var(--color-surface-900)]">
           {selectedIncident ? (
             <div className="flex-1 overflow-y-auto">
                <div className="px-8 py-8 border-b border-[var(--color-surface-700)] bg-[var(--color-surface-800)]/30">
                  <div className="flex items-center gap-3 mb-4">
                    <SeverityBadge severity={selectedIncident.severity} />
                    <span className="text-[10px] px-2 py-0.5 rounded bg-[var(--color-surface-700)] uppercase tracking-wider font-semibold text-[var(--color-text-secondary)] border border-[var(--color-surface-600)] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
                      {selectedIncident.status}
                    </span>
                    <span className="text-[11px] font-mono text-[var(--color-text-muted)] ml-auto">
                      ID: {selectedIncident.id.substring(0, 8)}
                    </span>
                  </div>
                  <h1 className="text-xl font-medium mb-3 text-[var(--color-text-primary)] leading-tight tracking-tight">{selectedIncident.title}</h1>
                  <p className="text-[var(--color-text-secondary)] text-[13px] leading-relaxed mb-8 max-w-3xl">
                    {selectedIncident.description}
                  </p>
                  
                  <div className="flex gap-3">
                    <button 
                      onClick={() => updateIncidentStatus(selectedIncident.id, "resolved", "Resolved via dashboard")}
                      className="flex items-center gap-2 px-4 py-2 bg-[hsl(142_71%_45%_/_0.1)] text-green-500 hover:bg-[hsl(142_71%_45%_/_0.15)] border border-[hsl(142_71%_45%_/_0.2)] rounded-md transition-colors text-[13px] font-medium shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]"
                    >
                      <Check className="w-4 h-4" /> Resolve Incident
                    </button>
                    <button 
                      onClick={() => updateIncidentStatus(selectedIncident.id, "dismissed", "Dismissed via dashboard")}
                      className="flex items-center gap-2 px-4 py-2 bg-[var(--color-surface-800)] hover:bg-[var(--color-surface-700)] text-[var(--color-text-primary)] rounded-md transition-colors text-[13px] font-medium border border-[var(--color-surface-600)] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]"
                    >
                      <X className="w-4 h-4" /> Dismiss
                    </button>
                  </div>
                </div>

                <div className="p-8">
                  <h3 className="text-[11px] font-medium tracking-widest uppercase text-[var(--color-text-secondary)] mb-6 flex items-center gap-2">
                    Triggering Events Timeline
                  </h3>
                  
                  {(!selectedIncident.events || selectedIncident.events.length === 0) ? (
                    <div className="p-6 rounded-lg bg-[var(--color-surface-800)]/30 border border-[var(--color-surface-700)] text-center text-[13px] text-[var(--color-text-muted)]">
                      No events associated with this incident.
                    </div>
                  ) : (
                    <div className="relative pl-6 border-l border-[var(--color-surface-700)] flex flex-col gap-6 ml-2">
                      {selectedIncident.events.map((event, index) => (
                         <div key={event.id} className="relative">
                            <div className={`absolute -left-[29px] top-1.5 w-2.5 h-2.5 rounded-full ring-4 ring-[var(--color-surface-900)] bg-severity-${event.severity}`} />
                            <button
                              onClick={() => setSelectedEventId(event.id)}
                              className="text-left w-full group block"
                            >
                               <div className="text-[11px] font-medium text-[var(--color-text-muted)] mb-1.5 flex items-center gap-2">
                                 <span className="text-[var(--color-brand-400)]">{format(new Date(event.occurred_at), "HH:mm:ss.SSS")}</span>
                                 <span className="w-0.5 h-0.5 rounded-full bg-[var(--color-surface-600)]" />
                                 <span className="uppercase tracking-wider">{event.source}</span>
                               </div>
                               <div className="glass-card p-4 rounded-lg border border-[var(--color-surface-700)] group-hover:border-[var(--color-surface-500)] transition-all duration-200 bg-[var(--color-surface-800)]/50">
                                 <p className="font-medium text-[var(--color-text-primary)] text-[13px] leading-relaxed">
                                   {event.title}
                                 </p>
                                 <span className="text-[10px] font-medium uppercase tracking-widest text-[var(--color-brand-500)] mt-2 block">
                                    {event.category}
                                 </span>
                               </div>
                            </button>
                         </div>
                      ))}
                    </div>
                  )}
                </div>
             </div>
           ) : (
             <div className="flex-1 flex flex-col gap-4 items-center justify-center text-[var(--color-text-muted)]">
               <div className="w-12 h-12 rounded-full bg-[var(--color-surface-800)] flex items-center justify-center border border-[var(--color-surface-700)] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] mb-2">
                 <ShieldAlert className="w-5 h-5 opacity-50" />
               </div>
               <p className="text-[13px] font-medium">Select an incident to view details</p>
               <p className="text-[11px] opacity-70 max-w-xs text-center">Review the incident timeline, related events, and AI analysis to resolve the issue.</p>
             </div>
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

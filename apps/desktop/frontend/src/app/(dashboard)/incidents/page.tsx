"use client";

import { useEffect, useState } from "react";
import { useIncidentStore } from "@/stores/incident-store";
import { formatDistanceToNow, format } from "date-fns";
import { AlertTriangle, CheckCircle2, ShieldAlert, AlertCircle, Info, Check, X, Filter } from "lucide-react";
import { EventDetailModal } from "@/components/events/EventDetailModal";
import { EventRead, IncidentStatus } from "@/lib/types";

type FilterTab = "open" | "investigating" | "resolved" | "all";

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

function StatusBadge({ status }: { status: IncidentStatus }) {
  const map: Record<IncidentStatus, { label: string; color: string }> = {
    open: { label: "Open", color: "text-[var(--color-severity-high)] bg-[hsl(25_95%_55%_/_0.1)] border-[hsl(25_95%_55%_/_0.2)]" },
    investigating: { label: "Investigating", color: "text-yellow-400 bg-[hsl(48_96%_53%_/_0.1)] border-[hsl(48_96%_53%_/_0.2)]" },
    resolved: { label: "Resolved", color: "text-emerald-400 bg-[hsl(142_71%_45%_/_0.1)] border-[hsl(142_71%_45%_/_0.2)]" },
    dismissed: { label: "Dismissed", color: "text-[var(--color-text-muted)] bg-[var(--color-surface-700)] border-[var(--color-surface-600)]" },
  };
  const { label, color } = map[status] || map.open;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest border ${color}`}>
      {label}
    </span>
  );
}

const FILTER_TABS: { key: FilterTab; label: string }[] = [
  { key: "open", label: "Open" },
  { key: "investigating", label: "Investigating" },
  { key: "resolved", label: "Resolved" },
  { key: "all", label: "All" },
];

export default function IncidentsPage() {
  const { incidents, loading, fetchIncidents, updateIncidentStatus } = useIncidentStore();
  const [selectedIncidentId, setSelectedIncidentId] = useState<string | null>(null);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<FilterTab>("open");

  useEffect(() => {
    fetchIncidents();
  }, [fetchIncidents]);

  // Apply status filter
  const filteredIncidents = incidents.filter((i) => {
    if (activeFilter === "all") return true;
    return i.status === activeFilter;
  });

  // Select first filtered incident if none selected
  useEffect(() => {
    if (!selectedIncidentId && filteredIncidents.length > 0) {
      setSelectedIncidentId(filteredIncidents[0].id);
    }
  }, [filteredIncidents, selectedIncidentId]);

  const selectedIncident = incidents.find((i) => i.id === selectedIncidentId);

  // Count per status
  const counts = {
    open: incidents.filter((i) => i.status === "open").length,
    investigating: incidents.filter((i) => i.status === "investigating").length,
    resolved: incidents.filter((i) => i.status === "resolved").length,
    all: incidents.length,
  };

  return (
    <div className="flex flex-col lg:flex-row min-h-full gap-4 lg:gap-6 p-4 lg:p-6 animate-fade-in bg-[var(--color-surface-950)] ">
      {/* Left Column: Incident List */}
      <div className="w-full lg:w-1/3 flex flex-col gap-3 lg:h-full min-h-[300px]">
        {/* Filter tabs */}
        <div className="flex items-center gap-1 p-1 bg-[var(--color-surface-800)] rounded-lg border border-[var(--color-surface-700)]">
          {FILTER_TABS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => {
                setActiveFilter(key);
                setSelectedIncidentId(null);
              }}
              className={`flex-1 text-[11px] font-medium py-1.5 rounded-md transition-all duration-150 ${
                activeFilter === key
                  ? "bg-[var(--color-surface-600)] text-[var(--color-text-primary)] shadow-[inset_0_1px_0_rgba(255,255,255,0.07)]"
                  : "text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
              }`}
            >
              {label}
              {counts[key] > 0 && (
                <span className={`ml-1 text-[10px] px-1 py-0 rounded font-bold ${
                  activeFilter === key ? "text-[var(--color-brand-400)]" : "text-[var(--color-text-muted)]"
                }`}>
                  {counts[key]}
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="flex-1 glass-card overflow-hidden flex flex-col">
          {loading && filteredIncidents.length === 0 ? (
            <div className="p-8 text-center text-sm text-[var(--color-text-muted)] animate-pulse">Loading incidents...</div>
          ) : filteredIncidents.length === 0 ? (
            <div className="p-8 text-center flex flex-col items-center justify-center h-full gap-3 text-[var(--color-text-muted)]">
               <CheckCircle2 className="w-8 h-8 text-green-500 opacity-80 mb-2" />
               <p className="text-[13px] font-medium">No {activeFilter !== "all" ? activeFilter : ""} incidents</p>
               <p className="text-[11px] opacity-70">
                 {activeFilter === "open" ? "Your system is healthy." : `Nothing to show for this filter.`}
               </p>
            </div>
          ) : (
            <div className="flex-1 p-2 flex flex-col gap-1.5 ">
              {filteredIncidents.map((incident) => (
                <button
                  key={incident.id}
                  onClick={() => setSelectedIncidentId(incident.id)}
                  className={`w-full text-left p-3.5 rounded-lg border transition-all duration-200 ${
                    selectedIncidentId === incident.id
                      ? "bg-[var(--color-surface-700)] border-[var(--color-surface-500)] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]"
                      : "bg-transparent border-transparent hover:bg-[var(--color-surface-800)] hover:border-[var(--color-surface-600)]"
                  }`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <SeverityBadge severity={incident.severity} />
                    <StatusBadge status={incident.status} />
                  </div>
                  <h3 className="font-medium text-[var(--color-text-primary)] line-clamp-2 leading-relaxed text-[13px] mb-1">
                    {incident.title}
                  </h3>
                  <p className="text-[11px] text-[var(--color-text-muted)] font-medium">
                    {formatDistanceToNow(new Date(incident.created_at), { addSuffix: true })}
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right Column: Incident Details */}
      <div className="w-full lg:w-2/3 flex flex-col gap-3 lg:h-full min-h-[500px]">
         <h2 className="text-[11px] font-medium tracking-widest uppercase text-[var(--color-text-secondary)] pl-1">Details</h2>
         <div className="flex-1 glass-card overflow-hidden flex flex-col relative bg-[var(--color-surface-900)]">
           {selectedIncident ? (
             <div className="flex-1">
                <div className="px-8 py-8 border-b border-[var(--color-surface-700)] bg-[var(--color-surface-800)]/30">
                  <div className="flex items-center gap-3 mb-4 flex-wrap">
                    <SeverityBadge severity={selectedIncident.severity} />
                    <StatusBadge status={selectedIncident.status} />
                    <span className="text-[11px] font-mono text-[var(--color-text-muted)] ml-auto">
                      ID: {selectedIncident.id.substring(0, 8)}
                    </span>
                  </div>
                  <h1 className="text-xl font-medium mb-3 text-[var(--color-text-primary)] leading-tight tracking-tight">{selectedIncident.title}</h1>
                  <p className="text-[var(--color-text-secondary)] text-[13px] leading-relaxed mb-8 max-w-3xl">
                    {selectedIncident.description}
                  </p>
                  
                  {/* Action buttons — only for open/investigating */}
                  {(selectedIncident.status === "open" || selectedIncident.status === "investigating") && (
                    <div className="flex gap-3 flex-wrap">
                      {selectedIncident.status === "open" && (
                        <button 
                          onClick={() => updateIncidentStatus(selectedIncident.id, "investigating", undefined)}
                          className="flex items-center gap-2 px-4 py-2 bg-[hsl(48_96%_53%_/_0.1)] text-yellow-400 hover:bg-[hsl(48_96%_53%_/_0.15)] border border-[hsl(48_96%_53%_/_0.2)] rounded-md transition-colors text-[13px] font-medium shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]"
                        >
                          <Filter className="w-4 h-4" /> Investigate
                        </button>
                      )}
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
                  )}

                  {selectedIncident.resolution_notes && (
                    <div className="mt-4 p-3 rounded-lg bg-[var(--color-surface-800)] border border-[var(--color-surface-700)] text-[13px] text-[var(--color-text-secondary)]">
                      <span className="text-[10px] uppercase tracking-widest text-[var(--color-text-muted)] block mb-1">Resolution Notes</span>
                      {selectedIncident.resolution_notes}
                    </div>
                  )}
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
                      {selectedIncident.events.map((event: EventRead) => (
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
                                 {event.source_id && (
                                   <span className="font-mono text-[var(--color-brand-500)]">Event {event.source_id}</span>
                                 )}
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

"use client";

import { useEffect, useState } from "react";
import { useIncidentStore } from "@/stores/incident-store";
import { formatDistanceToNow, format } from "date-fns";
import { AlertTriangle, CheckCircle2, ShieldAlert, AlertCircle, Info, Clock, Check, X } from "lucide-react";
import { EventDetailModal } from "@/components/events/EventDetailModal";

function SeverityBadge({ severity }: { severity: string }) {
  const colors = {
    critical: "bg-red-500/20 text-red-400 border-red-500/30",
    high: "bg-orange-500/20 text-orange-400 border-orange-500/30",
    medium: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
    low: "bg-green-500/20 text-green-400 border-green-500/30",
    info: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  };
  const Icons = {
    critical: ShieldAlert,
    high: AlertTriangle,
    medium: AlertCircle,
    low: Info,
    info: Info,
  };
  
  const Icon = Icons[severity as keyof typeof Icons] || Info;
  const color = colors[severity as keyof typeof colors] || colors.info;

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${color}`}>
      <Icon className="w-3.5 h-3.5" />
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
    <div className="flex h-full gap-8 p-8 animate-fade-in">
      {/* Left Column: Incident List */}
      <div className="w-1/3 flex flex-col gap-5">
        <h2 className="text-2xl font-semibold tracking-tight text-[var(--color-text-primary)]">Active Incidents</h2>
        <div className="flex-1 glass-card overflow-hidden flex flex-col border-[var(--color-surface-700)] shadow-lg shadow-black/20">
          {loading && incidents.length === 0 ? (
            <div className="p-8 text-center text-sm opacity-50 animate-pulse">Loading incidents...</div>
          ) : incidents.length === 0 ? (
            <div className="p-8 text-center flex flex-col items-center justify-center h-full gap-4 opacity-50">
               <CheckCircle2 className="w-12 h-12 text-green-400 opacity-60" />
               <p className="text-lg font-medium">No active incidents</p>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
              {incidents.map((incident) => (
                <button
                  key={incident.id}
                  onClick={() => setSelectedIncidentId(incident.id)}
                  className={`w-full text-left p-5 rounded-2xl border transition-all duration-300 ${
                    selectedIncidentId === incident.id
                      ? "bg-[var(--color-surface-700)] border-[var(--color-primary)]/40 shadow-lg shadow-[var(--color-primary)]/5"
                      : "bg-[var(--color-surface-800)]/40 border-transparent hover:bg-[var(--color-surface-700)]/50"
                  }`}
                >
                  <div className="flex justify-between items-start mb-3">
                    <SeverityBadge severity={incident.severity} />
                    <span className="text-xs opacity-50 flex items-center gap-1.5 font-medium">
                      <Clock className="w-3.5 h-3.5" />
                      {formatDistanceToNow(new Date(incident.created_at), { addSuffix: true })}
                    </span>
                  </div>
                  <h3 className="font-medium text-[var(--color-text-primary)] line-clamp-2 leading-relaxed text-sm">
                    {incident.title}
                  </h3>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right Column: Incident Details */}
      <div className="w-2/3 flex flex-col gap-5 h-full">
         <h2 className="text-2xl font-semibold tracking-tight text-[var(--color-text-primary)] opacity-0 select-none">Details</h2>
         <div className="flex-1 glass-card overflow-hidden flex flex-col relative border-[var(--color-surface-700)] shadow-xl shadow-black/30">
           {selectedIncident ? (
             <div className="flex-1 overflow-y-auto">
                <div className="p-10 border-b border-[var(--color-surface-700)] bg-gradient-to-b from-[var(--color-surface-800)]/50 to-transparent">
                  <div className="flex items-center gap-4 mb-6">
                    <SeverityBadge severity={selectedIncident.severity} />
                    <span className="text-xs px-3 py-1.5 rounded-full bg-[var(--color-surface-700)] uppercase tracking-wider font-semibold opacity-80 border border-[var(--color-surface-600)]">
                      {selectedIncident.status}
                    </span>
                    <span className="text-sm font-mono opacity-40 ml-auto">
                      ID: {selectedIncident.id.substring(0, 8)}
                    </span>
                  </div>
                  <h1 className="text-3xl font-bold mb-5 text-white leading-tight tracking-tight">{selectedIncident.title}</h1>
                  <p className="text-[var(--color-text-secondary)] text-lg leading-relaxed mb-10 max-w-3xl">
                    {selectedIncident.description}
                  </p>
                  
                  <div className="flex gap-4 mt-8">
                    <button 
                      onClick={() => updateIncidentStatus(selectedIncident.id, "resolved", "Resolved via dashboard")}
                      className="flex items-center gap-2.5 px-6 py-3 bg-green-500/10 text-green-400 hover:bg-green-500/20 border border-green-500/20 rounded-xl transition-colors font-semibold shadow-sm hover:shadow-green-500/10"
                    >
                      <Check className="w-5 h-5" /> Resolve Incident
                    </button>
                    <button 
                      onClick={() => updateIncidentStatus(selectedIncident.id, "dismissed", "Dismissed via dashboard")}
                      className="flex items-center gap-2.5 px-6 py-3 bg-[var(--color-surface-700)] hover:bg-[var(--color-surface-600)] text-[var(--color-text-primary)] rounded-xl transition-colors font-semibold border border-[var(--color-surface-600)]"
                    >
                      <X className="w-5 h-5" /> Dismiss
                    </button>
                  </div>
                </div>

                <div className="p-10">
                  <h3 className="text-xl font-semibold mb-8 flex items-center gap-3 text-white/90">
                    <Clock className="w-5 h-5 opacity-50" /> Triggering Events Timeline
                  </h3>
                  
                  {(!selectedIncident.events || selectedIncident.events.length === 0) ? (
                    <div className="p-6 rounded-2xl bg-[var(--color-surface-800)]/30 border border-[var(--color-surface-700)] text-center opacity-50">
                      No events associated with this incident.
                    </div>
                  ) : (
                    <div className="relative pl-8 border-l border-[var(--color-surface-600)] flex flex-col gap-10 ml-4">
                      {selectedIncident.events.map((event, index) => (
                         <div key={event.id} className="relative">
                            <div className={`absolute -left-[41px] top-1 w-5 h-5 rounded-full border-[5px] border-[var(--color-background)] bg-severity-${event.severity}`} />
                            <button
                              onClick={() => setSelectedEventId(event.id)}
                              className="text-left w-full group block"
                            >
                               <div className="text-xs font-medium opacity-50 mb-2 flex items-center gap-2">
                                 <span className="text-[var(--color-primary)] opacity-80">{format(new Date(event.occurred_at), "HH:mm:ss.SSS")}</span>
                                 <span>•</span>
                                 <span className="uppercase tracking-wider">{event.source}</span>
                               </div>
                               <div className="glass-card p-5 rounded-2xl border border-[var(--color-surface-700)] group-hover:border-[var(--color-primary)]/50 transition-all duration-300 shadow-sm group-hover:shadow-[var(--color-primary)]/10 bg-[var(--color-surface-800)]/30">
                                 <p className="font-semibold text-[var(--color-text-primary)] leading-relaxed text-base">
                                   {event.title}
                                 </p>
                                 <span className="text-xs font-bold uppercase tracking-widest opacity-40 mt-3 block text-[var(--color-primary)]">
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
             <div className="flex-1 flex flex-col gap-4 items-center justify-center opacity-40">
               <ShieldAlert className="w-16 h-16 opacity-50" />
               <p className="text-lg font-medium tracking-wide">Select an incident to view details</p>
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

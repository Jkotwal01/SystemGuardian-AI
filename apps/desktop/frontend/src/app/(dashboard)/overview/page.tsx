"use client";

import { useEffect, useState } from "react";
import { HealthScoreRing } from "@/components/dashboard/HealthScoreRing";
import { MetricsStrip } from "@/components/dashboard/MetricsStrip";
import { RecentEvents } from "@/components/dashboard/RecentEvents";
import { useWebSockets } from "@/hooks/use-websocket";
import { useHealthStore } from "@/stores/health-store";
import { useEventStore } from "@/stores/event-store";
import { useIncidentStore } from "@/stores/incident-store";
import { ShieldAlert, AlertTriangle, CheckCircle2, TrendingDown, Clock } from "lucide-react";
import Link from "next/link";
import { api } from "@/lib/api-client";
import { PredictionRead } from "@/lib/types";

function ActivePredictionsPanel() {
  const [predictions, setPredictions] = useState<PredictionRead[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadPredictions() {
      try {
        const data = await api.predictions.getActive();
        setPredictions(data);
      } catch (err) {
        console.error("Failed to load predictions", err);
      } finally {
        setIsLoading(false);
      }
    }
    loadPredictions();
  }, []);

  if (isLoading) {
    return (
      <div className="glass-card p-5 h-full border border-[var(--color-surface-700)] flex items-center justify-center">
        <span className="text-[12px] text-[var(--color-text-muted)] animate-pulse">Analyzing trends...</span>
      </div>
    );
  }

  if (predictions.length === 0) {
    return (
      <div className="glass-card p-5 flex flex-col items-center justify-center gap-3 animate-fade-in stagger-3 h-full text-center border border-[var(--color-surface-700)]">
        <TrendingDown className="w-8 h-8 text-indigo-500/80" />
        <div>
          <p className="text-[13px] font-medium text-[var(--color-text-primary)]">Predictive Analytics</p>
          <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5">No future failures predicted</p>
        </div>
      </div>
    );
  }

  const topPrediction = predictions[0];

  return (
    <div className="glass-card p-5 flex flex-col gap-3 animate-fade-in stagger-3 h-full border border-[hsl(260_85%_65%_/_0.2)]">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TrendingDown className="w-4 h-4 text-indigo-400" />
          <span className="text-[11px] font-bold uppercase tracking-widest text-indigo-400">
            Active Predictions
          </span>
        </div>
        <span className="text-[11px] text-[var(--color-text-muted)]">
          {predictions.length} detected
        </span>
      </div>

      <div className="mt-2 border-l-2 border-indigo-500 pl-3">
        <p className="text-[13px] font-medium text-[var(--color-text-primary)] leading-snug mb-1.5">
          {topPrediction.reason}
        </p>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-[var(--color-text-muted)] uppercase tracking-wider font-medium">Confidence:</span>
            <span className="text-[12px] font-bold text-indigo-300">{(topPrediction.failure_probability * 100).toFixed(0)}%</span>
          </div>
          {topPrediction.predicted_time_to_failure_hours && (
            <div className="flex items-center gap-1.5">
              <Clock className="w-3 h-3 text-[var(--color-text-muted)]" />
              <span className="text-[11px] text-[var(--color-text-muted)]">{Math.round(topPrediction.predicted_time_to_failure_hours)}h remaining</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ActiveIncidentsSummary() {
  const { incidents, fetchIncidents } = useIncidentStore();

  useEffect(() => {
    fetchIncidents();
  }, [fetchIncidents]);

  const openIncidents = incidents.filter(
    (i) => i.status === "open" || i.status === "investigating"
  );
  const criticalCount = openIncidents.filter((i) => i.severity === "critical").length;
  const highCount = openIncidents.filter((i) => i.severity === "high").length;
  const topIncident = openIncidents[0];

  if (openIncidents.length === 0) {
    return (
      <div className="glass-card p-5 flex flex-col items-center justify-center gap-3 animate-fade-in stagger-2 h-full text-center border border-[var(--color-surface-700)]">
        <CheckCircle2 className="w-8 h-8 text-emerald-500 opacity-90" />
        <div>
          <p className="text-[13px] font-medium text-[var(--color-text-primary)]">No Active Incidents</p>
          <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5">System is operating normally</p>
        </div>
      </div>
    );
  }

  return (
    <Link
      href="/incidents"
      className="glass-card p-5 flex flex-col gap-3 animate-fade-in stagger-2 h-full border border-[hsl(0_85%_55%_/_0.2)] hover:border-[hsl(0_85%_55%_/_0.35)] transition-all duration-200 group relative overflow-hidden cursor-pointer no-underline"
    >
      {/* Subtle red glow */}
      <div className="absolute inset-0 bg-gradient-to-br from-[hsl(0_85%_55%_/_0.04)] to-transparent pointer-events-none" />

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-[var(--color-severity-critical)]" />
          <span className="text-[11px] font-bold uppercase tracking-widest text-[var(--color-severity-critical)]">
            Active Incidents
          </span>
        </div>
        <span className="text-[11px] text-[var(--color-text-muted)] group-hover:text-[var(--color-text-secondary)] transition-colors">
          View All →
        </span>
      </div>

      {/* Counts */}
      <div className="flex gap-3">
        {criticalCount > 0 && (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[hsl(0_85%_55%_/_0.1)] border border-[hsl(0_85%_55%_/_0.2)]">
            <AlertTriangle className="w-3 h-3 text-[var(--color-severity-critical)]" />
            <span className="text-[11px] font-bold text-[var(--color-severity-critical)]">{criticalCount} Critical</span>
          </div>
        )}
        {highCount > 0 && (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[hsl(25_95%_55%_/_0.1)] border border-[hsl(25_95%_55%_/_0.2)]">
            <AlertTriangle className="w-3 h-3 text-[var(--color-severity-high)]" />
            <span className="text-[11px] font-bold text-[var(--color-severity-high)]">{highCount} High</span>
          </div>
        )}
        <span className="text-[11px] text-[var(--color-text-muted)] self-center">
          {openIncidents.length} total
        </span>
      </div>

      {/* Top incident preview */}
      {topIncident && (
        <div className="border-t border-[var(--color-surface-700)] pt-3">
          <p className="text-[12px] text-[var(--color-text-muted)] mb-1 uppercase tracking-widest font-medium">
            Most Recent
          </p>
          <p className="text-[13px] font-medium text-[var(--color-text-primary)] line-clamp-2 leading-snug">
            {topIncident.title}
          </p>
        </div>
      )}
    </Link>
  );
}

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
    <div className="p-4 md:p-6 flex flex-col gap-4 md:gap-6 min-h-full">
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
        <div className="flex flex-col gap-4 md:gap-6">
          <MetricsStrip />
          
          {/* Active Incidents and Predictions */}
          <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
            <ActiveIncidentsSummary />
            <ActivePredictionsPanel />
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

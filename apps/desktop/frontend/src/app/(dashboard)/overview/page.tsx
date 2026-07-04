"use client";

import { useEffect, useState } from "react";
import { HealthScoreRing } from "@/components/dashboard/HealthScoreRing";
import { MetricsStrip } from "@/components/dashboard/MetricsStrip";
import { RecentEvents } from "@/components/dashboard/RecentEvents";
import { useWebSockets } from "@/hooks/use-websocket";
import { useHealthStore } from "@/stores/health-store";
import { useEventStore } from "@/stores/event-store";
import { useIncidentStore } from "@/stores/incident-store";
import { ShieldAlert, AlertTriangle, CheckCircle2, TrendingDown, Clock, Laptop, Activity, Server } from "lucide-react";
import Link from "next/link";
import { api } from "@/lib/api-client";
import { PredictionRead, SystemInfoRead } from "@/lib/types";

function formatUptime(seconds: number): string {
  if (!seconds) return "Unknown";
  const days = Math.floor(seconds / (3600 * 24));
  const hrs = Math.floor((seconds % (3600 * 24)) / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (days > 0) return `${days}d ${hrs}h`;
  if (hrs > 0) return `${hrs}h ${mins}m`;
  return `${mins}m`;
}

function WelcomeBanner() {
  const [sysInfo, setSysInfo] = useState<SystemInfoRead | null>(null);

  useEffect(() => {
    async function loadSysInfo() {
      try {
        const data = await api.system.getInfo();
        setSysInfo(data);
      } catch (err) {
        console.error("Failed to fetch system info", err);
      }
    }
    loadSysInfo();
    // Update uptime periodically
    const interval = setInterval(loadSysInfo, 60000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 p-6 md:p-8 rounded-3xl glass-card border border-[var(--color-surface-700)] bg-gradient-to-br from-[var(--color-surface-900)] to-[var(--color-surface-950)] relative overflow-hidden group">
      {/* Subtle background glow */}
      <div className="absolute top-0 right-0 -mr-20 -mt-20 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl opacity-50 group-hover:opacity-70 transition-opacity" />
      
      <div className="relative z-10">
        <h1 className="text-xl md:text-2xl font-bold tracking-tight text-[var(--color-text-primary)] mb-1">
          System Overview
        </h1>
        <p className="text-[13px] text-[var(--color-text-secondary)]">
          Real-time insights and diagnostic health for your machine.
        </p>
      </div>

      <div className="relative z-10 flex gap-4 md:gap-6 bg-[var(--color-surface-950)]/50 p-4 rounded-2xl border border-[var(--color-surface-800)] backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center border border-blue-500/20">
            <Laptop className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <div className="text-[11px] text-[var(--color-text-muted)] font-medium uppercase tracking-wider mb-0.5">Device</div>
            <div className="text-[13px] font-semibold text-[var(--color-text-primary)]">{sysInfo?.hostname || "Loading..."}</div>
          </div>
        </div>
        
        <div className="w-px h-10 bg-[var(--color-surface-700)] self-center" />
        
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center border border-purple-500/20">
            <Server className="w-5 h-5 text-purple-400" />
          </div>
          <div>
            <div className="text-[11px] text-[var(--color-text-muted)] font-medium uppercase tracking-wider mb-0.5">OS</div>
            <div className="text-[13px] font-semibold text-[var(--color-text-primary)]">{sysInfo?.os_version || "Loading..."}</div>
          </div>
        </div>

        <div className="w-px h-10 bg-[var(--color-surface-700)] self-center" />

        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
            <Activity className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <div className="text-[11px] text-[var(--color-text-muted)] font-medium uppercase tracking-wider mb-0.5">Uptime</div>
            <div className="text-[13px] font-semibold text-[var(--color-text-primary)]">{sysInfo ? formatUptime(sysInfo.uptime_seconds) : "Loading..."}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

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
      <div className="glass-card p-6 h-full border border-[var(--color-surface-700)] rounded-3xl flex items-center justify-center">
        <span className="text-[13px] font-medium text-[var(--color-text-muted)] animate-pulse flex items-center gap-2">
          <Activity className="w-4 h-4" /> Analyzing trends...
        </span>
      </div>
    );
  }

  if (predictions.length === 0) {
    return (
      <div className="glass-card p-6 rounded-3xl flex flex-col items-center justify-center gap-3 animate-fade-in stagger-3 h-full text-center border border-[var(--color-surface-700)] bg-[var(--color-surface-900)]/40 hover:bg-[var(--color-surface-900)]/60 transition-colors">
        <div className="w-12 h-12 rounded-full bg-indigo-500/10 flex items-center justify-center mb-1">
          <CheckCircle2 className="w-6 h-6 text-indigo-400 opacity-80" />
        </div>
        <div>
          <p className="text-[14px] font-semibold text-[var(--color-text-primary)]">Predictive Analytics</p>
          <p className="text-[12px] text-[var(--color-text-muted)] mt-1">No future failures predicted</p>
        </div>
      </div>
    );
  }

  const topPrediction = predictions[0];

  return (
    <div className="glass-card p-6 rounded-3xl flex flex-col gap-4 animate-fade-in stagger-3 h-full border border-[hsl(260_85%_65%_/_0.3)] bg-gradient-to-br from-[hsl(260_85%_65%_/_0.05)] to-transparent relative overflow-hidden group">
      <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none group-hover:bg-indigo-500/20 transition-colors" />

      <div className="flex items-center justify-between relative z-10">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-indigo-500/20">
            <TrendingDown className="w-4 h-4 text-indigo-400" />
          </div>
          <span className="text-[12px] font-bold uppercase tracking-widest text-indigo-400">
            Predictions
          </span>
        </div>
        <span className="text-[12px] font-medium px-2.5 py-1 rounded-full bg-[var(--color-surface-800)] text-[var(--color-text-secondary)]">
          {predictions.length} Active
        </span>
      </div>

      <div className="mt-1 border-l-2 border-indigo-500/50 pl-4 relative z-10">
        <p className="text-[14px] font-medium text-[var(--color-text-primary)] leading-relaxed mb-2.5">
          {topPrediction.reason}
        </p>
        <div className="flex items-center gap-5">
          <div className="flex items-center gap-2 bg-[var(--color-surface-900)] px-2.5 py-1 rounded-lg border border-[var(--color-surface-700)]">
            <span className="text-[11px] text-[var(--color-text-muted)] uppercase tracking-wider font-medium">Confidence:</span>
            <span className="text-[12px] font-bold text-indigo-400">{(topPrediction.failure_probability * 100).toFixed(0)}%</span>
          </div>
          {topPrediction.predicted_time_to_failure_hours && (
            <div className="flex items-center gap-1.5 text-[12px] text-[var(--color-text-secondary)] font-medium">
              <Clock className="w-4 h-4 text-indigo-400/70" />
              <span>{Math.round(topPrediction.predicted_time_to_failure_hours)}h left</span>
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
      <div className="glass-card p-6 rounded-3xl flex flex-col items-center justify-center gap-3 animate-fade-in stagger-2 h-full text-center border border-[var(--color-surface-700)] bg-[var(--color-surface-900)]/40 hover:bg-[var(--color-surface-900)]/60 transition-colors">
        <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center mb-1">
          <CheckCircle2 className="w-6 h-6 text-emerald-400 opacity-90" />
        </div>
        <div>
          <p className="text-[14px] font-semibold text-[var(--color-text-primary)]">System Secure</p>
          <p className="text-[12px] text-[var(--color-text-muted)] mt-1">No active incidents detected</p>
        </div>
      </div>
    );
  }

  return (
    <Link
      href="/incidents"
      className="glass-card p-6 rounded-3xl flex flex-col gap-4 animate-fade-in stagger-2 h-full border border-[hsl(0_85%_55%_/_0.3)] bg-gradient-to-br from-[hsl(0_85%_55%_/_0.05)] to-transparent hover:border-[hsl(0_85%_55%_/_0.5)] transition-all duration-300 group relative overflow-hidden cursor-pointer no-underline"
    >
      {/* Subtle red glow */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-[hsl(0_85%_55%_/_0.1)] rounded-full blur-2xl pointer-events-none group-hover:bg-[hsl(0_85%_55%_/_0.15)] transition-colors" />

      <div className="flex items-center justify-between relative z-10">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-[hsl(0_85%_55%_/_0.2)]">
            <ShieldAlert className="w-4 h-4 text-[var(--color-severity-critical)]" />
          </div>
          <span className="text-[12px] font-bold uppercase tracking-widest text-[var(--color-severity-critical)]">
            Active Incidents
          </span>
        </div>
        <span className="text-[12px] font-medium text-[var(--color-text-muted)] group-hover:text-[var(--color-text-primary)] transition-colors flex items-center gap-1">
          View All <span className="text-[14px] leading-none">→</span>
        </span>
      </div>

      {/* Counts */}
      <div className="flex gap-3 relative z-10 mt-1">
        {criticalCount > 0 && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[hsl(0_85%_55%_/_0.15)] border border-[hsl(0_85%_55%_/_0.25)]">
            <AlertTriangle className="w-3.5 h-3.5 text-[var(--color-severity-critical)]" />
            <span className="text-[12px] font-bold text-[var(--color-severity-critical)]">{criticalCount} Critical</span>
          </div>
        )}
        {highCount > 0 && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[hsl(25_95%_55%_/_0.15)] border border-[hsl(25_95%_55%_/_0.25)]">
            <AlertTriangle className="w-3.5 h-3.5 text-[var(--color-severity-high)]" />
            <span className="text-[12px] font-bold text-[var(--color-severity-high)]">{highCount} High</span>
          </div>
        )}
        <span className="text-[12px] font-medium text-[var(--color-text-muted)] self-center ml-1">
          {openIncidents.length} total
        </span>
      </div>

      {/* Top incident preview */}
      {topIncident && (
        <div className="mt-2 border-l-2 border-[var(--color-severity-critical)]/50 pl-4 relative z-10">
          <p className="text-[11px] text-[var(--color-severity-critical)] mb-1 uppercase tracking-widest font-bold">
            Most Recent
          </p>
          <p className="text-[13px] font-medium text-[var(--color-text-primary)] line-clamp-2 leading-relaxed">
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
    <div className="p-4 md:p-8 flex flex-col gap-6 min-h-full bg-[var(--color-surface-950)]">
      
      <WelcomeBanner />

      <div className="grid grid-cols-1 xl:grid-cols-[340px_1fr] gap-6">
        
        {/* Main Health Score */}
        <div className="glass-card rounded-3xl p-8 flex flex-col items-center justify-center animate-fade-in gap-6 relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-b from-emerald-500/5 to-transparent pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
          <h2 className="text-[13px] font-bold tracking-widest uppercase text-[var(--color-text-secondary)] z-10">
            System Health
          </h2>
          <div className="relative z-10 hover:scale-105 transition-transform duration-500">
            <HealthScoreRing 
              score={latestScore?.overall_score ?? 0} 
              size={220} 
            />
          </div>
        </div>

        {/* Top Strip */}
        <div className="flex flex-col gap-6">
          <div className="glass-card rounded-3xl p-6 border border-[var(--color-surface-700)] bg-[var(--color-surface-900)]/40">
             <MetricsStrip />
          </div>
          
          {/* Active Incidents and Predictions */}
          <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-6">
            <ActiveIncidentsSummary />
            <ActivePredictionsPanel />
          </div>
        </div>
      </div>

      {/* Bottom Half */}
      <div className="flex-1 min-h-0 glass-card rounded-3xl border border-[var(--color-surface-700)] overflow-hidden">
        <RecentEvents />
      </div>
    </div>
  );
}

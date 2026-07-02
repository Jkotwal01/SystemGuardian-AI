"use client";

import { useEffect, useState } from "react";
import { HardDrive, Database, ArrowUp, ArrowDown, AlertTriangle, CheckCircle2, Zap } from "lucide-react";
import { api } from "@/lib/api-client";
import { DiskMetricRead } from "@/lib/types";
import { useEventStore } from "@/stores/event-store";
import { EventDetailModal } from "@/components/events/EventDetailModal";
import { format } from "date-fns";

function formatBytes(bytes: number, decimals = 1): string {
  if (bytes >= 1_073_741_824) return `${(bytes / 1_073_741_824).toFixed(decimals)} GB`;
  if (bytes >= 1_048_576) return `${(bytes / 1_048_576).toFixed(decimals)} MB`;
  if (bytes >= 1_024) return `${(bytes / 1_024).toFixed(decimals)} KB`;
  return `${bytes.toFixed(0)} B`;
}

function formatBytesPerSec(bytes: number): string {
  if (bytes >= 1_048_576) return `${(bytes / 1_048_576).toFixed(1)} MB/s`;
  if (bytes >= 1_024) return `${(bytes / 1_024).toFixed(1)} KB/s`;
  return `${bytes.toFixed(0)} B/s`;
}

function UsageRing({ pct, size = 80 }: { pct: number; size?: number }) {
  const r = 30;
  const circ = 2 * Math.PI * r;
  const offset = circ - (pct / 100) * circ;
  const color =
    pct >= 90 ? "hsl(0 85% 55%)" : pct >= 75 ? "hsl(25 95% 55%)" : "hsl(175 80% 45%)";

  return (
    <svg width={size} height={size} viewBox="0 0 80 80" className="-rotate-90">
      <circle cx={40} cy={40} r={r} fill="none" stroke="hsl(222 20% 16%)" strokeWidth={7} />
      <circle
        cx={40}
        cy={40}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={7}
        strokeLinecap="round"
        strokeDasharray={circ}
        strokeDashoffset={offset}
        style={{ transition: "stroke-dashoffset 1s ease-out" }}
      />
    </svg>
  );
}

function DiskCard({ disk }: { disk: DiskMetricRead }) {
  const pct = disk.usage_percent;
  const isWarning = pct >= 75 && pct < 90;
  const isCritical = pct >= 90;

  let statusColor = "text-emerald-400";
  let statusLabel = "Healthy";
  let badgeBg = "bg-[hsl(142_71%_45%_/_0.1)] border-[hsl(142_71%_45%_/_0.2)]";
  if (isWarning) {
    statusColor = "text-[var(--color-severity-high)]";
    statusLabel = "Near Full";
    badgeBg = "bg-[hsl(25_95%_55%_/_0.1)] border-[hsl(25_95%_55%_/_0.2)]";
  }
  if (isCritical) {
    statusColor = "text-[var(--color-severity-critical)]";
    statusLabel = "Critical";
    badgeBg = "bg-[hsl(0_85%_55%_/_0.1)] border-[hsl(0_85%_55%_/_0.2)]";
  }

  return (
    <div className="glass-card p-5 rounded-lg border border-[var(--color-surface-700)] bg-[var(--color-surface-900)] flex flex-col gap-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-[var(--color-surface-800)] border border-[var(--color-surface-700)] rounded-lg text-[var(--color-text-secondary)] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
            <HardDrive className="w-4 h-4" />
          </div>
          <div>
            <p className="text-[13px] font-medium text-[var(--color-text-primary)]">
              {disk.device}
            </p>
            <p className="text-[11px] text-[var(--color-text-muted)] font-mono">
              {disk.mountpoint}
            </p>
          </div>
        </div>
        <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full border ${badgeBg} ${statusColor}`}>
          {statusLabel}
        </span>
      </div>

      {/* Ring + stats */}
      <div className="flex items-center gap-5">
        <div className="relative flex-shrink-0">
          <UsageRing pct={pct} />
          <div className="absolute inset-0 flex items-center justify-center rotate-90">
            <span className={`text-[14px] font-bold font-mono ${statusColor}`}>
              {pct.toFixed(0)}%
            </span>
          </div>
        </div>
        <div className="flex flex-col gap-2 flex-1">
          <div className="flex justify-between text-[11px]">
            <span className="text-[var(--color-text-muted)]">Used</span>
            <span className="text-[var(--color-text-primary)] font-mono">{formatBytes(disk.used_bytes)}</span>
          </div>
          <div className="flex justify-between text-[11px]">
            <span className="text-[var(--color-text-muted)]">Free</span>
            <span className="text-emerald-400 font-mono">{formatBytes(disk.free_bytes)}</span>
          </div>
          <div className="flex justify-between text-[11px]">
            <span className="text-[var(--color-text-muted)]">Total</span>
            <span className="text-[var(--color-text-secondary)] font-mono">{formatBytes(disk.total_bytes)}</span>
          </div>
        </div>
      </div>

      {/* I/O throughput */}
      <div className="flex gap-3 border-t border-[var(--color-surface-700)] pt-3">
        <div className="flex items-center gap-1.5 text-[11px] text-[var(--color-text-muted)]">
          <ArrowDown className="w-3.5 h-3.5 text-[var(--color-brand-400)]" />
          <span className="font-mono font-medium text-[var(--color-text-primary)]">
            {formatBytesPerSec(disk.read_bytes_per_sec)}
          </span>
          <span className="opacity-60">read</span>
        </div>
        <div className="w-px bg-[var(--color-surface-700)]" />
        <div className="flex items-center gap-1.5 text-[11px] text-[var(--color-text-muted)]">
          <ArrowUp className="w-3.5 h-3.5 text-purple-400" />
          <span className="font-mono font-medium text-[var(--color-text-primary)]">
            {formatBytesPerSec(disk.write_bytes_per_sec)}
          </span>
          <span className="opacity-60">write</span>
        </div>
      </div>
    </div>
  );
}

export default function StoragePage() {
  const [disks, setDisks] = useState<DiskMetricRead[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const { recentEvents } = useEventStore();

  const storageEvents = recentEvents.filter(
    (e) => e.category === "storage" || e.category === "hardware"
  );

  // Aggregate summary
  const totalSpace = disks.reduce((s, d) => s + d.total_bytes, 0);
  const usedSpace = disks.reduce((s, d) => s + d.used_bytes, 0);
  const criticalDisks = disks.filter((d) => d.usage_percent >= 90).length;

  useEffect(() => {
    async function fetchMetrics() {
      try {
        const data = await api.metrics.getLive();
        setDisks(data.disks);
      } catch {
        // Backend may be offline
      } finally {
        setLoading(false);
      }
    }

    fetchMetrics();
    const interval = setInterval(fetchMetrics, 15_000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex flex-col h-full gap-4 md:gap-6 p-4 md:p-6 animate-fade-in overflow-y-auto bg-[var(--color-surface-950)]">
      {/* Header */}
      <div className="flex items-center gap-4 mb-1 pl-1">
        <div className="p-2.5 bg-[var(--color-surface-900)] rounded-lg text-[var(--color-text-secondary)] border border-[var(--color-surface-700)] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
          <HardDrive className="w-5 h-5 md:w-6 md:h-6 opacity-80" />
        </div>
        <div>
          <h2 className="text-lg md:text-xl font-medium tracking-tight text-[var(--color-text-primary)]">
            Storage Manager
          </h2>
          <p className="text-[12px] md:text-[13px] text-[var(--color-text-secondary)] mt-0.5">
            Disk usage, I/O throughput, and storage health
          </p>
        </div>

        {/* Summary stats */}
        <div className="ml-auto hidden sm:flex items-center gap-4">
          {criticalDisks > 0 && (
            <div className="flex items-center gap-1.5 text-[11px] font-medium text-[var(--color-severity-critical)]">
              <AlertTriangle className="w-3.5 h-3.5" />
              {criticalDisks} disk{criticalDisks > 1 ? "s" : ""} critical
            </div>
          )}
          {criticalDisks === 0 && disks.length > 0 && (
            <div className="flex items-center gap-1.5 text-[11px] font-medium text-emerald-400">
              <CheckCircle2 className="w-3.5 h-3.5" />
              All disks healthy
            </div>
          )}
          {totalSpace > 0 && (
            <>
              <div className="w-px h-6 bg-[var(--color-surface-700)]" />
              <div className="text-center">
                <p className="text-[10px] uppercase tracking-widest text-[var(--color-text-muted)]">Total Space</p>
                <p className="text-[13px] font-mono font-medium text-[var(--color-text-primary)]">{formatBytes(totalSpace)}</p>
              </div>
              <div className="w-px h-6 bg-[var(--color-surface-700)]" />
              <div className="text-center">
                <p className="text-[10px] uppercase tracking-widest text-[var(--color-text-muted)]">Used</p>
                <p className="text-[13px] font-mono font-medium text-[var(--color-text-primary)]">{formatBytes(usedSpace)}</p>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Disk Cards */}
      <div className="flex flex-col gap-3">
        <h3 className="text-[11px] font-medium tracking-widest uppercase text-[var(--color-text-secondary)] pl-1">
          Mounted Volumes
        </h3>
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {[0, 1, 2].map((i) => (
              <div key={i} className="glass-card p-5 rounded-lg border border-[var(--color-surface-700)] bg-[var(--color-surface-900)] h-52 animate-pulse" />
            ))}
          </div>
        ) : disks.length === 0 ? (
          <div className="glass-card p-12 rounded-lg border border-[var(--color-surface-700)] bg-[var(--color-surface-900)] flex flex-col items-center justify-center gap-3 text-[var(--color-text-muted)]">
            <div className="w-12 h-12 rounded-full bg-[var(--color-surface-800)] flex items-center justify-center border border-[var(--color-surface-700)]">
              <Database className="w-5 h-5 opacity-40" />
            </div>
            <p className="text-[13px] font-medium">No disk metrics available yet</p>
            <p className="text-[11px] opacity-60 text-center max-w-xs">
              The storage collector is initializing. Data will appear after the first collection cycle.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {disks.map((d) => (
              <DiskCard key={d.id} disk={d} />
            ))}
          </div>
        )}
      </div>

      {/* Storage Event Stream */}
      <div className="flex-1 flex flex-col gap-3 min-h-[200px]">
        <div className="flex items-center justify-between pl-1 pr-2">
          <h3 className="text-[11px] font-medium tracking-widest uppercase text-[var(--color-text-secondary)] flex items-center gap-2">
            <Zap className="w-3.5 h-3.5 text-[var(--color-text-secondary)] opacity-70" />
            Storage Event Log
          </h3>
          <span className="text-[10px] px-2 py-0.5 rounded border border-[var(--color-surface-700)] bg-[var(--color-surface-800)] text-[var(--color-text-muted)] font-medium tracking-widest uppercase">
            Last 24h
          </span>
        </div>

        <div className="flex-1 glass-card rounded-lg border border-[var(--color-surface-700)] overflow-hidden flex flex-col bg-[var(--color-surface-900)]">
          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-2">
            {storageEvents.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-3 text-[var(--color-text-muted)]">
                <div className="w-10 h-10 rounded-full bg-[var(--color-surface-800)] flex items-center justify-center border border-[var(--color-surface-700)]">
                  <HardDrive className="w-4 h-4 opacity-50" />
                </div>
                <p className="text-[13px] font-medium">No storage events in the last 24 hours.</p>
                <p className="text-[11px] opacity-60">Storage is operating normally.</p>
              </div>
            ) : (
              storageEvents.map((event, i) => {
                const hasAI = !!event.ai_insight;
                const isHigh = event.severity === "high" || event.severity === "critical";

                return (
                  <button
                    key={event.id}
                    onClick={() => setSelectedEventId(event.id)}
                    className="w-full text-left p-4 rounded-md border border-[var(--color-surface-700)] bg-[var(--color-surface-800)]/40 hover:bg-[var(--color-surface-800)] hover:border-[var(--color-surface-500)] transition-all duration-200 flex flex-col gap-2 group"
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
                        <span className="text-[10px] font-medium uppercase tracking-widest text-[var(--color-text-muted)]">
                          {event.source}
                        </span>
                        {isHigh && (
                          <Zap className={`w-3.5 h-3.5 ${hasAI ? "text-indigo-400" : "text-indigo-400/30"} transition-colors`} />
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

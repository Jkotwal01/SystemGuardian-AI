"use client";

import { useEffect, useState } from "react";
import { Network, ArrowUpRight, ArrowDownLeft, Wifi, AlertCircle, Zap } from "lucide-react";
import { api } from "@/lib/api-client";
import { NetworkMetricRead, EventRead } from "@/lib/types";
import { useEventStore } from "@/stores/event-store";
import { EventDetailModal } from "@/components/events/EventDetailModal";
import { format } from "date-fns";

function formatBytes(bytes: number): string {
  if (bytes >= 1_048_576) return `${(bytes / 1_048_576).toFixed(1)} MB/s`;
  if (bytes >= 1_024) return `${(bytes / 1_024).toFixed(1)} KB/s`;
  return `${bytes.toFixed(0)} B/s`;
}

function ThroughputBar({
  label,
  icon: Icon,
  iconClass,
  value,
  maxValue,
  colorClass,
}: {
  label: string;
  icon: React.ElementType;
  iconClass: string;
  value: number;
  maxValue: number;
  colorClass: string;
}) {
  const pct = maxValue > 0 ? Math.min((value / maxValue) * 100, 100) : 0;
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex justify-between items-center">
        <span className={`flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-widest text-[var(--color-text-muted)]`}>
          <Icon className={`w-3.5 h-3.5 ${iconClass}`} />
          {label}
        </span>
        <span className="text-[13px] font-mono font-medium text-[var(--color-text-primary)]">
          {formatBytes(value)}
        </span>
      </div>
      <div className="h-1.5 w-full bg-[var(--color-surface-800)] rounded-full overflow-hidden shadow-[inset_0_1px_2px_rgba(0,0,0,0.4)]">
        <div
          className={`h-full rounded-full ${colorClass} transition-all duration-700 ease-out`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function InterfaceCard({ metric }: { metric: NetworkMetricRead }) {
  const hasErrors = metric.errors_in > 0 || metric.errors_out > 0;
  const totalBytes = metric.bytes_sent_per_sec + metric.bytes_recv_per_sec;
  const maxBytes = Math.max(totalBytes * 1.2, 1024); // dynamic scale

  return (
    <div className="glass-card p-5 rounded-lg border border-[var(--color-surface-700)] bg-[var(--color-surface-900)] flex flex-col gap-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
      {/* Interface header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-[var(--color-surface-800)] border border-[var(--color-surface-700)] rounded-lg text-[var(--color-brand-400)] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
            <Wifi className="w-4 h-4" />
          </div>
          <div>
            <p className="text-[13px] font-medium text-[var(--color-text-primary)]">
              {metric.interface}
            </p>
            <p className="text-[11px] text-[var(--color-text-muted)]">
              {metric.packets_sent_per_sec.toFixed(0)} pkt/s ↑ &nbsp;
              {metric.packets_recv_per_sec.toFixed(0)} pkt/s ↓
            </p>
          </div>
        </div>
        {hasErrors && (
          <span className="flex items-center gap-1 text-[11px] font-medium text-[var(--color-severity-high)] bg-[hsl(25_95%_55%_/_0.1)] border border-[hsl(25_95%_55%_/_0.2)] px-2 py-0.5 rounded-full">
            <AlertCircle className="w-3 h-3" />
            Errors
          </span>
        )}
      </div>

      {/* Throughput bars */}
      <div className="flex flex-col gap-3">
        <ThroughputBar
          label="Upload"
          icon={ArrowUpRight}
          iconClass="text-[var(--color-brand-400)]"
          value={metric.bytes_sent_per_sec}
          maxValue={maxBytes}
          colorClass="bg-[var(--color-brand-500)]"
        />
        <ThroughputBar
          label="Download"
          icon={ArrowDownLeft}
          iconClass="text-emerald-400"
          value={metric.bytes_recv_per_sec}
          maxValue={maxBytes}
          colorClass="bg-emerald-500"
        />
      </div>

      {/* Error row */}
      {hasErrors && (
        <div className="flex gap-4 text-[11px] text-[var(--color-text-muted)] border-t border-[var(--color-surface-700)] pt-3">
          <span>Errors In: <span className="text-[var(--color-severity-high)] font-mono">{metric.errors_in}</span></span>
          <span>Errors Out: <span className="text-[var(--color-severity-high)] font-mono">{metric.errors_out}</span></span>
        </div>
      )}
    </div>
  );
}

export default function NetworkPage() {
  const [metrics, setMetrics] = useState<NetworkMetricRead[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const { recentEvents } = useEventStore();

  const networkEvents = recentEvents.filter(
    (e) => e.category === "network" || e.category === "application"
  );

  useEffect(() => {
    async function fetchMetrics() {
      try {
        const data = await api.metrics.getLive();
        setMetrics(data.networks);
      } catch {
        // Backend may be offline
      } finally {
        setLoading(false);
      }
    }

    fetchMetrics();
    const interval = setInterval(fetchMetrics, 10_000); // refresh every 10s
    return () => clearInterval(interval);
  }, []);

  const totalSent = metrics.reduce((s, m) => s + m.bytes_sent_per_sec, 0);
  const totalRecv = metrics.reduce((s, m) => s + m.bytes_recv_per_sec, 0);
  const totalErrors = metrics.reduce((s, m) => s + m.errors_in + m.errors_out, 0);

  return (
    <div className="flex flex-col h-full gap-4 md:gap-6 p-4 md:p-6 animate-fade-in overflow-y-auto bg-[var(--color-surface-950)]">
      {/* Header */}
      <div className="flex items-center gap-4 mb-1 pl-1">
        <div className="p-2.5 bg-[var(--color-surface-900)] rounded-lg text-[var(--color-brand-400)] border border-[var(--color-surface-700)] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
          <Network className="w-5 h-5 md:w-6 md:h-6 opacity-80" />
        </div>
        <div>
          <h2 className="text-lg md:text-xl font-medium tracking-tight text-[var(--color-text-primary)]">
            Network Monitor
          </h2>
          <p className="text-[12px] md:text-[13px] text-[var(--color-text-secondary)] mt-0.5">
            Live interface throughput and packet analysis
          </p>
        </div>

        {/* Summary stats */}
        <div className="ml-auto flex items-center gap-3 flex-wrap justify-end">
          <div className="text-center hidden sm:block">
            <p className="text-[10px] font-medium uppercase tracking-widest text-[var(--color-text-muted)]">Total ↑</p>
            <p className="text-[13px] font-mono font-medium text-[var(--color-brand-400)]">{formatBytes(totalSent)}</p>
          </div>
          <div className="w-px h-8 bg-[var(--color-surface-700)] hidden sm:block" />
          <div className="text-center hidden sm:block">
            <p className="text-[10px] font-medium uppercase tracking-widest text-[var(--color-text-muted)]">Total ↓</p>
            <p className="text-[13px] font-mono font-medium text-emerald-400">{formatBytes(totalRecv)}</p>
          </div>
          {totalErrors > 0 && (
            <>
              <div className="w-px h-8 bg-[var(--color-surface-700)] hidden sm:block" />
              <div className="text-center hidden sm:block">
                <p className="text-[10px] font-medium uppercase tracking-widest text-[var(--color-text-muted)]">Errors</p>
                <p className="text-[13px] font-mono font-medium text-[var(--color-severity-high)]">{totalErrors}</p>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Interface Cards */}
      <div className="flex flex-col gap-3">
        <h3 className="text-[11px] font-medium tracking-widest uppercase text-[var(--color-text-secondary)] pl-1">
          Active Interfaces
        </h3>
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {[0, 1, 2].map((i) => (
              <div key={i} className="glass-card p-5 rounded-lg border border-[var(--color-surface-700)] bg-[var(--color-surface-900)] h-40 animate-pulse" />
            ))}
          </div>
        ) : metrics.length === 0 ? (
          <div className="glass-card p-12 rounded-lg border border-[var(--color-surface-700)] bg-[var(--color-surface-900)] flex flex-col items-center justify-center gap-3 text-[var(--color-text-muted)]">
            <div className="w-12 h-12 rounded-full bg-[var(--color-surface-800)] flex items-center justify-center border border-[var(--color-surface-700)]">
              <Network className="w-5 h-5 opacity-40" />
            </div>
            <p className="text-[13px] font-medium">No network interfaces detected</p>
            <p className="text-[11px] opacity-60 text-center max-w-xs">
              The network collector may still be initializing. Data will appear once the backend has completed a collection cycle.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {metrics.map((m) => (
              <InterfaceCard key={m.id} metric={m} />
            ))}
          </div>
        )}
      </div>

      {/* Network Event Stream */}
      <div className="flex-1 flex flex-col gap-3 min-h-[200px]">
        <div className="flex items-center justify-between pl-1 pr-2">
          <h3 className="text-[11px] font-medium tracking-widest uppercase text-[var(--color-text-secondary)] flex items-center gap-2">
            <Zap className="w-3.5 h-3.5 text-[var(--color-brand-400)] opacity-80" />
            Network Event Stream
          </h3>
          <span className="text-[10px] px-2 py-0.5 rounded border border-[var(--color-surface-700)] bg-[var(--color-surface-800)] text-[var(--color-text-muted)] font-medium tracking-widest uppercase shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
            Last 24h
          </span>
        </div>

        <div className="flex-1 glass-card rounded-lg border border-[var(--color-surface-700)] overflow-hidden flex flex-col bg-[var(--color-surface-900)]">
          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-2">
            {networkEvents.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-3 text-[var(--color-text-muted)]">
                <div className="w-10 h-10 rounded-full bg-[var(--color-surface-800)] flex items-center justify-center border border-[var(--color-surface-700)]">
                  <Network className="w-4 h-4 opacity-50" />
                </div>
                <p className="text-[13px] font-medium">No network events in the last 24 hours.</p>
                <p className="text-[11px] opacity-60">Network is running clean.</p>
              </div>
            ) : (
              networkEvents.map((event, i) => {
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

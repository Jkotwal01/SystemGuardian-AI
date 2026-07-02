"use client";

import { useEffect, useState, useRef } from "react";
import {
  Network, ArrowUp, ArrowDown, Wifi, AlertCircle, Zap, Activity
} from "lucide-react";
import { api } from "@/lib/api-client";
import { NetworkMetricRead } from "@/lib/types";
import { useEventStore } from "@/stores/event-store";
import { EventDetailModal } from "@/components/events/EventDetailModal";
import { format } from "date-fns";

// ── Formatters ────────────────────────────────────────────────────────────────

function formatSpeed(bytes: number): { value: string; unit: string } {
  if (bytes >= 1_048_576) return { value: (bytes / 1_048_576).toFixed(2), unit: "MB/s" };
  if (bytes >= 1_024) return { value: (bytes / 1_024).toFixed(1), unit: "KB/s" };
  return { value: bytes.toFixed(0), unit: "B/s" };
}

function formatBytes(bytes: number): string {
  if (bytes >= 1_048_576) return `${(bytes / 1_048_576).toFixed(1)} MB/s`;
  if (bytes >= 1_024) return `${(bytes / 1_024).toFixed(1)} KB/s`;
  return `${bytes.toFixed(0)} B/s`;
}

// ── Live Speed Card ───────────────────────────────────────────────────────────

function LiveSpeedCard({
  direction,
  bytesPerSec,
  prevBytesPerSec,
  color,
}: {
  direction: "upload" | "download";
  bytesPerSec: number;
  prevBytesPerSec: number;
  color: string;
}) {
  const { value, unit } = formatSpeed(bytesPerSec);
  const isUp = direction === "upload";
  const trend = bytesPerSec > prevBytesPerSec + 100;
  const trendDown = bytesPerSec < prevBytesPerSec - 100;
  const isActive = bytesPerSec > 512; // > 512 B/s considered active

  return (
    <div
      className="flex-1 relative flex flex-col items-center justify-center gap-3 p-6 rounded-2xl border overflow-hidden"
      style={{
        background: isActive
          ? `linear-gradient(145deg, ${color}08 0%, ${color}03 100%)`
          : "var(--color-surface-900)",
        borderColor: isActive ? `${color}30` : "var(--color-surface-700)",
        boxShadow: isActive ? `0 0 40px ${color}08, inset 0 1px 0 ${color}15` : "none",
      }}
    >
      {/* Animated background pulse when active */}
      {isActive && (
        <div
          className="absolute inset-0 rounded-2xl opacity-20 animate-pulse"
          style={{
            background: `radial-gradient(ellipse at center, ${color}15 0%, transparent 70%)`,
          }}
        />
      )}

      {/* Direction icon with animated arrow */}
      <div
        className="relative flex flex-col items-center gap-1"
        style={{ color }}
      >
        <div
          className={`p-3 rounded-xl border ${isActive ? "animate-bounce" : ""}`}
          style={{
            background: `${color}12`,
            borderColor: `${color}25`,
            animationDuration: "1.2s",
          }}
        >
          {isUp ? (
            <ArrowUp className="w-6 h-6 md:w-8 md:h-8" strokeWidth={2.5} />
          ) : (
            <ArrowDown className="w-6 h-6 md:w-8 md:h-8" strokeWidth={2.5} />
          )}
        </div>
      </div>

      {/* Speed value */}
      <div className="text-center relative z-10">
        <div
          className="text-4xl md:text-5xl font-bold font-mono tracking-tight leading-none transition-all duration-300"
          style={{ color }}
        >
          {value}
        </div>
        <div
          className="text-[13px] md:text-[15px] font-semibold mt-1 font-mono tracking-wide"
          style={{ color: `${color}99` }}
        >
          {unit}
        </div>
      </div>

      {/* Label + trend */}
      <div className="flex flex-col items-center gap-1 relative z-10">
        <span className="text-[11px] font-bold uppercase tracking-widest text-[var(--color-text-muted)]">
          {isUp ? "Upload" : "Download"}
        </span>
        {trend && (
          <span
            className="text-[10px] font-medium px-2 py-0.5 rounded-full"
            style={{ background: `${color}15`, color }}
          >
            ▲ Increasing
          </span>
        )}
        {trendDown && (
          <span className="text-[10px] font-medium text-[var(--color-text-muted)] px-2 py-0.5 rounded-full bg-[var(--color-surface-800)]">
            ▼ Decreasing
          </span>
        )}
        {!trend && !trendDown && (
          <span className="text-[10px] text-[var(--color-text-muted)]">
            {isActive ? "Stable" : "Idle"}
          </span>
        )}
      </div>

      {/* Live dot */}
      {isActive && (
        <div className="absolute top-3 right-3 flex items-center gap-1.5">
          <div
            className="w-1.5 h-1.5 rounded-full animate-ping absolute"
            style={{ background: color }}
          />
          <div
            className="w-1.5 h-1.5 rounded-full relative"
            style={{ background: color }}
          />
        </div>
      )}
    </div>
  );
}

// ── Mini sparkline bar ────────────────────────────────────────────────────────

function SpeedSparkline({
  history,
  color,
}: {
  history: number[];
  color: string;
}) {
  const max = Math.max(...history, 1024);
  return (
    <div className="flex items-end gap-px h-8 w-full">
      {history.map((v, i) => {
        const pct = Math.max((v / max) * 100, 2);
        return (
          <div
            key={i}
            className="flex-1 rounded-sm transition-all duration-300"
            style={{
              height: `${pct}%`,
              background: i === history.length - 1 ? color : `${color}50`,
              minWidth: "2px",
            }}
          />
        );
      })}
    </div>
  );
}

// ── Interface Card ────────────────────────────────────────────────────────────

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
        <span className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-widest text-[var(--color-text-muted)]">
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
  const maxBytes = Math.max(totalBytes * 1.2, 1024);

  return (
    <div className="glass-card p-5 rounded-lg border border-[var(--color-surface-700)] bg-[var(--color-surface-900)] flex flex-col gap-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
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

      <div className="flex flex-col gap-3">
        <ThroughputBar
          label="Upload"
          icon={ArrowUp}
          iconClass="text-[var(--color-brand-400)]"
          value={metric.bytes_sent_per_sec}
          maxValue={maxBytes}
          colorClass="bg-[var(--color-brand-500)]"
        />
        <ThroughputBar
          label="Download"
          icon={ArrowDown}
          iconClass="text-emerald-400"
          value={metric.bytes_recv_per_sec}
          maxValue={maxBytes}
          colorClass="bg-emerald-500"
        />
      </div>

      {hasErrors && (
        <div className="flex gap-4 text-[11px] text-[var(--color-text-muted)] border-t border-[var(--color-surface-700)] pt-3">
          <span>Errors In: <span className="text-[var(--color-severity-high)] font-mono">{metric.errors_in}</span></span>
          <span>Errors Out: <span className="text-[var(--color-severity-high)] font-mono">{metric.errors_out}</span></span>
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

const HISTORY_MAX = 30; // 30 ticks × 2s = 60s rolling window

export default function NetworkPage() {
  const [metrics, setMetrics] = useState<NetworkMetricRead[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);

  // Rolling history for sparklines
  const [uploadHistory, setUploadHistory] = useState<number[]>(Array(HISTORY_MAX).fill(0));
  const [downloadHistory, setDownloadHistory] = useState<number[]>(Array(HISTORY_MAX).fill(0));

  // Previous tick for trend arrows
  const prevUpload = useRef(0);
  const prevDownload = useRef(0);

  const { recentEvents } = useEventStore();
  const networkEvents = recentEvents.filter(
    (e) => e.category === "network" || e.category === "application"
  );

  useEffect(() => {
    let mounted = true;

    async function fetchMetrics() {
      try {
        const data = await api.metrics.getLive();
        if (!mounted) return;
        const nets = data.networks;
        setMetrics(nets);
        setLoading(false);

        // Aggregate total upload + download across all interfaces
        const totalUp = nets.reduce((s, m) => s + m.bytes_sent_per_sec, 0);
        const totalDown = nets.reduce((s, m) => s + m.bytes_recv_per_sec, 0);

        prevUpload.current = uploadHistory[uploadHistory.length - 1] ?? 0;
        prevDownload.current = downloadHistory[downloadHistory.length - 1] ?? 0;

        setUploadHistory((h) => [...h.slice(-(HISTORY_MAX - 1)), totalUp]);
        setDownloadHistory((h) => [...h.slice(-(HISTORY_MAX - 1)), totalDown]);
      } catch {
        if (mounted) setLoading(false);
      }
    }

    fetchMetrics();
    // Refresh every 2 seconds for live feel
    const interval = setInterval(fetchMetrics, 2_000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const totalSent = metrics.reduce((s, m) => s + m.bytes_sent_per_sec, 0);
  const totalRecv = metrics.reduce((s, m) => s + m.bytes_recv_per_sec, 0);
  const totalErrors = metrics.reduce((s, m) => s + m.errors_in + m.errors_out, 0);

  return (
    <div className="flex flex-col h-full gap-4 md:gap-6 p-4 md:p-6 animate-fade-in overflow-y-auto bg-[var(--color-surface-950)]">
      {/* Page Header */}
      <div className="flex items-center gap-4 pl-1">
        <div className="p-2.5 bg-[var(--color-surface-900)] rounded-lg text-[var(--color-brand-400)] border border-[var(--color-surface-700)] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
          <Network className="w-5 h-5 md:w-6 md:h-6 opacity-80" />
        </div>
        <div>
          <h2 className="text-lg md:text-xl font-medium tracking-tight text-[var(--color-text-primary)]">
            Network Monitor
          </h2>
          <p className="text-[12px] md:text-[13px] text-[var(--color-text-secondary)] mt-0.5">
            Live interface throughput · Updates every 2 seconds
          </p>
        </div>

        {/* Error badge */}
        {totalErrors > 0 && (
          <div className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[hsl(25_95%_55%_/_0.1)] border border-[hsl(25_95%_55%_/_0.2)] text-[var(--color-severity-high)] text-[12px] font-medium">
            <AlertCircle className="w-4 h-4" />
            {totalErrors} errors
          </div>
        )}
      </div>

      {/* ── LIVE SPEED WIDGET ─────────────────────────────────────────────── */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2 pl-1">
          <div className="w-1.5 h-1.5 rounded-full bg-[var(--color-brand-400)] animate-pulse" />
          <h3 className="text-[11px] font-bold uppercase tracking-widest text-[var(--color-text-secondary)]">
            Live Internet Speed
          </h3>
        </div>

        <div className="flex gap-4">
          {/* Upload Card */}
          <LiveSpeedCard
            direction="upload"
            bytesPerSec={totalSent}
            prevBytesPerSec={prevUpload.current}
            color="hsl(220 90% 65%)"
          />

          {/* Download Card */}
          <LiveSpeedCard
            direction="download"
            bytesPerSec={totalRecv}
            prevBytesPerSec={prevDownload.current}
            color="hsl(155 80% 50%)"
          />
        </div>

        {/* Sparklines */}
        <div className="grid grid-cols-2 gap-4">
          <div className="glass-card p-3 rounded-xl border border-[var(--color-surface-700)] bg-[var(--color-surface-900)]">
            <div className="flex justify-between items-center mb-2">
              <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-text-muted)] flex items-center gap-1.5">
                <ArrowUp className="w-3 h-3 text-[hsl(220_90%_65%)]" />
                Upload — 60s
              </span>
              <span className="text-[11px] font-mono text-[hsl(220_90%_65%)]">
                {formatBytes(totalSent)}
              </span>
            </div>
            <SpeedSparkline history={uploadHistory} color="hsl(220 90% 65%)" />
          </div>
          <div className="glass-card p-3 rounded-xl border border-[var(--color-surface-700)] bg-[var(--color-surface-900)]">
            <div className="flex justify-between items-center mb-2">
              <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-text-muted)] flex items-center gap-1.5">
                <ArrowDown className="w-3 h-3 text-emerald-400" />
                Download — 60s
              </span>
              <span className="text-[11px] font-mono text-emerald-400">
                {formatBytes(totalRecv)}
              </span>
            </div>
            <SpeedSparkline history={downloadHistory} color="hsl(155 80% 50%)" />
          </div>
        </div>
      </div>

      {/* ── INTERFACE CARDS ───────────────────────────────────────────────── */}
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
            <p className="text-[13px] font-medium">No network interfaces detected yet</p>
            <p className="text-[11px] opacity-60 text-center max-w-xs">
              The network collector is still initializing. Data will appear after the first collection cycle.
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

      {/* ── NETWORK EVENT STREAM ──────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col gap-3 min-h-[200px]">
        <div className="flex items-center justify-between pl-1 pr-2">
          <h3 className="text-[11px] font-medium tracking-widest uppercase text-[var(--color-text-secondary)] flex items-center gap-2">
            <Zap className="w-3.5 h-3.5 text-[var(--color-brand-400)] opacity-80" />
            Network Event Stream
          </h3>
          <span className="text-[10px] px-2 py-0.5 rounded border border-[var(--color-surface-700)] bg-[var(--color-surface-800)] text-[var(--color-text-muted)] font-medium tracking-widest uppercase">
            Last 24h
          </span>
        </div>

        <div className="flex-1 glass-card rounded-lg border border-[var(--color-surface-700)] overflow-hidden flex flex-col bg-[var(--color-surface-900)]">
          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-2">
            {networkEvents.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-3 text-[var(--color-text-muted)]">
                <div className="w-10 h-10 rounded-full bg-[var(--color-surface-800)] flex items-center justify-center border border-[var(--color-surface-700)]">
                  <Activity className="w-4 h-4 opacity-50" />
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

"use client";

import { AIInsightRead, Severity } from "@/lib/types";
import { Lightbulb, Info, Zap } from "lucide-react";

interface Props {
  insight: AIInsightRead | null;
  loading?: boolean;
}

export function AIInsightCard({ insight, loading = false }: Props) {
  if (!insight) {
    if (loading) {
      return (
        <div
          className="rounded-xl border p-6 space-y-6"
          style={{
            background: "linear-gradient(135deg, rgba(99, 102, 241, 0.06) 0%, rgba(99, 102, 241, 0.02) 100%)",
            borderColor: "rgba(99, 102, 241, 0.15)",
          }}
        >
          <div className="flex items-center justify-between border-b border-indigo-500/10 pb-4">
            <div className="flex items-center gap-2.5">
              <Zap className="w-5 h-5 text-indigo-400 animate-bounce" />
              <span className="text-xs font-bold uppercase tracking-wider text-indigo-400">
                AI Analysis Layer
              </span>
            </div>
            <span className="text-[10px] text-indigo-400/50 bg-indigo-500/10 px-2.5 py-0.5 rounded-full font-mono font-semibold uppercase tracking-wider animate-pulse">
              Generating
            </span>
          </div>

          <div className="space-y-4">
            {/* Summary skeleton */}
            <div className="h-5 rounded bg-indigo-500/10 animate-pulse w-3/4" />
            
            {/* Explanation skeleton */}
            <div className="space-y-2.5">
              <div className="h-3 rounded bg-[var(--color-surface-700)] animate-pulse w-full" />
              <div className="h-3 rounded bg-[var(--color-surface-700)] animate-pulse w-11/12" />
              <div className="h-3 rounded bg-[var(--color-surface-700)] animate-pulse w-4/5" />
            </div>
            
            {/* Recommendation skeleton */}
            <div className="h-16 rounded-xl bg-indigo-500/5 border border-indigo-500/10 animate-pulse" />
          </div>
          
          <p className="text-xs text-center text-indigo-400/50 font-medium tracking-wide">
            Synthesizing telemetry data & generating root cause analysis...
          </p>
        </div>
      );
    }

    return (
      <div
        className="rounded-xl border p-6 border-dashed border-[var(--color-surface-700)] bg-[var(--color-surface-950)]/20"
      >
        <div className="flex items-center gap-2.5 mb-4 opacity-50 border-b border-[var(--color-surface-700)]/60 pb-4">
          <Zap className="w-5 h-5 text-indigo-400/60" />
          <span className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)]">
            AI Analysis Layer
          </span>
        </div>
        <div className="flex flex-col items-center justify-center py-6 text-center">
          <Info className="w-8 h-8 text-[var(--color-text-muted)] opacity-30 mb-3" />
          <p className="text-sm font-medium text-[var(--color-text-secondary)]">
            Historical Data Insight
          </p>
          <p className="text-xs text-[var(--color-text-muted)] mt-2 max-w-[280px] leading-relaxed">
            No active AI analysis is available for this past event. Real-time insights are generated for new incidents.
          </p>
        </div>
      </div>
    );
  }

  const lines = insight.explanation.split("\n").filter(Boolean);

  return (
    <div
      className="rounded-xl border p-6 space-y-6"
      style={{
        background: "linear-gradient(135deg, rgba(99, 102, 241, 0.08) 0%, rgba(185, 227, 255, 0.02) 100%)",
        borderColor: "rgba(99, 102, 241, 0.18)",
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-indigo-500/10 pb-4">
        <div className="flex items-center gap-2.5">
          <Zap className="w-5 h-5 text-indigo-400 animate-pulse" />
          <span className="text-xs font-bold uppercase tracking-wider text-indigo-400">
            AI Analysis Layer
          </span>
        </div>
        <span className="text-[10px] text-indigo-400/50 bg-indigo-500/10 px-2.5 py-0.5 rounded-full font-mono font-semibold uppercase tracking-wider">
          Live Insight
        </span>
      </div>

      {/* Summary */}
      <div className="border-l-3 border-indigo-500 pl-4 py-0.5">
        <h3 className="text-base font-semibold leading-snug text-[var(--color-text-primary)]">
          {insight.summary}
        </h3>
      </div>

      {/* Explanation lines */}
      <div className="space-y-3.5 pl-1">
        {lines.map((line, i) => {
          const cleanLine = line.trim();
          const isBullet = cleanLine.startsWith("-") || cleanLine.startsWith("•") || cleanLine.startsWith("*");
          const isNumbered = /^\d+\./.test(cleanLine);
          
          if (isBullet) {
            return (
              <div key={i} className="flex gap-2.5 text-sm text-[var(--color-text-secondary)] leading-relaxed">
                <span className="text-indigo-400 mt-2 flex-shrink-0 w-1.5 h-1.5 rounded-full bg-indigo-400" />
                <span>{cleanLine.replace(/^[-•*]\s*/, "")}</span>
              </div>
            );
          }
          
          if (isNumbered) {
            const match = cleanLine.match(/^(\d+)\.\s*(.*)/);
            if (match) {
              return (
                <div key={i} className="flex gap-2.5 text-sm text-[var(--color-text-secondary)] leading-relaxed">
                  <span className="text-indigo-400 font-mono font-bold flex-shrink-0 text-xs mt-0.5">{match[1]}.</span>
                  <span>{match[2]}</span>
                </div>
              );
            }
          }
          
          return (
            <p key={i} className="text-sm text-[var(--color-text-secondary)] leading-relaxed">
              {line}
            </p>
          );
        })}
      </div>

      {/* Recommendation chip */}
      <div
        className="flex items-start gap-3.5 rounded-xl p-5 transition-all duration-300 hover:border-indigo-500/30"
        style={{
          background: "linear-gradient(90deg, rgba(99, 102, 241, 0.12) 0%, rgba(99, 102, 241, 0.02) 100%)",
          border: "1px solid rgba(99, 102, 241, 0.15)",
        }}
      >
        <div className="p-2 bg-indigo-500/10 rounded-lg text-indigo-400 flex-shrink-0 mt-0.5">
          <Lightbulb className="w-4 h-4" />
        </div>
        <div className="space-y-1">
          <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-300">
            Recommended Mitigation
          </h4>
          <p className="text-sm font-medium text-[var(--color-text-primary)] leading-relaxed">
            {insight.recommendation}
          </p>
        </div>
      </div>
    </div>
  );
}

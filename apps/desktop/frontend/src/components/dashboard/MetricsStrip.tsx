"use client";

import { useHealthStore } from "@/stores/health-store";
import { Cpu, HardDrive, LayoutDashboard } from "lucide-react";

export function MetricsStrip() {
  const { latestScore } = useHealthStore();

  const metrics = [
    {
      label: "CPU Usage",
      value: latestScore?.component_scores?.performance ?? 0,
      icon: Cpu,
      color: "var(--color-brand-400)",
    },
    {
      label: "RAM Usage",
      value: latestScore?.component_scores?.hardware ?? 0,
      icon: LayoutDashboard,
      color: "var(--color-accent-400)",
    },
    {
      label: "Disk I/O",
      value: latestScore?.component_scores?.storage ?? 0,
      icon: HardDrive,
      color: "hsl(280 80% 60%)",
    },
  ];

  return (
    <div className="grid grid-cols-3 gap-4">
      {metrics.map((m, i) => (
        <div key={m.label} className={`glass-card p-4 flex flex-col gap-3 animate-fade-in stagger-${i + 1}`}>
          <div className="flex items-center gap-2 opacity-70">
            <m.icon size={16} color={m.color} />
            <p className="text-xs tracking-wider uppercase font-medium">
              {m.label}
            </p>
          </div>
          <div className="flex items-end justify-between">
            <p className="text-3xl font-bold font-mono tracking-tight tabular-nums">
              {m.value}%
            </p>
            {/* Miniature progress bar */}
            <div className="w-1/2 h-1.5 bg-[var(--color-surface-600)] rounded-full overflow-hidden mb-1.5">
              <div 
                className="h-full rounded-full transition-all duration-500 ease-out" 
                style={{ width: `${m.value}%`, background: m.color }}
              />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

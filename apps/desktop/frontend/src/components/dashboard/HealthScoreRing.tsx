"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface Props {
  score: number;
  size?: number;
  label?: string;
  className?: string;
}

function getScoreColor(score: number): string {
  if (score >= 90) return "var(--color-status-healthy)";
  if (score >= 70) return "hsl(168 71% 45%)";
  if (score >= 50) return "var(--color-status-warning)";
  if (score >= 30) return "hsl(25 95% 53%)";
  return "var(--color-status-danger)";
}

export function HealthScoreRing({ score, size = 160, label, className }: Props) {
  const radius = size * 0.4;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (score / 100) * circumference;
  const color = getScoreColor(score);
  const strokeWidth = size * 0.045; // thinner, sleeker ring

  return (
    <div className={cn("relative flex items-center justify-center", className)}>
      <svg width={size} height={size} className="-rotate-90">
        {/* Background track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          className="fill-none"
          stroke="var(--color-surface-700)"
          strokeWidth={strokeWidth}
        />
        {/* Animated value ring */}
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeLinecap="round"
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset }}
          transition={{ duration: 1.5, ease: [0.16, 1, 0.3, 1] }} // smooth ease out
          style={{ filter: `drop-shadow(0 0 12px ${color}60)` }}
        />
      </svg>
      <div className="absolute flex flex-col items-center text-center">
        <span className="text-[42px] font-semibold tabular-nums tracking-tighter leading-none" style={{ color: "var(--color-text-primary)" }}>
          {score}
        </span>
        {label && (
          <p className="text-[11px] font-medium tracking-widest uppercase mt-2 text-[var(--color-text-secondary)]">
            {label}
          </p>
        )}
      </div>
    </div>
  );
}

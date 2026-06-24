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
  if (score >= 90) return "hsl(142 65% 42%)"; // Excellent
  if (score >= 70) return "hsl(168 60% 42%)"; // Good
  if (score >= 50) return "hsl(45 95% 52%)";  // Fair
  if (score >= 30) return "hsl(22 90% 52%)";  // Poor
  return "hsl(0 78% 52%)";                    // Critical
}

export function HealthScoreRing({ score, size = 160, label, className }: Props) {
  const radius = size * 0.35;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (score / 100) * circumference;
  const color = getScoreColor(score);
  const strokeWidth = size * 0.08;

  return (
    <div className={cn("relative flex items-center justify-center", className)}>
      <svg width={size} height={size} className="-rotate-90">
        {/* Background track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          className="fill-none"
          stroke="var(--color-surface-600)"
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
          transition={{ duration: 1.5, ease: "easeOut" }}
          style={{ filter: `drop-shadow(0 0 8px ${color}40)` }}
        />
      </svg>
      <div className="absolute flex flex-col items-center text-center">
        <span className="text-4xl font-bold tabular-nums tracking-tighter" style={{ color: "var(--color-text-primary)" }}>
          {score}
        </span>
        {label && (
          <p className="text-xs font-medium tracking-wide uppercase mt-1 opacity-70" style={{ color: "var(--color-text-secondary)" }}>
            {label}
          </p>
        )}
      </div>
    </div>
  );
}

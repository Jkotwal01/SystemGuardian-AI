"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  LayoutDashboard, Shield, Activity, Cpu, 
  Network, HardDrive, AlertTriangle, Bot, 
  FileText, Settings2 
} from "lucide-react";
import { useBackendStatus } from "@/hooks/useBackendStatus";

const NAV_ITEMS = [
  { href: "/overview", icon: LayoutDashboard, label: "Overview" },
  { href: "/security", icon: Shield, label: "Security" },
  { href: "/performance", icon: Activity, label: "Performance" },
  { href: "/hardware", icon: Cpu, label: "Hardware" },
  { href: "/network", icon: Network, label: "Network" },
  { href: "/storage", icon: HardDrive, label: "Storage" },
  { href: "/incidents", icon: AlertTriangle, label: "Incidents" },
  { href: "/ai-assistant", icon: Bot, label: "AI Assistant" },
  { href: "/reports", icon: FileText, label: "Reports" },
  { href: "/settings", icon: Settings2, label: "Settings" },
];

export function Sidebar() {
  const pathname = usePathname();
  const status = useBackendStatus();

  return (
    <aside
      className="w-56 flex-shrink-0 flex flex-col gap-1 px-3 py-4 border-r"
      style={{
        background: "var(--color-surface-800)",
        borderColor: "var(--color-surface-700)",
      }}
    >
      {/* Logo */}
      <div className="flex items-center gap-2 px-2 py-3 mb-4">
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center text-sm font-bold shadow-brand"
          style={{
            background: "linear-gradient(135deg, hsl(220 80% 50%), hsl(185 85% 55%))",
          }}
        >
          SG
        </div>
        <span
          className="font-semibold text-sm"
          style={{ color: "var(--color-text-primary)" }}
        >
          SystemGuardian AI
        </span>
      </div>

      {/* Nav items */}
      <div className="flex flex-col gap-1">
        {NAV_ITEMS.map(({ href, icon: Icon, label }) => {
          const active = pathname.startsWith(href);
          return (
            <Link 
              key={href} 
              href={href}
              className={`nav-item${active ? " active" : ""}`}
            >
              <Icon size={16} />
              {label}
            </Link>
          );
        })}
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Status */}
      <div
        className="px-3 py-2 rounded-lg flex items-center gap-2"
        style={{
          background: "var(--color-surface-700)",
          color: "var(--color-text-muted)",
          fontSize: "var(--text-xs)",
        }}
      >
        <span className={status === "online" ? "pulse-live" : "w-2 h-2 rounded-full bg-gray-500"} />
        Backend: {status.charAt(0).toUpperCase() + status.slice(1)}
      </div>
    </aside>
  );
}

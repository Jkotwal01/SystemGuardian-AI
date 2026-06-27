"use client";

import { useState } from "react";
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
  const [isOpen, setIsOpen] = useState(true);

  return (
    <aside
      className={`flex-shrink-0 flex flex-col gap-1 py-4 transition-all duration-300 ${isOpen ? 'w-56 px-3' : 'w-[60px] px-1.5'}`}
      style={{
        background: "transparent",
      }}
    >
      {/* Logo & Toggle */}
      <div className={`flex items-center ${isOpen ? 'px-2' : 'justify-center px-0'} py-2 mb-4`}>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={`flex items-center gap-2.5 overflow-hidden hover:opacity-80 transition-opacity cursor-pointer text-left ${!isOpen ? 'justify-center' : ''}`}
          title={isOpen ? "Collapse Sidebar" : "Expand Sidebar"}
        >
          <div
            className="w-7 h-7 flex-shrink-0 rounded-md flex items-center justify-center text-sm font-bold"
            style={{
              background: "linear-gradient(180deg, var(--color-brand-400), var(--color-brand-600))",
              color: "white",
              boxShadow: "var(--shadow-brand), inset 0 1px 0 0 rgba(255, 255, 255, 0.2)",
            }}
          >
            SG
          </div>
          {isOpen && (
            <span
              className="font-medium tracking-tight text-[15px] whitespace-nowrap"
              style={{ color: "var(--color-text-primary)" }}
            >
              SystemGuardian
            </span>
          )}
        </button>
      </div>

      {/* Nav items */}
      <div className="flex flex-col gap-1">
        {NAV_ITEMS.map(({ href, icon: Icon, label }) => {
          const active = pathname.startsWith(href);
          return (
            <Link 
              key={href} 
              href={href}
              className={`nav-item ${active ? "active" : ""} ${!isOpen ? '!px-0 justify-center w-10 h-10 mx-auto' : ''}`}
              title={!isOpen ? label : undefined}
            >
              <Icon size={16} className={active ? "text-[var(--color-text-primary)]" : "text-[var(--color-text-muted)]"} />
              {isOpen && <span>{label}</span>}
            </Link>
          );
        })}
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Status */}
      <div
        className={`py-2.5 rounded-lg flex items-center ${isOpen ? 'px-3 gap-2.5' : 'justify-center mx-auto w-10'} border border-transparent hover:border-[var(--color-surface-600)] transition-colors cursor-default`}
        style={{
          background: "var(--color-surface-900)",
          color: "var(--color-text-secondary)",
          fontSize: "var(--text-xs)",
          boxShadow: "var(--shadow-glow)",
        }}
        title={!isOpen ? `Backend: ${status}` : undefined}
      >
        <span className={status === "online" ? "pulse-live flex-shrink-0" : "w-2 h-2 rounded-full bg-[var(--color-surface-500)] flex-shrink-0"} />
        {isOpen && <span className="font-medium truncate">Backend: {status.charAt(0).toUpperCase() + status.slice(1)}</span>}
      </div>
    </aside>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  LayoutDashboard, Shield, Activity, Cpu, 
  Network, HardDrive, AlertTriangle, Bot, 
  FileText, Settings2, X
} from "lucide-react";
import { useBackendStatus } from "@/hooks/useBackendStatus";
import { useUIStore } from "@/stores/ui-store";
import sgIcon from "@/app/SG icon.png";

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
  
  const isSidebarOpen = useUIStore((s) => s.isSidebarOpen);
  const toggleSidebar = useUIStore((s) => s.toggleSidebar);
  const isMobileSidebarOpen = useUIStore((s) => s.isMobileSidebarOpen);
  const closeMobileSidebar = useUIStore((s) => s.closeMobileSidebar);

  return (
    <>
      {/* Mobile Backdrop */}
      {isMobileSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden"
          onClick={closeMobileSidebar}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed md:relative inset-y-0 left-0 z-50 flex-shrink-0 flex flex-col gap-1 py-4 transition-all duration-300 transform 
          ${isMobileSidebarOpen ? 'translate-x-0 w-64 px-4 bg-[var(--color-surface-800)] border-r border-[var(--color-surface-600)] shadow-2xl' : '-translate-x-full md:translate-x-0'} 
          ${isSidebarOpen ? 'md:w-56 md:px-3' : 'md:w-[60px] md:px-1.5'}`}
        style={{
          background: isMobileSidebarOpen ? 'var(--color-surface-800)' : 'transparent',
        }}
      >
        {/* Logo & Toggle */}
        <div className={`flex items-center ${isSidebarOpen || isMobileSidebarOpen ? 'px-2' : 'justify-center px-0'} py-2 mb-4`}>
          <div className="flex-1 flex items-center justify-between">
            <button
              onClick={toggleSidebar}
              className={`flex items-center gap-2.5 overflow-hidden hover:opacity-80 transition-opacity cursor-pointer text-left ${!isSidebarOpen && !isMobileSidebarOpen ? 'justify-center w-full' : ''}`}
              title={isSidebarOpen ? "Collapse Sidebar" : "Expand Sidebar"}
            >
              <div className="w-7 h-7 flex-shrink-0 rounded-md overflow-hidden flex items-center justify-center">
                <img src={sgIcon.src} alt="SystemGuardian Logo" className="w-full h-full object-cover" />
              </div>
              {(isSidebarOpen || isMobileSidebarOpen) && (
                <span
                  className="font-medium tracking-tight text-[15px] whitespace-nowrap"
                  style={{ color: "var(--color-text-primary)" }}
                >
                  SystemGuardian
                </span>
              )}
            </button>
            
            {/* Mobile Close Button */}
            {isMobileSidebarOpen && (
              <button 
                onClick={closeMobileSidebar}
                className="p-1.5 rounded-md text-[var(--color-text-muted)] hover:bg-[var(--color-surface-700)] md:hidden"
              >
                <X size={20} />
              </button>
            )}
          </div>
        </div>

        {/* Nav items */}
        <div className="flex flex-col gap-1 overflow-y-auto">
          {NAV_ITEMS.map(({ href, icon: Icon, label }) => {
            const active = pathname.startsWith(href);
            return (
              <Link 
                key={href} 
                href={href}
                onClick={() => {
                  if (isMobileSidebarOpen) closeMobileSidebar();
                }}
                className={`nav-item ${active ? "active" : ""} ${!isSidebarOpen && !isMobileSidebarOpen ? '!px-0 justify-center w-10 h-10 mx-auto' : ''}`}
                title={!isSidebarOpen && !isMobileSidebarOpen ? label : undefined}
              >
                <Icon size={16} className={active ? "text-[var(--color-text-primary)]" : "text-[var(--color-text-muted)]"} />
                {(isSidebarOpen || isMobileSidebarOpen) && <span>{label}</span>}
              </Link>
            );
          })}
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Status */}
        <div
          className={`py-2.5 rounded-lg flex items-center ${isSidebarOpen || isMobileSidebarOpen ? 'px-3 gap-2.5' : 'justify-center mx-auto w-10'} border border-transparent hover:border-[var(--color-surface-600)] transition-colors cursor-default`}
          style={{
            background: "var(--color-surface-900)",
            color: "var(--color-text-secondary)",
            fontSize: "var(--text-xs)",
            boxShadow: "var(--shadow-glow)",
          }}
          title={!isSidebarOpen && !isMobileSidebarOpen ? `Backend: ${status}` : undefined}
        >
          <span className={status === "online" ? "pulse-live flex-shrink-0" : "w-2 h-2 rounded-full bg-[var(--color-surface-500)] flex-shrink-0"} />
          {(isSidebarOpen || isMobileSidebarOpen) && <span className="font-medium truncate">Backend: {status.charAt(0).toUpperCase() + status.slice(1)}</span>}
        </div>
      </aside>
    </>
  );
}

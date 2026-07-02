"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { WindowControls } from "./WindowControls";
import { NotificationBell } from "./NotificationBell";
import { useBackendStatus } from "@/hooks/useBackendStatus";
import { Menu, Bot, BotOff } from "lucide-react";
import { useUIStore } from "@/stores/ui-store";
import { api } from "@/lib/api-client";
import { AIStatusResponse } from "@/lib/types";

function AIStatusBadge({ aiStatus }: { aiStatus: AIStatusResponse | null }) {
  if (!aiStatus) return null;

  const isActive = aiStatus.active_provider !== "none";
  const label = isActive
    ? aiStatus.active_provider === "ollama"
      ? `Ollama · ${aiStatus.ollama_model}`
      : "Gemini"
    : "AI Offline";

  return (
    <span
      className="hidden sm:inline-flex text-[11px] font-medium px-2 py-0.5 rounded-full items-center gap-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.07)]"
      style={{
        background: "var(--color-surface-700)",
        color: isActive ? "hsl(250 100% 75%)" : "var(--color-text-muted)",
        border: `1px solid ${isActive ? "hsl(250 60% 40% / 0.5)" : "var(--color-surface-600)"}`,
      }}
    >
      {isActive ? (
        <Bot className="w-3 h-3 opacity-80 flex-shrink-0" />
      ) : (
        <BotOff className="w-3 h-3 opacity-50 flex-shrink-0" />
      )}
      {label}
    </span>
  );
}

export function TopBar() {
  const pathname = usePathname();
  const status = useBackendStatus();
  const toggleMobileSidebar = useUIStore((s) => s.toggleMobileSidebar);
  const [aiStatus, setAiStatus] = useState<AIStatusResponse | null>(null);

  // Poll AI status every 30 seconds
  useEffect(() => {
    let mounted = true;

    async function fetchAIStatus() {
      try {
        const result = await api.ai.getStatus();
        if (mounted) setAiStatus(result);
      } catch {
        // Silently ignore — backend may not be ready
      }
    }

    fetchAIStatus();
    const interval = setInterval(fetchAIStatus, 30_000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  // Create a nice title from the pathname (e.g. /ai-assistant -> AI Assistant)
  const title = pathname === "/" || pathname === "" 
    ? "Dashboard" 
    : pathname.slice(1).split("-").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");

  return (
    <header
      data-tauri-drag-region
      className="h-12 flex items-center justify-between pl-4 md:pl-6 border-b border-[var(--color-surface-700)] flex-shrink-0 select-none bg-transparent"
    >
      <div className="flex items-center gap-3 md:gap-4 pointer-events-none">
        <button 
          onClick={toggleMobileSidebar}
          className="p-1.5 md:hidden pointer-events-auto rounded-md text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-700)] transition-colors"
        >
          <Menu size={18} />
        </button>
        
        <h1
          className="font-medium tracking-tight"
          style={{
            color: "var(--color-text-primary)",
            fontSize: "15px",
          }}
        >
          {title}
        </h1>
        
        <div className="flex items-center gap-2">
          {/* Backend connection status */}
          {status === "online" && (
            <span
              className="text-[11px] font-medium px-2 py-0.5 rounded-full flex items-center gap-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]"
              style={{
                background: "var(--color-surface-700)",
                color: "var(--color-status-healthy)",
                border: "1px solid var(--color-surface-600)",
              }}
            >
              <div className="w-1.5 h-1.5 rounded-full bg-[var(--color-status-healthy)] shadow-[0_0_8px_var(--color-status-healthy)]" />
              Connected
            </span>
          )}
          {status === "offline" && (
            <span
              className="text-[11px] font-medium px-2 py-0.5 rounded-full flex items-center gap-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]"
              style={{
                background: "var(--color-surface-700)",
                color: "var(--color-text-secondary)",
                border: "1px solid var(--color-surface-600)",
              }}
            >
              <div className="w-1.5 h-1.5 rounded-full bg-[var(--color-text-muted)]" />
              Offline
            </span>
          )}
          {status === "connecting" && (
            <span
              className="text-[11px] font-medium px-2 py-0.5 rounded-full flex items-center gap-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]"
              style={{
                background: "var(--color-surface-700)",
                color: "var(--color-status-warning)",
                border: "1px solid var(--color-surface-600)",
              }}
            >
              <span className="w-1.5 h-1.5 rounded-full animate-pulse bg-[var(--color-status-warning)]" />
              Connecting...
            </span>
          )}

          {/* AI provider status badge — only when backend is online */}
          {status === "online" && <AIStatusBadge aiStatus={aiStatus} />}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <NotificationBell />
        <WindowControls />
      </div>
    </header>
  );
}

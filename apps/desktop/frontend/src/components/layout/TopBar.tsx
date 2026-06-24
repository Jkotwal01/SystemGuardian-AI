"use client";

import { usePathname } from "next/navigation";
import { WindowControls } from "./WindowControls";
import { useBackendStatus } from "@/hooks/useBackendStatus";

export function TopBar() {
  const pathname = usePathname();
  const status = useBackendStatus();
  
  // Create a nice title from the pathname (e.g. /ai-assistant -> AI Assistant)
  const title = pathname === "/" || pathname === "" 
    ? "Dashboard" 
    : pathname.slice(1).split("-").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");

  return (
    <header
      data-tauri-drag-region
      className="h-12 flex items-center justify-between pl-6 border-b flex-shrink-0 select-none"
      style={{
        background: "var(--color-surface-800)",
        borderColor: "var(--color-surface-700)",
      }}
    >
      <div className="flex items-center gap-4 pointer-events-none">
        <h1
          className="font-semibold"
          style={{
            color: "var(--color-text-primary)",
            fontSize: "var(--text-base)",
          }}
        >
          {title}
        </h1>
        
        <div className="flex items-center gap-2">
          {status === "online" && (
            <span
              className="text-xs px-2 py-0.5 rounded-full"
              style={{
                background: "hsl(142 65% 42% / 0.15)",
                color: "hsl(142 65% 55%)",
                border: "1px solid hsl(142 65% 42% / 0.3)",
              }}
            >
              Backend Connected
            </span>
          )}
          {status === "offline" && (
            <span
              className="text-xs px-2 py-0.5 rounded-full"
              style={{
                background: "hsl(0 80% 55% / 0.15)",
                color: "hsl(0 80% 65%)",
                border: "1px solid hsl(0 80% 55% / 0.3)",
              }}
            >
              Backend Offline
            </span>
          )}
          {status === "connecting" && (
            <span
              className="text-xs px-2 py-0.5 rounded-full flex items-center gap-2"
              style={{
                background: "hsl(45 95% 55% / 0.15)",
                color: "hsl(45 95% 65%)",
                border: "1px solid hsl(45 95% 55% / 0.3)",
              }}
            >
              <span className="w-2 h-2 rounded-full animate-pulse bg-[hsl(45_95%_65%)]" />
              Connecting...
            </span>
          )}
        </div>
      </div>

      <WindowControls />
    </header>
  );
}

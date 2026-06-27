"use client";

import { useEffect, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Minus, X, Maximize2 } from "lucide-react";

export function WindowControls() {
  const [isTauri, setIsTauri] = useState(false);

  useEffect(() => {
    // Check if we are running in Tauri
    if (typeof window !== "undefined" && '__TAURI_INTERNALS__' in window) {
      setIsTauri(true);
    }
  }, []);

  if (!isTauri) return null;

  return (
    <div className="flex items-center gap-2 pr-4 h-full group" style={{ WebkitAppRegion: 'no-drag' } as any}>
      <button
        onClick={() => getCurrentWindow().close()}
        className="w-[12px] h-[12px] rounded-full bg-[#ff5f56] flex items-center justify-center border border-black/20 shadow-sm"
        title="Close"
      >
        <X size={8} strokeWidth={3} className="text-black/60 opacity-0 group-hover:opacity-100 transition-opacity" />
      </button>
      <button
        onClick={() => getCurrentWindow().minimize()}
        className="w-[12px] h-[12px] rounded-full bg-[#ffbd2e] flex items-center justify-center border border-black/20 shadow-sm"
        title="Minimize"
      >
        <Minus size={8} strokeWidth={3} className="text-black/60 opacity-0 group-hover:opacity-100 transition-opacity" />
      </button>
      <button
        onClick={() => getCurrentWindow().toggleMaximize()}
        className="w-[12px] h-[12px] rounded-full bg-[#27c93f] flex items-center justify-center border border-black/20 shadow-sm"
        title="Maximize"
      >
        <Maximize2 size={8} strokeWidth={3} className="text-black/60 opacity-0 group-hover:opacity-100 transition-opacity" />
      </button>
    </div>
  );
}

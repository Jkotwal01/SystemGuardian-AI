"use client";

import { useEffect, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Minus, X, Square } from "lucide-react";

export function WindowControls() {
  const [isTauri, setIsTauri] = useState(false);

  useEffect(() => {
    // Check if we are running in Tauri
    if (typeof window !== "undefined" && '__TAURI_INTERNALS__' in window) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsTauri(true);
    }
  }, []);

  if (!isTauri) return null;

  return (
    <div className="flex items-center gap-2 px-4 h-full group/window-controls pointer-events-auto">
      <button
        onClick={() => getCurrentWindow().close()}
        className="w-3 h-3 rounded-full bg-[#ff5f56] flex items-center justify-center text-black/60 border border-black/10 hover:border-black/20 transition-colors"
        title="Close"
      >
        <X size={8} strokeWidth={3} className="opacity-0 group-hover/window-controls:opacity-100 transition-opacity" />
      </button>
      <button
        onClick={() => getCurrentWindow().minimize()}
        className="w-3 h-3 rounded-full bg-[#ffbd2e] flex items-center justify-center text-black/60 border border-black/10 hover:border-black/20 transition-colors"
        title="Minimize"
      >
        <Minus size={8} strokeWidth={3} className="opacity-0 group-hover/window-controls:opacity-100 transition-opacity" />
      </button>
      <button
        onClick={() => getCurrentWindow().toggleMaximize()}
        className="w-3 h-3 rounded-full bg-[#27c93f] flex items-center justify-center text-black/60 border border-black/10 hover:border-black/20 transition-colors"
        title="Maximize"
      >
        <Square size={8} strokeWidth={3} className="opacity-0 group-hover/window-controls:opacity-100 transition-opacity" />
      </button>
    </div>
  );
}

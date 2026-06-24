"use client";

import { useEffect, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Minus, Square, X } from "lucide-react";

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
    <div className="flex items-center h-full">
      <button
        onClick={() => getCurrentWindow().minimize()}
        className="h-full px-4 hover:bg-[var(--color-surface-600)] transition-colors flex items-center justify-center text-[var(--color-text-secondary)] hover:text-white"
        title="Minimize"
      >
        <Minus size={16} />
      </button>
      <button
        onClick={() => getCurrentWindow().toggleMaximize()}
        className="h-full px-4 hover:bg-[var(--color-surface-600)] transition-colors flex items-center justify-center text-[var(--color-text-secondary)] hover:text-white"
        title="Maximize"
      >
        <Square size={14} />
      </button>
      <button
        onClick={() => getCurrentWindow().close()}
        className="h-full px-4 hover:bg-red-500 transition-colors flex items-center justify-center text-[var(--color-text-secondary)] hover:text-white"
        title="Close"
      >
        <X size={16} />
      </button>
    </div>
  );
}

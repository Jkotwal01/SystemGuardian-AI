"use client";

import { useState, useEffect } from "react";
import sgIcon from "@/app/SG icon.png";
import { ShieldCheck, Activity, Cpu } from "lucide-react";

export function SplashWrapper({ children }: { children: React.ReactNode }) {
  const [showSplash, setShowSplash] = useState(true);
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    // Start fade out after 1.5 seconds
    const fadeTimer = setTimeout(() => {
      setFadeOut(true);
    }, 1500);

    // Remove splash completely after 2 seconds
    const removeTimer = setTimeout(() => {
      setShowSplash(false);
    }, 2000);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(removeTimer);
    };
  }, []);

  if (!showSplash) {
    return <>{children}</>;
  }

  return (
    <>
      <div 
        className={`fixed inset-0 z-[99999] bg-[var(--color-surface-950)] flex flex-col items-center justify-center transition-opacity duration-500 ease-in-out ${fadeOut ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
        style={{
          background: "radial-gradient(circle at center, var(--color-surface-900) 0%, var(--color-surface-950) 100%)"
        }}
      >
        {/* Decorative background glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-brand-500/10 blur-[100px] rounded-full pointer-events-none" />

        <div className="flex flex-col items-center justify-center z-10 animate-fade-in-up w-full">
          {/* Logo Container */}
          <div className="w-28 h-28 sm:w-36 sm:h-36 mb-8 rounded-2xl sm:rounded-3xl overflow-hidden shadow-[0_0_50px_rgba(var(--color-brand-500-rgb),0.3)] border border-[var(--color-surface-700)]">
             <img src={sgIcon.src} alt="SystemGuardian Logo" className="w-full h-full object-cover" />
          </div>
          
          <h1 className="text-3xl sm:text-5xl font-semibold tracking-tight text-[var(--color-text-primary)] mb-3 text-center">
            SystemGuardian <span className="text-[var(--color-brand-400)]">AI</span>
          </h1>
          <p className="text-sm sm:text-lg text-[var(--color-text-secondary)] font-medium tracking-widest uppercase mb-12 sm:mb-16 text-center">
            OS Intelligence Platform
          </p>

          {/* Features Grid */}
          <div className="flex flex-col sm:flex-row gap-8 sm:gap-16 mt-4 w-full max-w-3xl px-6 justify-center">
            <div className="flex flex-col items-center gap-4 text-center opacity-0 animate-fade-in-up" style={{ animationDelay: '300ms', animationFillMode: 'forwards' }}>
              <div className="p-4 rounded-2xl bg-[var(--color-surface-800)] border border-[var(--color-surface-700)] text-indigo-400 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
                <ShieldCheck className="w-8 h-8" />
              </div>
              <span className="text-xs sm:text-sm font-semibold tracking-widest uppercase text-[var(--color-text-muted)]">Live Threat<br/>Detection</span>
            </div>
            
            <div className="flex flex-col items-center gap-4 text-center opacity-0 animate-fade-in-up" style={{ animationDelay: '600ms', animationFillMode: 'forwards' }}>
              <div className="p-4 rounded-2xl bg-[var(--color-surface-800)] border border-[var(--color-surface-700)] text-emerald-400 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
                <Activity className="w-8 h-8" />
              </div>
              <span className="text-xs sm:text-sm font-semibold tracking-widest uppercase text-[var(--color-text-muted)]">Performance<br/>Analytics</span>
            </div>
            
            <div className="flex flex-col items-center gap-4 text-center opacity-0 animate-fade-in-up" style={{ animationDelay: '900ms', animationFillMode: 'forwards' }}>
              <div className="p-4 rounded-2xl bg-[var(--color-surface-800)] border border-[var(--color-surface-700)] text-amber-400 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
                <Cpu className="w-8 h-8" />
              </div>
              <span className="text-xs sm:text-sm font-semibold tracking-widest uppercase text-[var(--color-text-muted)]">Hardware<br/>Telemetry</span>
            </div>
          </div>
          
          {/* Loading Bar */}
          <div className="mt-20 w-64 h-1.5 bg-[var(--color-surface-800)] rounded-full overflow-hidden shadow-[inset_0_1px_2px_rgba(0,0,0,0.5)]">
            <div className="h-full bg-[var(--color-brand-400)] rounded-full animate-loading-bar" />
          </div>
        </div>
      </div>
      
      {/* Pre-render children in background so they are ready when splash fades */}
      <div className={fadeOut ? "opacity-100 transition-opacity duration-500 h-full flex flex-col" : "opacity-0 h-0 overflow-hidden"}>
        {children}
      </div>
    </>
  );
}

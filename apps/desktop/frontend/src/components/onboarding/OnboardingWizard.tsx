"use client";

import { useState, useEffect } from "react";
import { Shield, Bot, Activity, CheckCircle2, ChevronRight, ChevronLeft, Loader2 } from "lucide-react";
import { api } from "@/lib/api-client";
import { AppSettings } from "@/lib/types";
import sgIcon from "@/app/SG icon.png";

export function OnboardingWizard({ onComplete }: { onComplete: () => void }) {
  const [step, setStep] = useState(1);
  const [settings, setSettings] = useState<Partial<AppSettings>>({
    ai_provider: "ollama",
    ollama_base_url: "http://localhost:11434",
    ollama_model: "llama3.2",
    gemini_api_key: "",
    metrics_interval_seconds: "30",
    module_security: "true",
    module_performance: "true",
    module_network: "true",
  });
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ available: boolean; error: string | null } | null>(null);
  const [saving, setSaving] = useState(false);

  // Fetch initial defaults
  useEffect(() => {
    api.settings.get().then(data => {
      if (data.onboarding_complete === "true") {
        onComplete();
      } else {
        setSettings(data);
      }
    }).catch(console.error);
  }, [onComplete]);

  const update = (k: keyof AppSettings, v: string) => setSettings(s => ({ ...s, [k]: v }));

  async function handleTestAI() {
    setTesting(true);
    setTestResult(null);
    try {
      // First save the current AI settings temporarily so the backend can test them
      await api.settings.update({
        ai_provider: settings.ai_provider,
        ollama_base_url: settings.ollama_base_url,
        ollama_model: settings.ollama_model,
        gemini_api_key: settings.gemini_api_key,
      });
      const res = await api.settings.testAI();
      setTestResult(res);
    } catch {
      setTestResult({ available: false, error: "Network error" });
    } finally {
      setTesting(false);
    }
  }

  async function handleFinish() {
    setSaving(true);
    try {
      await api.settings.update({
        ...settings,
        onboarding_complete: "true"
      });
      onComplete();
    } catch (e) {
      console.error(e);
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[9999] bg-[var(--color-surface-950)] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-gradient-to-br from-[var(--color-brand-500)]/5 to-transparent pointer-events-none" />
      
      <div className="w-full max-w-2xl bg-[var(--color-surface-900)] rounded-2xl border border-[var(--color-surface-700)] shadow-2xl overflow-hidden flex flex-col min-h-[600px] animate-fade-in-up relative z-10">
        
        {/* Progress Bar */}
        <div className="h-1.5 w-full bg-[var(--color-surface-800)] flex">
          <div className="h-full bg-[var(--color-primary-main)] transition-all duration-500" style={{ width: `${(step / 3) * 100}%` }} />
        </div>

        {/* Content Area */}
        <div className="flex-1 p-8 md:p-12 overflow-y-auto">
          {/* ── STEP 1: WELCOME ── */}
          {step === 1 && (
            <div className="flex flex-col items-center text-center animate-fade-in">
              <div className="w-24 h-24 mb-8 rounded-2xl overflow-hidden shadow-[0_0_30px_rgba(var(--color-brand-500-rgb),0.3)] border border-[var(--color-surface-700)]">
                <img src={sgIcon.src} alt="SystemGuardian" className="w-full h-full object-cover" />
              </div>
              <h1 className="text-3xl font-bold text-[var(--color-text-primary)] mb-4">
                Welcome to SystemGuardian <span className="text-[var(--color-primary-main)]">AI</span>
              </h1>
              <p className="text-base text-[var(--color-text-secondary)] mb-10 max-w-md mx-auto leading-relaxed">
                Your intelligent OS monitoring platform. Let's get things configured so the AI can start analyzing your system health and security.
              </p>

              <div className="space-y-4 w-full max-w-md text-left">
                <div className="flex items-center gap-4 p-4 rounded-xl bg-[var(--color-surface-800)] border border-[var(--color-surface-700)]">
                  <Shield className="w-6 h-6 text-emerald-400" />
                  <div>
                    <h3 className="font-semibold text-sm text-[var(--color-text-primary)]">Live Threat Detection</h3>
                    <p className="text-xs text-[var(--color-text-muted)] mt-0.5">Monitors suspicious logins and processes.</p>
                  </div>
                </div>
                <div className="flex items-center gap-4 p-4 rounded-xl bg-[var(--color-surface-800)] border border-[var(--color-surface-700)]">
                  <Activity className="w-6 h-6 text-blue-400" />
                  <div>
                    <h3 className="font-semibold text-sm text-[var(--color-text-primary)]">Hardware Telemetry</h3>
                    <p className="text-xs text-[var(--color-text-muted)] mt-0.5">Tracks CPU, RAM, and Disk metrics in real-time.</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── STEP 2: AI PROVIDER ── */}
          {step === 2 && (
            <div className="flex flex-col animate-fade-in h-full">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2.5 rounded-lg bg-[var(--color-primary-main)]/20 text-[var(--color-primary-main)]">
                  <Bot className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-[var(--color-text-primary)]">AI Provider Setup</h2>
                  <p className="text-sm text-[var(--color-text-muted)]">Choose the engine that will analyze your system data.</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-6">
                <button
                  onClick={() => update("ai_provider", "ollama")}
                  className={`p-4 rounded-xl border-2 text-left transition-all ${
                    settings.ai_provider === "ollama" ? "border-[var(--color-primary-main)] bg-[var(--color-primary-main)]/10" : "border-[var(--color-surface-700)] bg-[var(--color-surface-800)]"
                  }`}
                >
                  <div className="font-bold text-[var(--color-text-primary)] mb-1">Ollama (Local)</div>
                  <div className="text-xs text-[var(--color-text-muted)]">100% private. Runs on your hardware.</div>
                </button>
                <button
                  onClick={() => update("ai_provider", "gemini")}
                  className={`p-4 rounded-xl border-2 text-left transition-all ${
                    settings.ai_provider === "gemini" ? "border-[var(--color-primary-main)] bg-[var(--color-primary-main)]/10" : "border-[var(--color-surface-700)] bg-[var(--color-surface-800)]"
                  }`}
                >
                  <div className="font-bold text-[var(--color-text-primary)] mb-1">Gemini (Cloud)</div>
                  <div className="text-xs text-[var(--color-text-muted)]">Requires API key. Faster, lower system overhead.</div>
                </button>
              </div>

              {settings.ai_provider === "ollama" ? (
                <div className="space-y-4 mb-6">
                  <div>
                    <label className="text-xs font-semibold text-[var(--color-text-secondary)] block mb-1.5">Ollama Server URL</label>
                    <input type="text" value={settings.ollama_base_url || ""} onChange={e => update("ollama_base_url", e.target.value)} className="w-full px-4 py-2.5 bg-[var(--color-surface-800)] border border-[var(--color-surface-600)] rounded-lg text-sm focus:border-[var(--color-primary-main)] focus:outline-none" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-[var(--color-text-secondary)] block mb-1.5">Model Name</label>
                    <input type="text" value={settings.ollama_model || ""} onChange={e => update("ollama_model", e.target.value)} className="w-full px-4 py-2.5 bg-[var(--color-surface-800)] border border-[var(--color-surface-600)] rounded-lg text-sm focus:border-[var(--color-primary-main)] focus:outline-none" />
                  </div>
                </div>
              ) : (
                <div className="mb-6">
                  <label className="text-xs font-semibold text-[var(--color-text-secondary)] block mb-1.5">Gemini API Key</label>
                  <input type="password" placeholder="AIza..." value={settings.gemini_api_key || ""} onChange={e => update("gemini_api_key", e.target.value)} className="w-full px-4 py-2.5 bg-[var(--color-surface-800)] border border-[var(--color-surface-600)] rounded-lg text-sm font-mono focus:border-[var(--color-primary-main)] focus:outline-none" />
                  <p className="text-[11px] text-[var(--color-text-muted)] mt-2">Get a free key from Google AI Studio.</p>
                </div>
              )}

              <div className="mt-auto">
                <button
                  onClick={handleTestAI}
                  disabled={testing}
                  className="w-full py-3 rounded-lg border border-[var(--color-surface-600)] bg-[var(--color-surface-800)] text-sm font-medium hover:bg-[var(--color-surface-700)] transition-colors flex items-center justify-center gap-2"
                >
                  {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : "Test Connection"}
                </button>
                {testResult && (
                  <div className={`mt-3 text-center text-sm font-medium ${testResult.available ? "text-green-400" : "text-red-400"}`}>
                    {testResult.available ? "✅ Connection Successful!" : `❌ ${testResult.error}`}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── STEP 3: PREFERENCES ── */}
          {step === 3 && (
            <div className="flex flex-col animate-fade-in h-full">
               <div className="flex items-center gap-3 mb-6">
                <div className="p-2.5 rounded-lg bg-[var(--color-primary-main)]/20 text-[var(--color-primary-main)]">
                  <Activity className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-[var(--color-text-primary)]">Monitoring Setup</h2>
                  <p className="text-sm text-[var(--color-text-muted)]">Select your preferred telemetry profile.</p>
                </div>
              </div>

              <div className="space-y-4">
                <button 
                  onClick={() => { update("metrics_interval_seconds", "60"); update("module_network", "false"); }}
                  className={`w-full p-4 rounded-xl border-2 text-left transition-all ${settings.metrics_interval_seconds === "60" ? "border-[var(--color-primary-main)] bg-[var(--color-primary-main)]/10" : "border-[var(--color-surface-700)] bg-[var(--color-surface-800)]"}`}
                >
                  <div className="font-bold text-[var(--color-text-primary)]">Minimal (Low Overhead)</div>
                  <div className="text-xs text-[var(--color-text-muted)] mt-1">Updates every 60s. Basic CPU/RAM only. Best for laptops on battery.</div>
                </button>
                
                <button 
                  onClick={() => { update("metrics_interval_seconds", "30"); update("module_network", "true"); update("module_hardware", "true"); }}
                  className={`w-full p-4 rounded-xl border-2 text-left transition-all ${settings.metrics_interval_seconds === "30" ? "border-[var(--color-primary-main)] bg-[var(--color-primary-main)]/10" : "border-[var(--color-surface-700)] bg-[var(--color-surface-800)]"}`}
                >
                  <div className="font-bold text-[var(--color-text-primary)]">Balanced (Recommended)</div>
                  <div className="text-xs text-[var(--color-text-muted)] mt-1">Updates every 30s. All modules enabled. Good mix of detail and performance.</div>
                </button>

                <button 
                  onClick={() => { update("metrics_interval_seconds", "5"); update("module_network", "true"); update("module_hardware", "true"); }}
                  className={`w-full p-4 rounded-xl border-2 text-left transition-all ${settings.metrics_interval_seconds === "5" ? "border-[var(--color-primary-main)] bg-[var(--color-primary-main)]/10" : "border-[var(--color-surface-700)] bg-[var(--color-surface-800)]"}`}
                >
                  <div className="font-bold text-[var(--color-text-primary)]">High Fidelity</div>
                  <div className="text-xs text-[var(--color-text-muted)] mt-1">Updates every 5s. Intensive real-time tracking. Best for powerful desktops.</div>
                </button>
              </div>

              <div className="mt-8 p-4 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 text-sm">
                <strong className="block mb-1">You're all set!</strong>
                You can change these options, manage data retention, and configure notifications later in the Settings page.
              </div>
            </div>
          )}
        </div>

        {/* ── Footer / Navigation ── */}
        <div className="p-6 border-t border-[var(--color-surface-700)] bg-[var(--color-surface-800)] flex items-center justify-between flex-shrink-0">
          <button
            onClick={() => setStep(s => s - 1)}
            disabled={step === 1 || saving}
            className="px-5 py-2.5 rounded-lg font-medium text-[var(--color-text-secondary)] hover:text-white hover:bg-[var(--color-surface-700)] transition-colors disabled:opacity-0 flex items-center gap-2"
          >
            <ChevronLeft className="w-4 h-4" /> Back
          </button>

          {step < 3 ? (
            <button
              onClick={() => setStep(s => s + 1)}
              className="px-6 py-2.5 rounded-lg font-semibold bg-[var(--color-primary-main)] text-white hover:bg-[var(--color-primary-hover)] transition-colors flex items-center gap-2"
            >
              Continue <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={handleFinish}
              disabled={saving}
              className="px-6 py-2.5 rounded-lg font-bold bg-white text-black hover:bg-gray-200 transition-colors flex items-center gap-2 shadow-[0_0_20px_rgba(255,255,255,0.3)]"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              Launch Dashboard
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Bot, Sliders, Bell, Database, Save, CheckCircle2, XCircle,
  Loader2, Eye, EyeOff, RefreshCw, Shield, Cpu, Wifi,
  HardDrive, Zap, Layers, Power, Activity
} from "lucide-react";
import { api } from "@/lib/api-client";
import { AppSettings } from "@/lib/types";

type Tab = "ai" | "monitoring" | "notifications" | "data";

const TABS: { id: Tab; label: string; icon: React.ElementType; desc: string }[] = [
  { id: "ai",            label: "AI Provider",   icon: Bot,      desc: "Configure local or cloud AI models" },
  { id: "monitoring",   label: "Monitoring",     icon: Sliders,  desc: "Collection intervals and modules" },
  { id: "notifications",label: "Notifications",  icon: Bell,     desc: "Alert thresholds and cooldowns" },
  { id: "data",         label: "Data & Privacy", icon: Database, desc: "Retention policies and storage" },
];

const MODULE_LIST = [
  { key: "module_security",    label: "Security",     icon: Shield,    desc: "Login attempts, suspicious processes" },
  { key: "module_performance", label: "Performance",  icon: Activity,  desc: "CPU, memory, lag detection" },
  { key: "module_hardware",    label: "Hardware",     icon: Cpu,       desc: "Temperatures, battery, sensors" },
  { key: "module_network",     label: "Network",      icon: Wifi,      desc: "Bandwidth, interface stats" },
  { key: "module_storage",     label: "Storage",      icon: HardDrive, desc: "Disk usage, I/O rates" },
  { key: "module_application", label: "Application",  icon: Layers,    desc: "Running apps, install events" },
  { key: "module_driver",      label: "Drivers",      icon: Zap,       desc: "Driver load and failure events" },
  { key: "module_power",       label: "Power",        icon: Power,     desc: "Power state, sleep cycles" },
];

function SectionHeader({ title, description }: { title: string; description?: string }) {
  return (
    <div className="mb-6">
      <h3 className="text-lg font-medium tracking-tight text-[var(--color-text-primary)]">{title}</h3>
      {description && <p className="text-[12px] text-[var(--color-text-muted)] mt-0.5">{description}</p>}
    </div>
  );
}

function SectionContainer({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-14">
      {children}
    </div>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className={`relative w-12 h-6 rounded-full transition-colors flex-shrink-0 ${checked ? "bg-[var(--color-primary-main)]" : "bg-[var(--color-surface-600)]"}`}
    >
      <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${checked ? "translate-x-6" : ""}`} />
    </button>
  );
}

function RangeInput({ min, max, step = 1, value, onChange, unit }: {
  min: number; max: number; step?: number; value: number; onChange: (v: number) => void; unit: string
}) {
  return (
    <div className="flex items-center gap-6 w-full max-w-xl">
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="flex-1 h-2 rounded-full bg-[var(--color-surface-700)] appearance-none outline-none accent-[var(--color-primary-main)] cursor-pointer"
      />
      <span className="text-[13px] font-medium text-[var(--color-text-primary)] min-w-[72px] text-right bg-[var(--color-surface-800)] px-3 py-1.5 rounded-lg border border-[var(--color-surface-700)] shadow-sm">
        {value} <span className="text-[var(--color-text-muted)] text-[11px]">{unit}</span>
      </span>
    </div>
  );
}

export default function SettingsPage() {
  const [tab, setTab]           = useState<Tab>("ai");
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [saved, setSaved]       = useState(false);
  const [showKey, setShowKey]   = useState(false);
  const [testing, setTesting]   = useState(false);
  const [testResult, setTestResult] = useState<{ available: boolean; error: string | null } | null>(null);

  const fetchSettings = useCallback(async () => {
    try {
      const data = await api.settings.get();
      setSettings(data);
    } catch (e) {
      console.error("Failed to load settings", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchSettings(); }, [fetchSettings]);

  function updateSetting(key: string, value: string) {
    setSettings((prev: AppSettings | null) => prev ? { ...prev, [key]: value } : prev);
    setSaved(false);
    setTestResult(null);
  }

  async function handleSave() {
    if (!settings) return;
    setSaving(true);
    try {
      await api.settings.update(settings);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      console.error("Failed to save settings", e);
    } finally {
      setSaving(false);
    }
  }

  async function handleTestAI() {
    setTesting(true);
    setTestResult(null);
    try {
      const result = await api.settings.testAI();
      setTestResult({ available: result.available, error: result.error });
    } catch {
      setTestResult({ available: false, error: "Request failed" });
    } finally {
      setTesting(false);
    }
  }

  if (loading || !settings) {
    return (
      <div className="flex items-center justify-center h-full bg-[var(--color-surface-950)]">
        <Loader2 className="w-8 h-8 animate-spin text-[var(--color-text-muted)]" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-[var(--color-surface-950)] overflow-hidden">
      
      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-10 py-8 flex-shrink-0">
        <div>
          <h2 className="text-lg md:text-xl font-medium tracking-tight text-[var(--color-text-primary)]">Settings</h2>
          <p className="text-[12px] md:text-[13px] text-[var(--color-text-secondary)] mt-0.5">Manage your SystemGuardian AI preferences.</p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[var(--color-primary-main)] text-white text-sm font-medium hover:bg-[var(--color-primary-hover)] transition-all shadow-[0_4px_14px_rgba(var(--color-brand-500-rgb),0.3)] disabled:opacity-60 disabled:shadow-none"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <CheckCircle2 className="w-4 h-4" /> : <Save className="w-4 h-4" />}
          {saving ? "Saving…" : saved ? "Saved" : "Save Changes"}
        </button>
      </div>

      <div className="flex flex-1 overflow-hidden px-4 pb-4">
        
        {/* ── Sidebar Navigation ─────────────────────────────── */}
        <nav className="w-72 flex-shrink-0 pr-8 overflow-y-auto pl-6">
          <div className="flex flex-col gap-2">
            {TABS.map(t => {
              const Icon = t.icon;
              const isActive = tab === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`w-full flex items-start gap-4 p-4 rounded-xl text-left transition-all ${
                    isActive
                      ? "bg-[var(--color-surface-900)] border border-[var(--color-surface-700)] shadow-sm"
                      : "hover:bg-[var(--color-surface-900)]/50 border border-transparent"
                  }`}
                >
                  <Icon className={`w-4 h-4 mt-0.5 ${isActive ? "text-[var(--color-primary-main)]" : "text-[var(--color-text-muted)]"}`} />
                  <div>
                    <div className={`text-[13px] font-medium ${isActive ? "text-[var(--color-text-primary)]" : "text-[var(--color-text-secondary)]"}`}>
                      {t.label}
                    </div>
                    <div className="text-[11px] text-[var(--color-text-muted)] mt-0.5">
                      {t.desc}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </nav>

        {/* ── Main Content Area ──────────────────────────────── */}
        <div className="flex-1 overflow-y-auto bg-[var(--color-surface-900)] rounded-2xl border border-[var(--color-surface-800)] shadow-sm">
          <div className="max-w-4xl p-12">
            
            {/* ── AI Provider Tab ── */}
            {tab === "ai" && (
              <div className="animate-fade-in">
                
                <SectionContainer>
                  <SectionHeader 
                    title="Active Provider" 
                    description="Choose which AI engine analyzes your system data."
                  />
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {(["ollama", "gemini"] as const).map(p => {
                      const isActive = settings.ai_provider === p;
                      return (
                        <button
                          key={p}
                          onClick={() => updateSetting("ai_provider", p)}
                          className={`flex items-start gap-5 p-6 rounded-2xl border-2 text-left transition-all ${
                            isActive
                              ? "border-[var(--color-primary-main)] bg-[var(--color-primary-main)]/5"
                              : "border-[var(--color-surface-700)] bg-[var(--color-surface-800)] hover:border-[var(--color-surface-600)]"
                          }`}
                        >
                          <div className={`p-3.5 rounded-xl ${isActive ? "bg-[var(--color-primary-main)]/20 text-[var(--color-primary-main)]" : "bg-[var(--color-surface-700)] text-[var(--color-text-muted)]"}`}>
                            <Bot className="w-6 h-6" />
                          </div>
                          <div>
                            <div className="font-medium text-[14px] text-[var(--color-text-primary)] mb-1.5">
                              {p === "ollama" ? "Ollama (Local)" : "Gemini (Cloud)"}
                            </div>
                            <div className="text-[12px] text-[var(--color-text-muted)] leading-relaxed">
                              {p === "ollama" ? "100% private. Runs entirely on your hardware. Recommended for security." : "Powered by Google. Faster and requires less system resources."}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </SectionContainer>

                <div className="w-full h-px bg-[var(--color-surface-800)] mb-14" />

                {settings.ai_provider === "ollama" && (
                  <SectionContainer>
                    <SectionHeader 
                      title="Ollama Configuration" 
                      description="Connect to your local Ollama instance."
                    />
                    <div className="flex flex-col gap-8 max-w-xl">
                      <div>
                        <label className="text-[13px] font-medium text-[var(--color-text-primary)] block mb-3">Server URL</label>
                        <input
                          type="text"
                          value={settings.ollama_base_url}
                          onChange={e => updateSetting("ollama_base_url", e.target.value)}
                          className="w-full px-5 py-3.5 bg-[var(--color-surface-800)] border border-[var(--color-surface-700)] rounded-xl text-[13px] text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-primary-main)] focus:ring-1 focus:ring-[var(--color-primary-main)] transition-all font-mono"
                          placeholder="http://localhost:11434"
                        />
                      </div>
                      <div>
                        <label className="text-[13px] font-medium text-[var(--color-text-primary)] block mb-3">Model Name</label>
                        <input
                          type="text"
                          value={settings.ollama_model}
                          onChange={e => updateSetting("ollama_model", e.target.value)}
                          className="w-full px-5 py-3.5 bg-[var(--color-surface-800)] border border-[var(--color-surface-700)] rounded-xl text-[13px] text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-primary-main)] focus:ring-1 focus:ring-[var(--color-primary-main)] transition-all font-mono"
                          placeholder="llama3.2"
                        />
                      </div>
                    </div>
                  </SectionContainer>
                )}

                {settings.ai_provider === "gemini" && (
                  <SectionContainer>
                    <SectionHeader 
                      title="Gemini Configuration" 
                      description="Provide your Google API key for cloud analysis."
                    />
                    <div className="max-w-xl">
                      <label className="text-[13px] font-medium text-[var(--color-text-primary)] block mb-3">API Key</label>
                      <div className="relative">
                        <input
                          type={showKey ? "text" : "password"}
                          value={settings.gemini_api_key}
                          onChange={e => updateSetting("gemini_api_key", e.target.value)}
                          className="w-full px-5 py-3.5 pr-14 bg-[var(--color-surface-800)] border border-[var(--color-surface-700)] rounded-xl text-[13px] text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-primary-main)] focus:ring-1 focus:ring-[var(--color-primary-main)] transition-all font-mono"
                          placeholder="AIza…"
                        />
                        <button
                          onClick={() => setShowKey(s => !s)}
                          className="absolute right-4 top-1/2 -translate-y-1/2 p-1.5 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] rounded-lg hover:bg-[var(--color-surface-700)] transition-colors"
                        >
                          {showKey ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                        </button>
                      </div>
                    </div>
                  </SectionContainer>
                )}

                <div className="p-6 rounded-2xl border border-[var(--color-surface-700)] bg-[var(--color-surface-950)] flex items-center justify-between mt-8 max-w-2xl">
                  <div>
                    <h4 className="text-[14px] font-medium text-[var(--color-text-primary)] mb-1">Test Connection</h4>
                    <p className="text-[12px] text-[var(--color-text-muted)]">Verify your provider is ready.</p>
                  </div>
                  <div className="flex items-center gap-6">
                    {testResult && (
                      <div className={`text-[13px] font-medium flex items-center gap-2 ${testResult.available ? "text-emerald-400" : "text-rose-400"}`}>
                        {testResult.available ? <CheckCircle2 className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
                        {testResult.available ? "Connected successfully" : testResult.error || "Unreachable"}
                      </div>
                    )}
                    <button
                      onClick={handleTestAI}
                      disabled={testing}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[var(--color-surface-800)] text-[13px] font-medium text-[var(--color-text-primary)] hover:bg-[var(--color-surface-700)] transition-colors border border-[var(--color-surface-600)] disabled:opacity-50"
                    >
                      {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                      Test
                    </button>
                  </div>
                </div>

              </div>
            )}

            {/* ── Monitoring Tab ── */}
            {tab === "monitoring" && (
              <div className="animate-fade-in">
                
                <SectionContainer>
                  <SectionHeader 
                    title="Collection Intervals" 
                    description="How frequently SystemGuardian gathers data."
                  />
                  <div className="flex flex-col gap-10">
                    <div>
                      <label className="text-[13px] font-medium text-[var(--color-text-primary)] block mb-1">Metrics Interval</label>
                      <p className="text-[12px] text-[var(--color-text-muted)] mb-5">Hardware metrics (CPU, RAM, Disk).</p>
                      <RangeInput
                        min={5} max={120} step={5}
                        value={Number(settings.metrics_interval_seconds)}
                        onChange={v => updateSetting("metrics_interval_seconds", String(v))}
                        unit="sec"
                      />
                    </div>
                    
                    <div className="w-full max-w-xl h-px bg-[var(--color-surface-800)]" />

                    <div>
                      <label className="text-[13px] font-medium text-[var(--color-text-primary)] block mb-1">Event Poll Interval</label>
                      <p className="text-[12px] text-[var(--color-text-muted)] mb-5">OS event logs and security checks.</p>
                      <RangeInput
                        min={15} max={300} step={15}
                        value={Number(settings.event_poll_interval_seconds)}
                        onChange={v => updateSetting("event_poll_interval_seconds", String(v))}
                        unit="sec"
                      />
                    </div>
                  </div>
                </SectionContainer>

                <div className="w-full h-px bg-[var(--color-surface-800)] mb-14" />

                <SectionContainer>
                  <SectionHeader 
                    title="Data Collectors" 
                    description="Enable or disable specific telemetry modules. Disabling modules reduces system overhead."
                  />
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {MODULE_LIST.map(m => {
                      const Icon = m.icon;
                      const enabled = settings[m.key] === "true";
                      return (
                        <div
                          key={m.key}
                          className={`flex items-center justify-between p-5 rounded-2xl border transition-all ${
                            enabled
                              ? "border-[var(--color-surface-700)] bg-[var(--color-surface-800)] shadow-sm"
                              : "border-[var(--color-surface-800)] bg-[var(--color-surface-900)]/50 opacity-60 grayscale-[20%]"
                          }`}
                        >
                          <div className="flex items-center gap-4">
                            <div className={`p-2.5 rounded-xl ${enabled ? "bg-[var(--color-primary-main)]/15 text-[var(--color-primary-main)]" : "bg-[var(--color-surface-700)] text-[var(--color-text-muted)]"}`}>
                              <Icon className="w-5 h-5" />
                            </div>
                            <div>
                              <div className="text-[14px] font-medium text-[var(--color-text-primary)]">{m.label}</div>
                              <div className="text-[12px] text-[var(--color-text-muted)] mt-1">{m.desc}</div>
                            </div>
                          </div>
                          <Toggle checked={enabled} onChange={v => updateSetting(m.key, String(v))} />
                        </div>
                      );
                    })}
                  </div>
                </SectionContainer>

              </div>
            )}

            {/* ── Notifications Tab ── */}
            {tab === "notifications" && (
              <div className="animate-fade-in">
                
                <SectionContainer>
                  <SectionHeader 
                    title="Notification Threshold" 
                    description="Choose the minimum severity required to trigger a desktop notification."
                  />
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-3xl">
                    {(["critical", "high", "warning"] as const).map(s => {
                      const colors: Record<string, string> = { critical: "text-red-400 border-red-500/40 bg-red-500/5", high: "text-orange-400 border-orange-500/40 bg-orange-500/5", warning: "text-yellow-400 border-yellow-500/40 bg-yellow-500/5" };
                      const isSelected = settings.notification_min_severity === s;
                      return (
                        <button
                          key={s}
                          onClick={() => updateSetting("notification_min_severity", s)}
                          className={`p-6 rounded-2xl border transition-all flex flex-col items-center justify-center gap-3 ${
                            isSelected 
                              ? colors[s] + " shadow-md"
                              : "border-[var(--color-surface-700)] bg-[var(--color-surface-800)] text-[var(--color-text-muted)] hover:border-[var(--color-surface-600)] hover:bg-[var(--color-surface-700)]"
                          }`}
                        >
                          <span className="text-xl">{s === "critical" ? "🔴" : s === "high" ? "🟠" : "🟡"}</span>
                          <span className="text-[14px] font-medium capitalize">{s} Only</span>
                        </button>
                      );
                    })}
                  </div>
                </SectionContainer>

                <div className="w-full max-w-3xl h-px bg-[var(--color-surface-800)] mb-14" />

                <SectionContainer>
                  <SectionHeader 
                    title="Notification Cooldown" 
                    description="Prevents the same alert from firing multiple times within this period."
                  />
                  <div className="mt-8">
                    <RangeInput
                      min={5} max={60} step={5}
                      value={Number(settings.notification_cooldown_minutes)}
                      onChange={v => updateSetting("notification_cooldown_minutes", String(v))}
                      unit="min"
                    />
                  </div>
                </SectionContainer>

              </div>
            )}

            {/* ── Data & Privacy Tab ── */}
            {tab === "data" && (
              <div className="animate-fade-in">
                
                <SectionContainer>
                  <SectionHeader 
                    title="Data Retention" 
                    description="Control how long SystemGuardian stores your historical system data."
                  />
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-10 max-w-3xl">
                    <div>
                      <label className="text-[13px] font-medium text-[var(--color-text-primary)] block mb-1">Event Retention</label>
                      <p className="text-[12px] text-[var(--color-text-muted)] mb-5">Events older than this are purged nightly.</p>
                      
                      <div className="flex bg-[var(--color-surface-800)] p-1.5 rounded-xl border border-[var(--color-surface-700)] shadow-sm">
                        {["7", "30", "90", "180"].map(d => (
                          <button
                            key={d}
                            onClick={() => updateSetting("event_retention_days", d)}
                            className={`flex-1 py-1.5 text-[13px] font-medium rounded-lg transition-all ${
                              settings.event_retention_days === d
                                ? "bg-[var(--color-surface-600)] text-[var(--color-text-primary)] shadow-sm"
                                : "text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
                            }`}
                          >
                            {d}d
                          </button>
                        ))}
                      </div>
                    </div>
                    
                    <div>
                      <label className="text-[13px] font-medium text-[var(--color-text-primary)] block mb-1">Metric Retention</label>
                      <p className="text-[12px] text-[var(--color-text-muted)] mb-5">Performance history older than this is purged.</p>
                      
                      <div className="flex bg-[var(--color-surface-800)] p-1.5 rounded-xl border border-[var(--color-surface-700)] shadow-sm">
                        {["7", "14", "30", "90"].map(d => (
                          <button
                            key={d}
                            onClick={() => updateSetting("metric_retention_days", d)}
                            className={`flex-1 py-1.5 text-[13px] font-medium rounded-lg transition-all ${
                              settings.metric_retention_days === d
                                ? "bg-[var(--color-surface-600)] text-[var(--color-text-primary)] shadow-sm"
                                : "text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
                            }`}
                          >
                            {d}d
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </SectionContainer>

                <div className="w-full max-w-3xl h-px bg-[var(--color-surface-800)] mb-14" />

                <SectionContainer>
                  <SectionHeader 
                    title="Privacy & Storage" 
                    description="Your data never leaves your device."
                  />
                  <div className="flex items-start gap-6 p-8 rounded-2xl bg-[var(--color-surface-950)] border border-[var(--color-surface-800)] max-w-3xl">
                    <div className="p-3.5 rounded-xl bg-[var(--color-primary-main)]/10 text-[var(--color-primary-main)] mt-1">
                      <Database className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-[14px] font-medium text-[var(--color-text-primary)] mb-1">Local Storage Guarantee</h4>
                      <p className="text-[12px] text-[var(--color-text-muted)] leading-relaxed">
                        All system data, events, metrics, reports, and AI analysis are stored exclusively in a local SQLite database on your machine.
                        No telemetry is collected. No data leaves your device unless you explicitly configure a cloud AI provider (like Gemini).
                      </p>
                    </div>
                  </div>
                </SectionContainer>

              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Bell, BellOff, Check, CheckCheck, Trash2, AlertTriangle, Info, ShieldAlert, Zap, X } from "lucide-react";
import { api } from "@/lib/api-client";
import { NotificationRead } from "@/lib/types";

// ── Severity config ──────────────────────────────────────────────────────────
const severityConfig: Record<string, { icon: React.ElementType; color: string; bg: string; border: string }> = {
  critical: { icon: AlertTriangle, color: "text-red-400",    bg: "bg-red-500/10",    border: "border-l-red-500" },
  high:     { icon: ShieldAlert,   color: "text-orange-400", bg: "bg-orange-500/10", border: "border-l-orange-500" },
  warning:  { icon: Zap,           color: "text-yellow-400", bg: "bg-yellow-500/10", border: "border-l-yellow-500" },
  info:     { icon: Info,          color: "text-blue-400",   bg: "bg-blue-500/10",   border: "border-l-blue-500" },
  low:      { icon: Info,          color: "text-slate-400",  bg: "bg-slate-500/10",  border: "border-l-slate-500" },
};

function getSeverityConfig(severity: string) {
  return severityConfig[severity?.toLowerCase()] ?? severityConfig.info;
}

function timeAgo(date: string) {
  const diff = (Date.now() - new Date(date).getTime()) / 1000;
  if (diff < 60)    return `${Math.floor(diff)}s ago`;
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return new Date(date).toLocaleDateString();
}

export function NotificationBell() {
  const [isOpen, setIsOpen]               = useState(false);
  const [notifications, setNotifications] = useState<NotificationRead[]>([]);
  const [unreadCount, setUnreadCount]     = useState(0);
  const [loading, setLoading]             = useState(false);
  const [tab, setTab]                     = useState<"all" | "unread">("all");
  const panelRef                          = useRef<HTMLDivElement>(null);
  const bellRef                           = useRef<HTMLButtonElement>(null);

  // ── Close panel when clicking outside ─────────────────────────────────────
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        isOpen &&
        panelRef.current &&
        bellRef.current &&
        !panelRef.current.contains(e.target as Node) &&
        !bellRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  // ── Close on Escape key ────────────────────────────────────────────────────
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape" && isOpen) setIsOpen(false);
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [isOpen]);

  // ── Initial fetch + polling ────────────────────────────────────────────────
  const fetchAll = useCallback(async () => {
    try {
      const [countRes, list] = await Promise.all([
        api.notifications.getUnreadCount(),
        api.notifications.list(50),
      ]);
      setUnreadCount(countRes.count);
      setNotifications(list);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    fetchAll();
    const interval = setInterval(fetchAll, 30_000);
    return () => clearInterval(interval);
  }, [fetchAll]);

  // ── Toggle panel ──────────────────────────────────────────────────────────
  async function togglePanel() {
    if (!isOpen) {
      setLoading(true);
      try {
        const [countRes, list] = await Promise.all([
          api.notifications.getUnreadCount(),
          api.notifications.list(50),
        ]);
        setUnreadCount(countRes.count);
        setNotifications(list);
      } catch { /* ignore */ }
      setLoading(false);
    }
    setIsOpen(prev => !prev);
  }

  // ── Mark single as read ───────────────────────────────────────────────────
  async function markOneRead(id: string) {
    try {
      await api.notifications.markAsRead(id);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch { /* ignore */ }
  }

  // ── Mark all as read ──────────────────────────────────────────────────────
  async function markAllRead() {
    try {
      await api.notifications.markAllAsRead();
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch { /* ignore */ }
  }

  const displayed = tab === "unread"
    ? notifications.filter(n => !n.is_read)
    : notifications;

  const hasUnread = unreadCount > 0;

  return (
    <div className="relative pointer-events-auto">
      {/* ── Bell Button ───────────────────────────────────────────────────── */}
      <button
        ref={bellRef}
        onClick={togglePanel}
        aria-label="Toggle notifications"
        className={`relative p-2 rounded-lg transition-all duration-200 ${
          isOpen
            ? "bg-[var(--color-primary-main)]/20 text-[var(--color-primary-main)] ring-1 ring-[var(--color-primary-main)]/40"
            : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-700)]"
        }`}
      >
        <Bell size={18} className={hasUnread ? "animate-[wiggle_0.5s_ease-in-out]" : ""} />
        {/* Unread badge */}
        {hasUnread && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-black text-white shadow-lg ring-2 ring-[var(--color-surface-800)]">
            {unreadCount > 99 ? "99+" : unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* ── Notification Panel ────────────────────────────────────────────── */}
      {isOpen && (
        <div
          ref={panelRef}
          className="absolute right-0 top-[calc(100%+8px)] w-96 rounded-xl border border-[var(--color-surface-600)] bg-[var(--color-surface-900)] shadow-2xl z-[200] flex flex-col overflow-hidden"
          style={{
            animation: "notifSlideDown 0.2s ease",
            maxHeight: "calc(100vh - 80px)",
            boxShadow: "0 24px 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.04)",
          }}
        >
          {/* ── Header ───────────────────────────────────────────────────── */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-surface-700)] bg-[var(--color-surface-800)] flex-shrink-0">
            <div className="flex items-center gap-2.5">
              <Bell size={14} className="text-[var(--color-primary-main)]" />
              <h3 className="text-sm font-bold text-[var(--color-text-primary)]">Notifications</h3>
              {hasUnread && (
                <span className="px-1.5 py-0.5 rounded-full bg-red-500/20 text-red-400 text-[10px] font-bold border border-red-500/30">
                  {unreadCount} new
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              {hasUnread && (
                <button
                  onClick={markAllRead}
                  title="Mark all as read"
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-700)] transition-colors"
                >
                  <CheckCheck size={12} />
                  All read
                </button>
              )}
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 rounded-md text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-700)] transition-colors ml-1"
              >
                <X size={14} />
              </button>
            </div>
          </div>

          {/* ── Tabs ─────────────────────────────────────────────────────── */}
          <div className="flex border-b border-[var(--color-surface-700)] bg-[var(--color-surface-800)] flex-shrink-0">
            {(["all", "unread"] as const).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex-1 py-2 text-xs font-semibold uppercase tracking-wider transition-colors ${
                  tab === t
                    ? "text-[var(--color-primary-main)] border-b-2 border-[var(--color-primary-main)] -mb-px"
                    : "text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
                }`}
              >
                {t}
                {t === "unread" && unreadCount > 0 && (
                  <span className="ml-1.5 text-[9px] bg-red-500/20 text-red-400 px-1 rounded-full">{unreadCount}</span>
                )}
              </button>
            ))}
          </div>

          {/* ── List ─────────────────────────────────────────────────────── */}
          <div className="flex-1 overflow-y-auto min-h-0" style={{ maxHeight: "400px" }}>
            {loading ? (
              <div className="flex flex-col items-center justify-center py-12 gap-3">
                <div className="w-5 h-5 border-2 border-[var(--color-primary-main)] border-t-transparent rounded-full animate-spin" />
                <p className="text-xs text-[var(--color-text-muted)]">Loading…</p>
              </div>
            ) : displayed.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-14 gap-3">
                <div className="p-4 rounded-xl bg-[var(--color-surface-800)] border border-[var(--color-surface-700)]">
                  <BellOff size={24} className="text-[var(--color-text-muted)]" />
                </div>
                <p className="text-sm font-medium text-[var(--color-text-secondary)]">
                  {tab === "unread" ? "All caught up!" : "No notifications yet"}
                </p>
                <p className="text-xs text-[var(--color-text-muted)] text-center px-6">
                  {tab === "unread"
                    ? "You have no unread notifications."
                    : "System alerts, security events, and predictions will appear here."}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-[var(--color-surface-700)]/50">
                {displayed.map(n => {
                  const cfg = getSeverityConfig(n.severity);
                  const Icon = cfg.icon;
                  return (
                    <div
                      key={n.id}
                      className={`group relative flex gap-3 px-4 py-3.5 transition-all duration-150 border-l-2 ${cfg.border} ${
                        !n.is_read
                          ? `${cfg.bg} hover:brightness-110`
                          : "border-l-transparent hover:bg-[var(--color-surface-800)]/60"
                      }`}
                    >
                      {/* Icon */}
                      <div className={`flex-shrink-0 p-1.5 rounded-lg mt-0.5 ${cfg.bg}`}>
                        <Icon size={14} className={cfg.color} />
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p className={`text-sm font-semibold leading-tight ${n.is_read ? "text-[var(--color-text-secondary)]" : "text-[var(--color-text-primary)]"}`}>
                            {n.title}
                          </p>
                          {!n.is_read && (
                            <span className="w-2 h-2 rounded-full bg-[var(--color-primary-main)] flex-shrink-0 mt-1.5 shadow-[0_0_6px_currentColor]" />
                          )}
                        </div>
                        <p className="text-xs text-[var(--color-text-muted)] mt-1 leading-relaxed line-clamp-2">
                          {n.message}
                        </p>
                        <div className="flex items-center justify-between mt-2">
                          <span className="text-[10px] text-[var(--color-text-muted)]">{timeAgo(n.created_at)}</span>
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            {!n.is_read && (
                              <button
                                onClick={() => markOneRead(n.id)}
                                title="Mark as read"
                                className="p-1 rounded hover:bg-[var(--color-surface-700)] text-[var(--color-text-muted)] hover:text-[var(--color-primary-main)] transition-colors"
                              >
                                <Check size={11} />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ── Footer ───────────────────────────────────────────────────── */}
          {notifications.length > 0 && (
            <div className="px-4 py-2.5 border-t border-[var(--color-surface-700)] bg-[var(--color-surface-800)] flex-shrink-0 flex items-center justify-between">
              <span className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider">
                {notifications.length} notification{notifications.length !== 1 ? "s" : ""}
              </span>
              <span className="text-[10px] text-[var(--color-text-muted)]">
                Press <kbd className="px-1 py-0.5 rounded bg-[var(--color-surface-700)] font-mono text-[9px]">Esc</kbd> to close
              </span>
            </div>
          )}
        </div>
      )}

      <style>{`
        @keyframes notifSlideDown {
          from { opacity: 0; transform: translateY(-8px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0)   scale(1); }
        }
        @keyframes wiggle {
          0%, 100% { transform: rotate(0deg); }
          25%       { transform: rotate(-10deg); }
          75%       { transform: rotate(10deg); }
        }
      `}</style>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { api } from "@/lib/api-client";
import { NotificationRead } from "@/lib/types";

export function NotificationBell() {
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<NotificationRead[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 60_000);
    return () => clearInterval(interval);
  }, []);

  async function fetchUnreadCount() {
    try {
      const result = await api.notifications.getUnreadCount();
      setUnreadCount(result.count);
    } catch {
      // ignore
    }
  }

  async function handleOpen() {
    if (!isOpen) {
      try {
        const list = await api.notifications.list(10);
        setNotifications(list);
      } catch {
        // ignore
      }
    }
    setIsOpen(!isOpen);
  }

  async function markAllRead() {
    try {
      await api.notifications.markAllAsRead();
      setUnreadCount(0);
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    } catch {
      // ignore
    }
  }

  return (
    <div className="relative pointer-events-auto">
      <button 
        onClick={handleOpen}
        className="relative p-2 rounded-md text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-700)] transition-colors"
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 flex h-3 w-3 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-80 rounded-lg border border-[var(--color-surface-600)] bg-[var(--color-surface-800)] shadow-xl z-50 overflow-hidden flex flex-col">
          <div className="flex items-center justify-between p-3 border-b border-[var(--color-surface-600)] bg-[var(--color-surface-700)]">
            <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">Notifications</h3>
            {unreadCount > 0 && (
              <button 
                onClick={markAllRead}
                className="text-xs text-[var(--color-primary-main)] hover:text-white transition-colors"
              >
                Mark all as read
              </button>
            )}
          </div>
          
          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="p-4 text-center text-sm text-[var(--color-text-muted)]">
                No notifications right now.
              </div>
            ) : (
              <div className="flex flex-col">
                {notifications.map(n => (
                  <div 
                    key={n.id} 
                    className={`p-3 border-b border-[var(--color-surface-600)] flex flex-col gap-1 hover:bg-[var(--color-surface-700)] transition-colors cursor-default ${!n.is_read ? 'bg-[var(--color-surface-700)]' : ''}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-sm font-medium text-[var(--color-text-primary)] leading-tight">{n.title}</span>
                      {!n.is_read && <span className="w-2 h-2 rounded-full bg-[var(--color-primary-main)] flex-shrink-0 mt-1" />}
                    </div>
                    <span className="text-xs text-[var(--color-text-secondary)] leading-snug line-clamp-2">{n.message}</span>
                    <span className="text-[10px] text-[var(--color-text-muted)] mt-1">{new Date(n.created_at).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, Check, CheckCheck, FileText } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { LoadingBlock } from '@/components/ui/Spinner';
import { cn } from '@/lib/cn';
import type { NotificationType } from '@/types/database';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface NotificationItem {
  id: string;
  type: NotificationType;
  complaint_id: string | null;
  title: string;
  body: string | null;
  tracking_id: string | null;
  is_read: boolean;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TYPE_LABELS: Record<NotificationType, string> = {
  status_change: 'Status Update',
  assignment: 'Assignment',
  resolution: 'Resolution',
  case_update: 'Update',
  escalation: 'Escalation',
};

const TYPE_TONES: Record<NotificationType, 'info' | 'success' | 'warning' | 'purple'> = {
  status_change: 'info',
  assignment: 'purple',
  resolution: 'success',
  case_update: 'warning',
  escalation: 'warning',
};

function formatTimeAgo(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
}

// ---------------------------------------------------------------------------
// Notification Item
// ---------------------------------------------------------------------------

function NotificationItemCard({
  notification,
  onMarkRead,
}: {
  notification: NotificationItem;
  onMarkRead: (id: string) => void;
}) {
  const router = useRouter();

  function handleClick() {
    if (!notification.is_read) {
      onMarkRead(notification.id);
    }
    if (notification.tracking_id) {
      router.push(`/complaints/${notification.tracking_id}`);
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className={cn(
        'flex w-full gap-4 rounded-xl border p-4 text-left transition',
        notification.is_read
          ? 'border-slate-100 bg-white'
          : 'border-blue-200 bg-blue-50/50',
        'hover:border-slate-300 hover:shadow-sm',
      )}
    >
      <div
        className={cn(
          'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
          notification.is_read ? 'bg-slate-100 text-slate-500' : 'bg-blue-100 text-blue-700',
        )}
      >
        <Bell className="h-5 w-5" aria-hidden="true" />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className={cn(
            'text-sm',
            notification.is_read ? 'font-medium text-slate-700' : 'font-bold text-slate-900',
          )}>
            {notification.title}
          </p>
          {!notification.is_read && (
            <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-blue-600" aria-label="Unread" />
          )}
        </div>
        {notification.body && (
          <p className="mt-1 text-xs text-slate-600 line-clamp-2">
            {notification.body}
          </p>
        )}
        <div className="mt-2 flex items-center gap-3">
          <Badge tone={TYPE_TONES[notification.type]}>
            {TYPE_LABELS[notification.type]}
          </Badge>
          {notification.tracking_id && (
            <span className="font-mono text-xs text-slate-500">
              {notification.tracking_id}
            </span>
          )}
          <span className="text-xs text-slate-400">
            {formatTimeAgo(notification.created_at)}
          </span>
        </div>
      </div>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Notification Center
// ---------------------------------------------------------------------------

export function NotificationCenter({
  initialNotifications,
}: {
  initialNotifications: NotificationItem[];
}) {
  const [notifications, setNotifications] = useState(initialNotifications);
  const [loading, setLoading] = useState(false);
  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch('/api/notifications');
      const json = await res.json();
      if (res.ok) setNotifications(json.notifications ?? []);
    } catch {
      // Silent
    }
  }, []);

  async function handleMarkRead(id: string) {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)),
    );
    try {
      await fetch(`/api/notifications/${id}/read`, { method: 'POST' });
    } catch {
      // Silent
    }
  }

  async function handleMarkAllRead() {
    setLoading(true);
    try {
      await fetch('/api/notifications/read-all', { method: 'POST' });
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    } catch {
      // Silent
    } finally {
      setLoading(false);
    }
  }

  if (notifications.length === 0) {
    return (
      <Card className="py-12 text-center">
        <Bell className="mx-auto h-12 w-12 text-slate-300" aria-hidden="true" />
        <p className="mt-4 text-base font-medium text-slate-600">
          No notifications yet
        </p>
        <p className="mt-1 text-sm text-slate-500">
          You will be notified when your complaints are updated.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-600">
          {unreadCount > 0
            ? `${unreadCount} unread notification${unreadCount !== 1 ? 's' : ''}`
            : 'All caught up'}
        </p>
        {unreadCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleMarkAllRead}
            loading={loading}
          >
            <CheckCheck className="h-4 w-4" aria-hidden="true" />
            Mark all read
          </Button>
        )}
      </div>

      <div className="space-y-2">
        {notifications.map((n) => (
          <NotificationItemCard
            key={n.id}
            notification={n}
            onMarkRead={handleMarkRead}
          />
        ))}
      </div>
    </div>
  );
}

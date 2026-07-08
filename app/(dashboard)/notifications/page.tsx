'use client';

import { useMemo } from 'react';
import { Bell } from 'lucide-react';
import { format, isToday, isYesterday, startOfDay } from 'date-fns';
import { NotificationRow } from '@/components/notifications/notification-row';
import { useAppNotifications } from '@/hooks/use-app-notifications';

function groupLabel(date: Date): string {
  if (isToday(date)) return 'Today';
  if (isYesterday(date)) return 'Yesterday';
  return format(date, 'MMMM d, yyyy');
}

export default function NotificationsPage() {
  const { notifications, loading, isRead, markAsRead } = useAppNotifications();

  const grouped = useMemo(() => {
    const groups = new Map<string, typeof notifications>();

    for (const item of notifications) {
      const day = startOfDay(new Date(item.timestamp));
      const key = day.toISOString();
      const existing = groups.get(key) ?? [];
      existing.push(item);
      groups.set(key, existing);
    }

    return Array.from(groups.entries())
      .sort(([a], [b]) => new Date(b).getTime() - new Date(a).getTime())
      .map(([key, items]) => ({
        label: groupLabel(new Date(key)),
        items,
      }));
  }, [notifications]);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Notifications</h1>
        <p className="text-sm text-muted-foreground">
          Maintenance, faults, projects, and customer updates
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading notifications…</p>
      ) : notifications.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border bg-card py-16 text-center">
          <Bell className="mb-3 h-10 w-10 text-muted-foreground/40" />
          <p className="text-sm font-medium">No notifications</p>
          <p className="mt-1 text-xs text-muted-foreground">You&apos;re all caught up</p>
        </div>
      ) : (
        <div className="space-y-8">
          {grouped.map((group) => (
            <section key={group.label}>
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {group.label}
              </h2>
              <div className="divide-y rounded-xl border bg-card">
                {group.items.map((item) => (
                  <NotificationRow
                    key={item.id}
                    item={item}
                    isRead={isRead(item.id)}
                    onMarkRead={markAsRead}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

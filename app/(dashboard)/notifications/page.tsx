'use client';

import { useMemo, useState } from 'react';
import { Bell, Search } from 'lucide-react';
import { format, isToday, isYesterday, startOfDay } from 'date-fns';
import { NotificationRow } from '@/components/notifications/notification-row';
import { InventoryReturnDecisionDialog } from '@/components/notifications/inventory-return-decision-dialog';
import { useAppNotifications } from '@/hooks/use-app-notifications';
import { useAuth } from '@/lib/auth-context';
import { parseApiDate } from '@/lib/parse-api-date';
import { Input } from '@/components/ui/input';
import { useDebouncedValue } from '@/hooks/use-debounced-value';

function groupLabel(date: Date): string {
  if (isToday(date)) return 'Today';
  if (isYesterday(date)) return 'Yesterday';
  return format(date, 'MMMM d, yyyy');
}

export default function NotificationsPage() {
  const { isInventoryManager } = useAuth();
  const inventoryManager = isInventoryManager();
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 250);
  const {
    notifications,
    loading,
    isRead,
    markAsRead,
    returnDialogNotice,
    setReturnDialogOpen,
    handleNotificationActivate,
    refreshReturnNotices,
    refreshInstallerNotices,
  } = useAppNotifications({ search: debouncedSearch });

  const grouped = useMemo(() => {
    const groups = new Map<string, typeof notifications>();

    for (const item of notifications) {
      const day = startOfDay(parseApiDate(item.timestamp));
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
          {inventoryManager
            ? 'Full notification history — search across all inventory notices and system alerts'
            : 'Your notification history — inventory issued to you and return decisions'}
        </p>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={
            inventoryManager
              ? 'Search all notifications…'
              : 'Search your notifications…'
          }
          className="pl-9"
        />
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading notifications…</p>
      ) : notifications.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border bg-card py-16 text-center">
          <Bell className="mb-3 h-10 w-10 text-muted-foreground/40" />
          <p className="text-sm font-medium">
            {search.trim() ? 'No matching notifications' : 'No notifications'}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {search.trim()
              ? 'Try a different search term'
              : "You're all caught up"}
          </p>
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
                    onActivate={handleNotificationActivate}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      <InventoryReturnDecisionDialog
        notice={returnDialogNotice}
        open={returnDialogNotice != null}
        onOpenChange={setReturnDialogOpen}
        onDecided={() => {
          void refreshReturnNotices();
          void refreshInstallerNotices();
        }}
      />
    </div>
  );
}

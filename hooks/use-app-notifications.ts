'use client';

import { useMemo } from 'react';
import { useDataStore } from '@/lib/data-store';
import { buildAppNotifications, type AppNotification } from '@/lib/app-notifications';
import { useNotificationState } from '@/hooks/use-notification-state';

export function useAppNotifications() {
  const { maintenanceCases, faultyEntities, projects, customers, loading } = useDataStore();
  const { hydrated, isRead, isCleared, markAsRead, markAllAsRead, clearAll } =
    useNotificationState();

  const allNotifications = useMemo(
    () =>
      buildAppNotifications({
        maintenanceCases,
        faultyEntities,
        projects,
        customers,
      }),
    [maintenanceCases, faultyEntities, projects, customers]
  );

  const notifications = useMemo(
    () => (hydrated ? allNotifications.filter((n) => !isCleared(n.id)) : allNotifications),
    [allNotifications, hydrated, isCleared]
  );

  const unreadCount = useMemo(
    () => (hydrated ? notifications.filter((n) => !isRead(n.id)).length : notifications.length),
    [notifications, hydrated, isRead]
  );

  const highPriorityCount = useMemo(
    () => notifications.filter((n) => n.priority === 'high' && !isRead(n.id)).length,
    [notifications, isRead]
  );

  return {
    notifications,
    allNotifications,
    unreadCount,
    highPriorityCount,
    loading,
    isRead,
    markAsRead,
    markAllAsRead: () => markAllAsRead(notifications.map((n) => n.id)),
    clearAll: () => clearAll(notifications.map((n) => n.id)),
  };
}

export type { AppNotification };

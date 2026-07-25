'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useDataStore } from '@/lib/data-store';
import { buildAppNotifications } from '@/lib/app-notifications';
import { useNotificationState } from '@/hooks/use-notification-state';
import { useAuth } from '@/lib/auth-context';
import * as api from '@/lib/api';
import type { InventoryReturnNotice } from '@/lib/models';

export function useAppNotifications() {
  const { maintenanceCases, faultyEntities, projects, customers, loading } = useDataStore();
  const { isInventoryManager } = useAuth();
  const {
    hydrated,
    isRead,
    isCleared,
    markAsRead: markLocalRead,
    markAllAsRead: markLocalAllRead,
    clearAll: clearLocal,
  } = useNotificationState();
  const [returnNotices, setReturnNotices] = useState<InventoryReturnNotice[]>([]);

  const loadReturnNotices = useCallback(async () => {
    if (!isInventoryManager()) {
      setReturnNotices([]);
      return;
    }
    try {
      const res = await api.inventory.listReturnNotices(true);
      setReturnNotices(res.data ?? []);
    } catch {
      setReturnNotices([]);
    }
  }, [isInventoryManager]);

  useEffect(() => {
    void loadReturnNotices();
    const id = window.setInterval(() => void loadReturnNotices(), 60_000);
    return () => window.clearInterval(id);
  }, [loadReturnNotices]);

  const allNotifications = useMemo(
    () =>
      buildAppNotifications({
        maintenanceCases,
        faultyEntities,
        projects,
        customers,
        inventoryReturnNotices: returnNotices,
      }),
    [maintenanceCases, faultyEntities, projects, customers, returnNotices]
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

  const markAsRead = useCallback(
    (id: string) => {
      markLocalRead(id);
      const n = notifications.find((x) => x.id === id);
      if (n?.type === 'inventory_returned' && n.metaId != null) {
        void api.inventory.markReturnNoticeRead(n.metaId).then(() => {
          setReturnNotices((prev) => prev.filter((x) => x.id !== n.metaId));
        });
      }
    },
    [markLocalRead, notifications]
  );

  const markAllAsRead = useCallback(() => {
    markLocalAllRead(notifications.map((n) => n.id));
    if (isInventoryManager()) {
      void api.inventory.markAllReturnNoticesRead().then(() => setReturnNotices([]));
    }
  }, [markLocalAllRead, notifications, isInventoryManager]);

  const clearAll = useCallback(() => {
    clearLocal(notifications.map((n) => n.id));
  }, [clearLocal, notifications]);

  return {
    notifications,
    unreadCount,
    highPriorityCount,
    loading: loading || !hydrated,
    isRead,
    markAsRead,
    markAllAsRead,
    clearAll,
    refreshReturnNotices: loadReturnNotices,
  };
}

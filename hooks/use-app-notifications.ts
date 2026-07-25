'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useDataStore } from '@/lib/data-store';
import { buildAppNotifications, type AppNotification } from '@/lib/app-notifications';
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
  const [returnDialogNotice, setReturnDialogNotice] = useState<InventoryReturnNotice | null>(
    null
  );

  const loadReturnNotices = useCallback(async () => {
    if (!isInventoryManager()) {
      setReturnNotices([]);
      return;
    }
    try {
      const res = await api.inventory.listReturnNotices({ pendingOnly: true });
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
    () =>
      hydrated
        ? allNotifications.filter((n) => {
            // Pending inventory returns stay until admin decides — not clearable.
            if (n.type === 'inventory_returned') return true;
            return !isCleared(n.id);
          })
        : allNotifications,
    [allNotifications, hydrated, isCleared]
  );

  const isNotificationRead = useCallback(
    (id: string) => {
      const n = notifications.find((x) => x.id === id);
      if (n?.type === 'inventory_returned') return false;
      return isRead(id);
    },
    [notifications, isRead]
  );

  const unreadCount = useMemo(
    () =>
      hydrated
        ? notifications.filter((n) => !isNotificationRead(n.id)).length
        : notifications.length,
    [notifications, hydrated, isNotificationRead]
  );

  const highPriorityCount = useMemo(
    () => notifications.filter((n) => n.priority === 'high' && !isNotificationRead(n.id)).length,
    [notifications, isNotificationRead]
  );

  const openReturnDecision = useCallback(
    (noticeId: number) => {
      const notice = returnNotices.find((n) => n.id === noticeId) ?? null;
      if (notice) setReturnDialogNotice(notice);
    },
    [returnNotices]
  );

  const handleNotificationActivate = useCallback(
    (item: AppNotification) => {
      if (item.type === 'inventory_returned' && item.metaId != null) {
        openReturnDecision(item.metaId);
        return;
      }
      markLocalRead(item.id);
    },
    [openReturnDecision, markLocalRead]
  );

  const markAsRead = useCallback(
    (id: string) => {
      const n = notifications.find((x) => x.id === id);
      if (n?.type === 'inventory_returned') {
        if (n.metaId != null) openReturnDecision(n.metaId);
        return;
      }
      markLocalRead(id);
    },
    [markLocalRead, notifications, openReturnDecision]
  );

  const markAllAsRead = useCallback(() => {
    markLocalAllRead(
      notifications.filter((n) => n.type !== 'inventory_returned').map((n) => n.id)
    );
  }, [markLocalAllRead, notifications]);

  const clearAll = useCallback(() => {
    clearLocal(notifications.filter((n) => n.type !== 'inventory_returned').map((n) => n.id));
  }, [clearLocal, notifications]);

  const closeReturnDialog = useCallback((open: boolean) => {
    if (!open) setReturnDialogNotice(null);
  }, []);

  return {
    notifications,
    unreadCount,
    highPriorityCount,
    loading: loading || !hydrated,
    isRead: isNotificationRead,
    markAsRead,
    markAllAsRead,
    clearAll,
    refreshReturnNotices: loadReturnNotices,
    returnDialogNotice,
    setReturnDialogOpen: closeReturnDialog,
    handleNotificationActivate,
    openReturnDecision,
  };
}

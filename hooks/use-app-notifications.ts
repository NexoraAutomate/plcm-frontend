'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { useDataStore } from '@/lib/data-store';
import { buildAppNotifications, type AppNotification } from '@/lib/app-notifications';
import { useNotificationState } from '@/hooks/use-notification-state';
import { useAuth } from '@/lib/auth-context';
import * as api from '@/lib/api';
import type { InventoryInstallerNotice, InventoryReturnNotice } from '@/lib/models';

const INSTALLER_NOTICE_TYPES = new Set([
  'inventory_issued',
  'inventory_return_accepted',
  'inventory_return_rejected',
]);

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
  const [installerNotices, setInstallerNotices] = useState<InventoryInstallerNotice[]>([]);
  const [returnDialogNotice, setReturnDialogNotice] = useState<InventoryReturnNotice | null>(
    null
  );
  const seenInstallerIds = useRef<Set<number>>(new Set());
  const installerToastReady = useRef(false);

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

  const loadInstallerNotices = useCallback(async () => {
    try {
      const res = await api.inventory.listInstallerNotices({ unreadOnly: true });
      const rows = res.data ?? [];
      if (installerToastReady.current) {
        for (const row of rows) {
          if (seenInstallerIds.current.has(row.id)) continue;
          seenInstallerIds.current.add(row.id);
          toast.info(row.message || 'Inventory update', {
            description: row.notes || undefined,
            duration: 8_000,
          });
        }
      } else {
        for (const row of rows) seenInstallerIds.current.add(row.id);
        installerToastReady.current = true;
      }
      setInstallerNotices(rows);
    } catch {
      setInstallerNotices([]);
    }
  }, []);

  useEffect(() => {
    void loadReturnNotices();
    void loadInstallerNotices();
    const id = window.setInterval(() => {
      void loadReturnNotices();
      void loadInstallerNotices();
    }, 60_000);
    return () => window.clearInterval(id);
  }, [loadReturnNotices, loadInstallerNotices]);

  const allNotifications = useMemo(
    () =>
      buildAppNotifications({
        maintenanceCases,
        faultyEntities,
        projects,
        customers,
        inventoryReturnNotices: returnNotices,
        inventoryInstallerNotices: installerNotices,
      }),
    [maintenanceCases, faultyEntities, projects, customers, returnNotices, installerNotices]
  );

  const notifications = useMemo(
    () =>
      hydrated
        ? allNotifications.filter((n) => {
            // Pending inventory returns stay until admin decides — not clearable.
            if (n.type === 'inventory_returned') return true;
            // Unread installer notices stay until marked read on the server.
            if (INSTALLER_NOTICE_TYPES.has(n.type)) return true;
            return !isCleared(n.id);
          })
        : allNotifications,
    [allNotifications, hydrated, isCleared]
  );

  const isNotificationRead = useCallback(
    (id: string) => {
      const n = notifications.find((x) => x.id === id);
      if (n?.type === 'inventory_returned') return false;
      if (n && INSTALLER_NOTICE_TYPES.has(n.type)) return false;
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

  const markInstallerNotice = useCallback(
    async (noticeId?: number) => {
      if (noticeId == null) return;
      try {
        await api.inventory.markInstallerNoticeRead(noticeId);
        setInstallerNotices((prev) => prev.filter((n) => n.id !== noticeId));
      } catch {
        // Keep in list if mark-read fails.
      }
    },
    []
  );

  const handleNotificationActivate = useCallback(
    (item: AppNotification) => {
      if (item.type === 'inventory_returned' && item.metaId != null) {
        openReturnDecision(item.metaId);
        return;
      }
      if (INSTALLER_NOTICE_TYPES.has(item.type)) {
        void markInstallerNotice(item.metaId);
        markLocalRead(item.id);
        return;
      }
      markLocalRead(item.id);
    },
    [openReturnDecision, markInstallerNotice, markLocalRead]
  );

  const markAsRead = useCallback(
    (id: string) => {
      const n = notifications.find((x) => x.id === id);
      if (n?.type === 'inventory_returned') {
        if (n.metaId != null) openReturnDecision(n.metaId);
        return;
      }
      if (n && INSTALLER_NOTICE_TYPES.has(n.type)) {
        void markInstallerNotice(n.metaId);
      }
      markLocalRead(id);
    },
    [markLocalRead, notifications, openReturnDecision, markInstallerNotice]
  );

  const markAllAsRead = useCallback(() => {
    const localIds = notifications
      .filter((n) => n.type !== 'inventory_returned' && !INSTALLER_NOTICE_TYPES.has(n.type))
      .map((n) => n.id);
    markLocalAllRead(localIds);
    if (installerNotices.length > 0) {
      void api.inventory.markAllInstallerNoticesRead().then(() => {
        setInstallerNotices([]);
      });
    }
  }, [markLocalAllRead, notifications, installerNotices.length]);

  const clearAll = useCallback(() => {
    clearLocal(
      notifications
        .filter((n) => n.type !== 'inventory_returned' && !INSTALLER_NOTICE_TYPES.has(n.type))
        .map((n) => n.id)
    );
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
    refreshInstallerNotices: loadInstallerNotices,
    returnDialogNotice,
    setReturnDialogOpen: closeReturnDialog,
    handleNotificationActivate,
    openReturnDecision,
  };
}

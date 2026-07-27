'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { useDataStore } from '@/lib/data-store';
import {
  buildAppNotifications,
  filterAppNotifications,
  type AppNotification,
} from '@/lib/app-notifications';
import { useNotificationState } from '@/hooks/use-notification-state';
import { useAuth } from '@/lib/auth-context';
import * as api from '@/lib/api';
import type { InventoryInstallerNotice, InventoryReturnNotice } from '@/lib/models';
import {
  readAlertSettings,
  type AlertSettingsState,
} from '@/components/settings/hooks/use-alert-settings';

const INSTALLER_NOTICE_TYPES = new Set([
  'inventory_issued',
  'inventory_return_accepted',
  'inventory_return_rejected',
]);

function playNotificationSound() {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = 880;
    gain.gain.value = 0.04;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.12);
    void ctx.close();
  } catch {
    // ignore audio failures
  }
}

function showDesktopNotification(title: string, body?: string) {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;
  try {
    new Notification(title, { body, silent: true });
  } catch {
    // ignore
  }
}

export function useAppNotifications(options?: { search?: string }) {
  const search = options?.search ?? '';
  const { maintenanceCases, faultyEntities, projects, customers, loading } = useDataStore();
  const { isInventoryManager } = useAuth();
  const inventoryManager = isInventoryManager();
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
  const [alertSettings, setAlertSettings] = useState<AlertSettingsState>(() =>
    readAlertSettings()
  );
  const seenInstallerIds = useRef<Set<number>>(new Set());
  const installerToastReady = useRef(false);

  useEffect(() => {
    const onChange = () => setAlertSettings(readAlertSettings());
    window.addEventListener('plcm-alert-settings-changed', onChange);
    window.addEventListener('storage', onChange);
    return () => {
      window.removeEventListener('plcm-alert-settings-changed', onChange);
      window.removeEventListener('storage', onChange);
    };
  }, []);

  const inAppEnabled = alertSettings.inApp.enabled;

  const announceNewNotice = useCallback(
    (title: string, body?: string) => {
      if (!inAppEnabled) return;
      toast.info(title, { description: body, duration: 8_000 });
      if (alertSettings.inApp.sound) playNotificationSound();
      if (alertSettings.inApp.desktop) showDesktopNotification(title, body);
    },
    [inAppEnabled, alertSettings.inApp.sound, alertSettings.inApp.desktop]
  );

  const loadReturnNotices = useCallback(async () => {
    if (!inAppEnabled || !inventoryManager) {
      setReturnNotices([]);
      return;
    }
    try {
      const res = await api.inventory.listReturnNotices();
      setReturnNotices(res.data ?? []);
    } catch {
      setReturnNotices([]);
    }
  }, [inventoryManager, inAppEnabled]);

  const loadInstallerNotices = useCallback(async () => {
    if (!inAppEnabled) {
      setInstallerNotices([]);
      return;
    }
    try {
      const res = await api.inventory.listInstallerNotices({
        allUsers: inventoryManager,
      });
      const rows = res.data ?? [];
      const unread = rows.filter((r) => !r.read_at);
      if (installerToastReady.current) {
        for (const row of unread) {
          if (seenInstallerIds.current.has(row.id)) continue;
          if (inventoryManager && row.user_id != null) {
            const sat =
              typeof window !== 'undefined' ? localStorage.getItem('sat-user') : null;
            let selfId: number | null = null;
            try {
              selfId = sat ? Number(JSON.parse(sat)?.id) : null;
            } catch {
              selfId = null;
            }
            if (selfId != null && row.user_id !== selfId) {
              seenInstallerIds.current.add(row.id);
              continue;
            }
          }
          seenInstallerIds.current.add(row.id);
          announceNewNotice(row.message || 'Inventory update', row.notes || undefined);
        }
      } else {
        for (const row of rows) seenInstallerIds.current.add(row.id);
        installerToastReady.current = true;
      }
      setInstallerNotices(rows);
    } catch {
      setInstallerNotices([]);
    }
  }, [inventoryManager, inAppEnabled, announceNewNotice]);

  useEffect(() => {
    void loadReturnNotices();
    void loadInstallerNotices();
    if (!inAppEnabled) return;
    const id = window.setInterval(() => {
      void loadReturnNotices();
      void loadInstallerNotices();
    }, 60_000);
    return () => window.clearInterval(id);
  }, [loadReturnNotices, loadInstallerNotices, inAppEnabled]);

  const allNotifications = useMemo(() => {
    if (!inAppEnabled) return [];
    return buildAppNotifications({
      maintenanceCases,
      faultyEntities,
      projects,
      customers,
      inventoryReturnNotices: returnNotices,
      inventoryInstallerNotices: installerNotices,
    });
  }, [
    inAppEnabled,
    maintenanceCases,
    faultyEntities,
    projects,
    customers,
    returnNotices,
    installerNotices,
  ]);

  const notifications = useMemo(() => {
    const base = hydrated
      ? allNotifications.filter((n) => {
          if (n.persistent) return true;
          return !isCleared(n.id);
        })
      : allNotifications;
    return filterAppNotifications(base, search);
  }, [allNotifications, hydrated, isCleared, search]);

  const isNotificationRead = useCallback(
    (id: string) => {
      const n = notifications.find((x) => x.id === id) ?? allNotifications.find((x) => x.id === id);
      if (!n) return isRead(id);
      if (n.type === 'inventory_returned') return false;
      if (n.persistent && n.serverRead != null) return Boolean(n.serverRead);
      return isRead(id);
    },
    [notifications, allNotifications, isRead]
  );

  const unreadCount = useMemo(
    () =>
      !inAppEnabled
        ? 0
        : hydrated
          ? allNotifications.filter((n) => {
              if (n.persistent) {
                if (n.type === 'inventory_returned') return true;
                return !n.serverRead;
              }
              return !isCleared(n.id) && !isRead(n.id);
            }).length
          : allNotifications.length,
    [allNotifications, hydrated, isCleared, isRead, inAppEnabled]
  );

  const highPriorityCount = useMemo(
    () =>
      !inAppEnabled
        ? 0
        : allNotifications.filter((n) => {
            if (n.priority !== 'high') return false;
            if (n.persistent) {
              if (n.type === 'inventory_returned') return true;
              return !n.serverRead;
            }
            return !isCleared(n.id) && !isRead(n.id);
          }).length,
    [allNotifications, isCleared, isRead, inAppEnabled]
  );

  const openReturnDecision = useCallback(
    (noticeId: number) => {
      const notice = returnNotices.find((n) => n.id === noticeId) ?? null;
      if (notice && (!notice.decision || notice.decision === 'pending')) {
        setReturnDialogNotice(notice);
      }
    },
    [returnNotices]
  );

  const markInstallerNotice = useCallback(async (noticeId?: number) => {
    if (noticeId == null) return;
    try {
      const res = await api.inventory.markInstallerNoticeRead(noticeId);
      const updated = res.data;
      setInstallerNotices((prev) =>
        prev.map((n) =>
          n.id === noticeId
            ? {
                ...n,
                read_at: updated?.read_at ?? new Date().toISOString(),
              }
            : n
        )
      );
    } catch {
      // Keep unread state if mark-read fails.
    }
  }, []);

  const handleNotificationActivate = useCallback(
    (item: AppNotification) => {
      if (item.type === 'inventory_returned' && item.metaId != null) {
        openReturnDecision(item.metaId);
        return;
      }
      if (INSTALLER_NOTICE_TYPES.has(item.type) && !item.serverRead) {
        void markInstallerNotice(item.metaId);
      }
      if (!item.persistent) {
        markLocalRead(item.id);
      }
    },
    [openReturnDecision, markInstallerNotice, markLocalRead]
  );

  const markAsRead = useCallback(
    (id: string) => {
      const n =
        notifications.find((x) => x.id === id) ?? allNotifications.find((x) => x.id === id);
      if (n?.type === 'inventory_returned') {
        if (n.metaId != null) openReturnDecision(n.metaId);
        return;
      }
      if (n && INSTALLER_NOTICE_TYPES.has(n.type) && !n.serverRead) {
        void markInstallerNotice(n.metaId);
        return;
      }
      if (!n?.persistent) {
        markLocalRead(id);
      }
    },
    [
      markLocalRead,
      notifications,
      allNotifications,
      openReturnDecision,
      markInstallerNotice,
    ]
  );

  const markAllAsRead = useCallback(() => {
    const localIds = allNotifications
      .filter((n) => !n.persistent && !isCleared(n.id))
      .map((n) => n.id);
    markLocalAllRead(localIds);
    void api.inventory
      .markAllInstallerNoticesRead({ allUsers: inventoryManager })
      .then(() => {
        setInstallerNotices((prev) =>
          prev.map((n) => ({
            ...n,
            read_at: n.read_at ?? new Date().toISOString(),
          }))
        );
      });
  }, [markLocalAllRead, allNotifications, isCleared, inventoryManager]);

  const clearAll = useCallback(() => {
    // Only clear ephemeral (non-persistent) notifications from the local UI.
    clearLocal(allNotifications.filter((n) => !n.persistent).map((n) => n.id));
  }, [clearLocal, allNotifications]);

  const closeReturnDialog = useCallback((open: boolean) => {
    if (!open) setReturnDialogNotice(null);
  }, []);

  return {
    notifications,
    unreadCount,
    highPriorityCount,
    loading: loading || !hydrated,
    inAppEnabled,
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

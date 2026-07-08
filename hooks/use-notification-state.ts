'use client';

import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'plcm-notification-state';

interface NotificationState {
  readIds: string[];
  clearedIds: string[];
}

function loadState(): NotificationState {
  if (typeof window === 'undefined') {
    return { readIds: [], clearedIds: [] };
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { readIds: [], clearedIds: [] };
    const parsed = JSON.parse(raw) as NotificationState;
    return {
      readIds: Array.isArray(parsed.readIds) ? parsed.readIds : [],
      clearedIds: Array.isArray(parsed.clearedIds) ? parsed.clearedIds : [],
    };
  } catch {
    return { readIds: [], clearedIds: [] };
  }
}

function saveState(state: NotificationState) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function useNotificationState() {
  const [state, setState] = useState<NotificationState>({ readIds: [], clearedIds: [] });
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setState(loadState());
    setHydrated(true);
  }, []);

  const markAsRead = useCallback((ids: string[]) => {
    if (ids.length === 0) return;
    setState((prev) => {
      const next = {
        ...prev,
        readIds: Array.from(new Set([...prev.readIds, ...ids])),
      };
      saveState(next);
      return next;
    });
  }, []);

  const markAllAsRead = useCallback((ids: string[]) => {
    markAsRead(ids);
  }, [markAsRead]);

  const clearAll = useCallback((ids: string[]) => {
    if (ids.length === 0) return;
    setState((prev) => {
      const next = {
        readIds: Array.from(new Set([...prev.readIds, ...ids])),
        clearedIds: Array.from(new Set([...prev.clearedIds, ...ids])),
      };
      saveState(next);
      return next;
    });
  }, []);

  const isRead = useCallback(
    (id: string) => state.readIds.includes(id),
    [state.readIds]
  );

  const isCleared = useCallback(
    (id: string) => state.clearedIds.includes(id),
    [state.clearedIds]
  );

  return {
    hydrated,
    isRead,
    isCleared,
    markAsRead: (id: string) => markAsRead([id]),
    markAllAsRead,
    clearAll,
  };
}

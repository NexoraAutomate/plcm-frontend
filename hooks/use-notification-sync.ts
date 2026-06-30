'use client';

import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { useDataStore } from '@/lib/data-store';
import { useAppNotifications } from '@/hooks/use-app-notifications';

const POLL_MS = 60_000;

export function useNotificationSync() {
  const { refreshLightweight } = useDataStore();
  const { notifications } = useAppNotifications();
  const seenIdsRef = useRef<Set<string>>(new Set());
  const readyRef = useRef(false);

  useEffect(() => {
    const timer = setInterval(() => refreshLightweight(), POLL_MS);
    const onFocus = () => refreshLightweight();
    const onVisibility = () => {
      if (document.visibilityState === 'visible') refreshLightweight();
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      clearInterval(timer);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [refreshLightweight]);

  useEffect(() => {
    const currentIds = new Set(notifications.map((n) => n.id));

    if (!readyRef.current) {
      seenIdsRef.current = currentIds;
      readyRef.current = true;
      return;
    }

    for (const notification of notifications) {
      if (!seenIdsRef.current.has(notification.id)) {
        toast(notification.title, {
          description: notification.message,
          duration: 6000,
        });
      }
    }

    seenIdsRef.current = currentIds;
  }, [notifications]);
}

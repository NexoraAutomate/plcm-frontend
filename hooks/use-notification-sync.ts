'use client';

import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { useAppNotifications } from '@/hooks/use-app-notifications';

/** Show toast notifications when new items appear in the store-derived list. */
export function useNotificationSync() {
  const { notifications } = useAppNotifications();
  const seenIdsRef = useRef<Set<string>>(new Set());
  const readyRef = useRef(false);

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

'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useDataStore } from '@/lib/data-store';
import { buildAppNotifications, type AppNotification } from '@/lib/app-notifications';

export function useAppNotifications() {
  const { maintenanceCases, faultyEntities, projects, customers, loading } = useDataStore();

  const notifications = useMemo(
    () =>
      buildAppNotifications({
        maintenanceCases,
        faultyEntities,
        projects,
        customers,
      }),
    [maintenanceCases, faultyEntities, projects, customers]
  );

  const unreadCount = notifications.length;
  const highPriorityCount = notifications.filter((n) => n.priority === 'high').length;

  return { notifications, unreadCount, highPriorityCount, loading };
}

export type { AppNotification };

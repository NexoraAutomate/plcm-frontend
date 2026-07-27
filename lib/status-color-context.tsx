'use client';

import { createContext, useMemo, type ReactNode } from 'react';
import type { Status } from '@/lib/models';

/** Map of status_name → hex color from the loaded status registry */
export const DataStoreStatusesContext = createContext<Record<string, string> | null>(null);

export function StatusColorProvider({
  statuses,
  children,
}: {
  statuses: Status[];
  children: ReactNode;
}) {
  const map = useMemo(() => {
    const next: Record<string, string> = {};
    for (const s of statuses) {
      if (s.status_name && s.color) {
        next[s.status_name] = s.color;
      }
    }
    return next;
  }, [statuses]);

  return (
    <DataStoreStatusesContext.Provider value={map}>{children}</DataStoreStatusesContext.Provider>
  );
}

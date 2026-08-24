'use client';

import { useEffect, useMemo, useState } from 'react';
import * as api from '@/lib/api';
import { inventoryFlagKey } from '@/lib/system-hierarchy-graph';
import type { InventoryReservation, InventoryShortage } from '@/lib/models';

export type ProjectInventoryHoldMaps = {
  reserved: Set<string>;
  shortage: Set<string>;
  reservationsByKey: Record<string, InventoryReservation>;
  shortagesByKey: Record<string, InventoryShortage>;
};

const EMPTY: ProjectInventoryHoldMaps = {
  reserved: new Set(),
  shortage: new Set(),
  reservationsByKey: {},
  shortagesByKey: {},
};

export function useProjectInventoryFlags(projectId?: number | null): ProjectInventoryHoldMaps {
  const [maps, setMaps] = useState<ProjectInventoryHoldMaps>(EMPTY);

  useEffect(() => {
    if (!projectId) {
      setMaps(EMPTY);
      return;
    }
    let cancelled = false;
    Promise.all([
      api.projects.listReservations(projectId, true),
      api.projects.listShortages(projectId, true),
    ])
      .then(([reservations, shortages]) => {
        if (cancelled) return;
        const reservationsByKey: Record<string, InventoryReservation> = {};
        const reserved = new Set<string>();
        for (const row of reservations.data ?? []) {
          if (row.status !== 'active') continue;
          const key = inventoryFlagKey(row.target_entity_type, row.target_entity_id);
          reserved.add(key);
          reservationsByKey[key] = row;
        }
        const shortagesByKey: Record<string, InventoryShortage> = {};
        const shortage = new Set<string>();
        for (const row of shortages.data ?? []) {
          const status = (row.status || '').toUpperCase();
          if (status !== 'OPEN' && status !== 'PARTIAL') continue;
          const key = inventoryFlagKey(row.target_entity_type, row.target_entity_id);
          shortage.add(key);
          shortagesByKey[key] = row;
        }
        setMaps({ reserved, shortage, reservationsByKey, shortagesByKey });
      })
      .catch(() => {
        if (!cancelled) setMaps(EMPTY);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  return useMemo(() => maps, [maps]);
}

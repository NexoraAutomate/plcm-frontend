'use client';

import { useEffect, useMemo, useState } from 'react';
import * as api from '@/lib/api';
import { inventoryFlagKey } from '@/lib/system-hierarchy-graph';

export function useProjectInventoryFlags(projectId?: number | null) {
  const [reserved, setReserved] = useState<Set<string>>(new Set());
  const [shortage, setShortage] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!projectId) {
      setReserved(new Set());
      setShortage(new Set());
      return;
    }
    let cancelled = false;
    Promise.all([
      api.projects.listReservations(projectId, true),
      api.projects.listShortages(projectId, true),
    ])
      .then(([reservations, shortages]) => {
        if (cancelled) return;
        setReserved(
          new Set(
            (reservations.data ?? [])
              .filter((row) => row.status === 'active')
              .map((row) => inventoryFlagKey(row.target_entity_type, row.target_entity_id))
          )
        );
        setShortage(
          new Set(
            (shortages.data ?? [])
              .filter((row) => {
                const status = (row.status || '').toUpperCase();
                return status === 'OPEN' || status === 'PARTIAL';
              })
              .map((row) => inventoryFlagKey(row.target_entity_type, row.target_entity_id))
          )
        );
      })
      .catch(() => {
        if (cancelled) return;
        setReserved(new Set());
        setShortage(new Set());
      });
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  return useMemo(() => ({ reserved, shortage }), [reserved, shortage]);
}

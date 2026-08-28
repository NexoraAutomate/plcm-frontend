'use client';

import { useEffect, useMemo, useState } from 'react';
import * as api from '@/lib/api';
import type { HierarchyAssignmentStatus } from '@/lib/models';
import {
  inventoryFlagKey,
  type HierarchyAssignmentStatusFields,
  type HierarchyEntityType,
} from '@/lib/system-hierarchy-graph';

export interface HierarchyEntityRef {
  type: HierarchyEntityType;
  id: number;
}

export function useHierarchyAssignmentStatuses(
  entityRefs: HierarchyEntityRef[]
): Map<string, HierarchyAssignmentStatusFields> {
  const refsKey = useMemo(
    () =>
      entityRefs
        .map((ref) => `${ref.type}:${ref.id}`)
        .sort()
        .join(','),
    [entityRefs]
  );

  const [statusByKey, setStatusByKey] = useState<Map<string, HierarchyAssignmentStatusFields>>(
    () => new Map()
  );

  useEffect(() => {
    if (!refsKey) {
      setStatusByKey(new Map());
      return;
    }

    const byType = new Map<HierarchyEntityType, number[]>();
    for (const ref of entityRefs) {
      const existing = byType.get(ref.type) ?? [];
      if (!existing.includes(ref.id)) {
        existing.push(ref.id);
      }
      byType.set(ref.type, existing);
    }

    let cancelled = false;

    Promise.all(
      Array.from(byType.entries()).map(([type, ids]) =>
        api.hierarchyWorkflow.assignmentStatus(type, ids)
      )
    )
      .then((responses) => {
        if (cancelled) return;
        const next = new Map<string, HierarchyAssignmentStatusFields>();
        for (const response of responses) {
          for (const row of (response.data ?? []) as HierarchyAssignmentStatus[]) {
            const key = inventoryFlagKey(row.entity_type, row.id);
            next.set(key, {
              item_status: row.item_status,
              issued: row.issued,
              verified: row.verified,
            });
          }
        }
        setStatusByKey(next);
      })
      .catch(() => {
        if (!cancelled) setStatusByKey(new Map());
      });

    return () => {
      cancelled = true;
    };
  }, [entityRefs, refsKey]);

  return statusByKey;
}

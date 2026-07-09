'use client';

import { useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  HARDWARE_ENTITY_DETAIL_PATH,
  resolveCurrentInstallEntity,
  type HardwareEntityWithSlot,
} from '@/lib/entity-replacement';
import type { HierarchyEntityType } from '@/lib/entity-hierarchy';

export function useResolvedHardwareEntity<T extends HardwareEntityWithSlot>(
  entityId: string,
  entityType: HierarchyEntityType,
  entities: T[],
  options?: { redirectSuperseded?: boolean }
) {
  const router = useRouter();
  const redirectSuperseded = options?.redirectSuperseded ?? true;

  const entity = useMemo(() => {
    const parsedId = Number(entityId);
    if (!Number.isFinite(parsedId)) return undefined;
    return resolveCurrentInstallEntity(parsedId, entities);
  }, [entityId, entities]);

  useEffect(() => {
    if (!redirectSuperseded || !entityId || entities.length === 0) return;

    const parsedId = Number(entityId);
    if (!Number.isFinite(parsedId)) return;

    const resolved = resolveCurrentInstallEntity(parsedId, entities);
    if (resolved && resolved.id !== parsedId) {
      router.replace(HARDWARE_ENTITY_DETAIL_PATH[entityType](resolved.id));
    }
  }, [entityId, entityType, entities, redirectSuperseded, router]);

  return entity;
}

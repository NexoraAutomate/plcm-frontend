import * as api from '@/lib/api';
import type { Entity } from '@/lib/models';

/** Matches backend ENTITY_CONFIG display_name values (e.g. "System", "Subsystem"). */
export const ENTITY_TYPE_DB_LABELS: Record<string, string> = {
  customer: 'Customer',
  order: 'Order',
  project: 'Project',
  system: 'System',
  subsystem: 'Subsystem',
  module: 'Module',
  unit: 'Unit',
  component: 'Component',
};

export type HardwareEntityType = keyof typeof ENTITY_TYPE_DB_LABELS;

export function toDbEntityType(entityType: string): string {
  return ENTITY_TYPE_DB_LABELS[entityType.toLowerCase()] ?? entityType;
}

/** Per (type, pk) cache — never page the full /entities list (can be tens of thousands). */
const lookupCache = new Map<string, Promise<Entity | null>>();

function cacheKey(entityType: string, entityPk: number): string {
  return `${entityType.toLowerCase()}:${entityPk}`;
}

export function clearEntityCache() {
  lookupCache.clear();
}

/**
 * Resolve the generic Entity row for a hierarchy hardware record.
 * Uses GET /entities/lookup/ only — does not scan the full entities table.
 */
export async function resolveEntity(
  entityType: HardwareEntityType | string,
  entityPk: number
): Promise<Entity | null> {
  if (!Number.isFinite(entityPk) || entityPk <= 0) return null;

  const key = cacheKey(entityType, entityPk);
  const cached = lookupCache.get(key);
  if (cached) return cached;

  const pending = (async () => {
    try {
      const res = await api.entities.lookup(entityType, entityPk);
      return res.data ?? null;
    } catch {
      return null;
    }
  })();

  lookupCache.set(key, pending);

  try {
    return await pending;
  } catch {
    lookupCache.delete(key);
    return null;
  }
}

export async function resolveEntityId(
  entityType: HardwareEntityType | string,
  entityPk: number
): Promise<number | null> {
  const entity = await resolveEntity(entityType, entityPk);
  return entity?.id ?? null;
}

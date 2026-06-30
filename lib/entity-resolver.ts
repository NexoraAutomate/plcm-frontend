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

let entityCache: Entity[] | null = null;
let entityCachePromise: Promise<Entity[]> | null = null;

async function loadEntitiesFromList(): Promise<Entity[]> {
  if (entityCache) return entityCache;

  entityCachePromise ??= (async () => {
    const all: Entity[] = [];
    const pageSize = 500;
    let skip = 0;

    while (true) {
      const res = await api.entities.list(skip, pageSize);
      all.push(...res.data);
      if (res.data.length < pageSize) break;
      skip += pageSize;
    }

    entityCache = all;
    return all;
  })();

  return entityCachePromise;
}

export function clearEntityCache() {
  entityCache = null;
  entityCachePromise = null;
}

function matchesEntity(entity: Entity, entityType: string, entityPk: number): boolean {
  const dbType = toDbEntityType(entityType);
  return (
    entity.entity_pk === entityPk &&
    (entity.entity_type === dbType ||
      entity.entity_type.toLowerCase() === entityType.toLowerCase())
  );
}

export async function resolveEntity(
  entityType: HardwareEntityType | string,
  entityPk: number
): Promise<Entity | null> {
  try {
    const res = await api.entities.lookup(entityType, entityPk);
    return res.data;
  } catch {
    // Fall back to cached list scan (legacy / offline tolerance)
  }

  const findMatch = (entities: Entity[]) =>
    entities.find((entity) => matchesEntity(entity, entityType, entityPk));

  let entities = await loadEntitiesFromList();
  let match = findMatch(entities);

  if (!match) {
    clearEntityCache();
    entities = await loadEntitiesFromList();
    match = findMatch(entities);
  }

  return match ?? null;
}

export async function resolveEntityId(
  entityType: HardwareEntityType | string,
  entityPk: number
): Promise<number | null> {
  const entity = await resolveEntity(entityType, entityPk);
  return entity?.id ?? null;
}

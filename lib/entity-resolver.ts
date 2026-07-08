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

function normalizedEntityKey(entityType: string, entityPk: number): string {
  return `${entityType.toLowerCase()}:${entityPk}`;
}

/**
 * Resolves many (entityType, entityPk) refs to their generic entity IDs using a
 * single entity-list load. This avoids issuing one `/entities/lookup/` request
 * per ref (which can be hundreds for a project subtree and floods the backend).
 *
 * Returns a map keyed by `type:pk` (lowercased) → generic entity id.
 */
export async function resolveEntityIds(
  refs: Array<{ type: HardwareEntityType | string; pk: number }>
): Promise<Map<string, number>> {
  const result = new Map<string, number>();
  if (refs.length === 0) return result;

  const buildIndex = (entities: Entity[]) => {
    const byKey = new Map<string, number>();
    for (const entity of entities) {
      byKey.set(normalizedEntityKey(entity.entity_type, entity.entity_pk), entity.id);
    }
    return byKey;
  };

  const resolveFromIndex = (byKey: Map<string, number>) => {
    let missing = false;
    for (const ref of refs) {
      const key = normalizedEntityKey(ref.type, ref.pk);
      if (result.has(key)) continue;
      const entityId = byKey.get(key);
      if (entityId != null) {
        result.set(key, entityId);
      } else {
        missing = true;
      }
    }
    return missing;
  };

  const hasMissing = resolveFromIndex(buildIndex(await loadEntitiesFromList()));

  // If some refs weren't found, the cached list may be stale. Refresh it once
  // (not per-ref) and retry so we never storm the backend with reloads.
  if (hasMissing) {
    clearEntityCache();
    resolveFromIndex(buildIndex(await loadEntitiesFromList()));
  }

  return result;
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

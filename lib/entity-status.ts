import type { Status } from './models';

export interface StatusResolvable {
  status_id?: number;
  status_name?: string;
  status?: { status_name?: string; id?: number };
}

type EntityWithStatus = {
  status_id: number;
  status?: Status;
};

export function resolveStatusName(
  entity: StatusResolvable,
  statuses: Status[] = []
): string {
  if (entity.status?.status_name) return entity.status.status_name;
  if (entity.status_name) return entity.status_name;
  if (entity.status_id != null) {
    const match = statuses.find((s) => s.id === entity.status_id);
    if (match?.status_name) return match.status_name;
  }
  return 'Unknown';
}

export function enrichEntityWithStatus<T extends StatusResolvable & { status_id: number }>(
  entity: T,
  statuses: Status[]
): T {
  if (!statuses.length) return entity;

  const status_name = resolveStatusName(entity, statuses);
  if (status_name === 'Unknown') return entity;

  const fromList = statuses.find((s) => s.id === entity.status_id);
  return {
    ...entity,
    status_name,
    status: entity.status ?? fromList ?? { id: entity.status_id, status_name },
  };
}

export function enrichEntitiesWithStatus<T extends StatusResolvable & { status_id: number }>(
  entities: T[],
  statuses: Status[]
): T[] {
  if (!statuses.length) return entities;
  return entities.map((entity) => enrichEntityWithStatus(entity, statuses));
}

export function getEntityStatusName(
  entity: EntityWithStatus,
  statuses: Status[]
): string | undefined {
  const statusName = resolveStatusName(entity, statuses);
  return statusName !== 'Unknown' ? statusName : undefined;
}

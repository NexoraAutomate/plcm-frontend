import type { Status } from '@/lib/models';
import type { ListFilterParams } from '@/lib/list-filters';
import { normalizeListFilters } from '@/lib/list-filters';

export function resolveStatusId(
  statusName: string | undefined,
  statuses: Status[],
  allValue = 'all'
): number | undefined {
  if (!statusName || statusName === allValue || statusName === 'Total') return undefined;
  return statuses.find((s) => s.status_name === statusName)?.id;
}

export function buildListFilters(input: {
  search?: string;
  statusName?: string;
  statusId?: number | null;
  statuses?: Status[];
  allStatusValue?: string;
  orderId?: number | null;
  customerId?: number | null;
  projectId?: number | null;
  systemId?: number | null;
  subsystemId?: number | null;
  moduleId?: number | null;
  unitId?: number | null;
  inventoryType?: string;
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
}): ListFilterParams | undefined {
  const status_id =
    input.statusId ??
    (input.statuses
      ? resolveStatusId(input.statusName, input.statuses, input.allStatusValue)
      : undefined);

  return normalizeListFilters({
    search: input.search?.trim() || undefined,
    status_id,
    order_id: input.orderId ?? undefined,
    customer_id: input.customerId ?? undefined,
    project_id: input.projectId ?? undefined,
    system_id: input.systemId ?? undefined,
    subsystem_id: input.subsystemId ?? undefined,
    module_id: input.moduleId ?? undefined,
    unit_id: input.unitId ?? undefined,
    inventory_type: input.inventoryType,
    sort_by: input.sort_by,
    sort_order: input.sort_order,
  });
}

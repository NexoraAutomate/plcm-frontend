'use client';

import { useQuery } from '@tanstack/react-query';
import * as api from '@/lib/api';
import { parseListTotal, unwrapListItems } from '@/lib/paginated-api';
import { queryKeys } from '@/hooks/queries/query-keys';
import type { MaintenanceCase } from '@/lib/models';

const CASE_STATUSES = [
  'open',
  'under_inspection',
  'under_repair',
  'resolved',
  'closed',
] as const;

export type MaintenanceCaseStatusCounts = {
  total: number;
  byStatus: Record<(typeof CASE_STATUSES)[number], number>;
};

async function countForFilter(filters?: { status?: string }): Promise<number> {
  const response = await api.maintenanceCases.list(0, 1, filters);
  const items = unwrapListItems<MaintenanceCase>(response.data);
  return parseListTotal(response, items, 0, 1) ?? items.length;
}

async function fetchStatusCounts(): Promise<MaintenanceCaseStatusCounts> {
  const [total, ...statusCounts] = await Promise.all([
    countForFilter(),
    ...CASE_STATUSES.map((status) => countForFilter({ status })),
  ]);

  const byStatus = Object.fromEntries(
    CASE_STATUSES.map((status, index) => [status, statusCounts[index] ?? 0])
  ) as MaintenanceCaseStatusCounts['byStatus'];

  return { total, byStatus };
}

/** Lightweight KPI counts via X-Total-Count (limit=1 per status). */
export function useMaintenanceCaseStatusCounts(enabled = true) {
  return useQuery({
    queryKey: queryKeys.maintenanceCaseStatusCounts(),
    queryFn: fetchStatusCounts,
    enabled,
    staleTime: 30_000,
    retry: 1,
  });
}

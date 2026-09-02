'use client';

import { useQuery } from '@tanstack/react-query';
import * as api from '@/lib/api';
import { queryKeys } from '@/hooks/queries/query-keys';
import type { InventoryStatsSummary } from '@/lib/models';

async function fetchInventoryStatsSummary(): Promise<InventoryStatsSummary> {
  const response = await api.inventory.statsSummary();
  return response.data;
}

export function useInventoryStatsSummary(enabled = true) {
  return useQuery({
    queryKey: queryKeys.inventoryStatsSummary(),
    queryFn: fetchInventoryStatsSummary,
    enabled,
    staleTime: 30_000,
    retry: 1,
  });
}

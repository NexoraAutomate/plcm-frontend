import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { LIST_PAGE_SIZE } from '@/lib/data-loading';
import type { ExecutiveDashboardFilters } from '@/lib/types/dashboard';
import {
  fetchCustomers,
  fetchExecutiveDashboardData,
  fetchFaultyEntities,
  fetchHierarchyEntities,
  fetchHierarchies,
  fetchInventory,
  fetchMaintenanceCases,
  fetchMaintenanceLogs,
  fetchOrders,
  fetchProjects,
  fetchProjectProgress,
  fetchStatuses,
  fetchUsers,
} from './fetchers';
import { queryKeys } from './query-keys';

export function useStatusesQuery() {
  return useQuery({
    queryKey: queryKeys.statuses(),
    queryFn: fetchStatuses,
  });
}

export function useStatusesByTypeQuery(statusType: string) {
  const allQuery = useStatusesQuery();
  const filtered = useMemo(
    () => (allQuery.data ?? []).filter((s) => s.status_type === statusType),
    [allQuery.data, statusType]
  );

  return {
    ...allQuery,
    data: filtered,
  };
}

export function useCustomersQuery(skip = 0, limit = LIST_PAGE_SIZE) {
  return useQuery({
    queryKey: queryKeys.customers(skip, limit),
    queryFn: () => fetchCustomers(skip, limit),
  });
}

export function useOrdersQuery(skip = 0, limit = LIST_PAGE_SIZE) {
  return useQuery({
    queryKey: queryKeys.orders(skip, limit),
    queryFn: () => fetchOrders(skip, limit),
  });
}

export function useProjectsQuery(skip = 0, limit = LIST_PAGE_SIZE) {
  return useQuery({
    queryKey: queryKeys.projects(skip, limit),
    queryFn: () => fetchProjects(skip, limit),
  });
}

export function useProjectProgressQuery(projectId: number | null) {
  return useQuery({
    queryKey: queryKeys.projectProgress(projectId ?? 0),
    queryFn: () => fetchProjectProgress(projectId as number),
    enabled: Number.isFinite(projectId) && (projectId as number) > 0,
  });
}

export function useUsersQuery(skip = 0, limit = LIST_PAGE_SIZE) {
  return useQuery({
    queryKey: queryKeys.users(skip, limit),
    queryFn: () => fetchUsers(skip, limit),
  });
}

export function useInventoryQuery(skip = 0, limit = LIST_PAGE_SIZE, type?: string) {
  return useQuery({
    queryKey: queryKeys.inventory(skip, limit, type),
    queryFn: () => fetchInventory(skip, limit, type),
  });
}

export function useMaintenanceCasesQuery(skip = 0, limit = LIST_PAGE_SIZE) {
  return useQuery({
    queryKey: queryKeys.maintenanceCases(skip, limit),
    queryFn: () => fetchMaintenanceCases(skip, limit),
  });
}

export function useFaultyEntitiesQuery(skip = 0, limit = LIST_PAGE_SIZE) {
  return useQuery({
    queryKey: queryKeys.faultyEntities(skip, limit),
    queryFn: () => fetchFaultyEntities(skip, limit),
  });
}

export function useMaintenanceLogsQuery(skip = 0, limit = LIST_PAGE_SIZE) {
  return useQuery({
    queryKey: queryKeys.maintenanceLogs(skip, limit),
    queryFn: () => fetchMaintenanceLogs(skip, limit),
  });
}

export function useHierarchyEntitiesQuery(enabled = true) {
  return useQuery({
    queryKey: queryKeys.hierarchyEntities(),
    queryFn: fetchHierarchyEntities,
    enabled,
  });
}

export function useExecutiveDashboardQuery(
  filters: ExecutiveDashboardFilters & { kpi_filter?: string }
) {
  return useQuery({
    queryKey: queryKeys.executiveDashboard(filters),
    queryFn: () => fetchExecutiveDashboardData(filters),
    placeholderData: (previous) => previous,
  });
}

export function useHierarchiesQuery(hierarchyType?: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.hierarchies(hierarchyType),
    queryFn: () => fetchHierarchies(hierarchyType),
    enabled,
  });
}

import type { ExecutiveDashboardFilters } from '@/lib/types/dashboard';
import { normalizeListFilters, type ListFilterParams } from '@/lib/list-filters';

function stableFiltersKey(filters?: ListFilterParams) {
  return JSON.stringify(normalizeListFilters(filters) ?? {});
}

export const queryKeys = {
  statuses: () => ['statuses'] as const,
  statusesByType: (statusType: string) => ['statuses', { statusType }] as const,
  users: (skip: number, limit: number) => ['users', { skip, limit }] as const,
  customers: (skip: number, limit: number) => ['customers', { skip, limit }] as const,
  orders: (skip: number, limit: number) => ['orders', { skip, limit }] as const,
  projects: (skip: number, limit: number) => ['projects', { skip, limit }] as const,
  inventory: (skip: number, limit: number, type?: string) =>
    ['inventory', { skip, limit, type: type ?? null }] as const,
  maintenanceLogs: (skip: number, limit: number) =>
    ['maintenanceLogs', { skip, limit }] as const,
  maintenanceCases: (skip: number, limit: number) =>
    ['maintenanceCases', { skip, limit }] as const,
  faultyEntities: (skip: number, limit: number) =>
    ['faultyEntities', { skip, limit }] as const,
  hierarchyEntities: () => ['hierarchy', 'entities'] as const,
  executiveDashboard: (filters: ExecutiveDashboardFilters & { kpi_filter?: string }) =>
    ['dashboard', 'executive', filters] as const,
  hierarchies: (hierarchyType?: string) =>
    ['hierarchies', { hierarchyType: hierarchyType ?? null }] as const,
  customersPage: (filters?: ListFilterParams) =>
    ['customers', 'page', stableFiltersKey(filters)] as const,
  ordersPage: (filters?: ListFilterParams) =>
    ['orders', 'page', stableFiltersKey(filters)] as const,
  projectsPage: (filters?: ListFilterParams) =>
    ['projects', 'page', stableFiltersKey(filters)] as const,
  projectProgress: (id: number) => ['projects', id, 'progress'] as const,
  usersPage: (filters?: ListFilterParams) =>
    ['users', 'page', stableFiltersKey(filters)] as const,
  inventoryPage: (type?: string, filters?: ListFilterParams) =>
    ['inventory', 'page', { type: type ?? null, filters: stableFiltersKey(filters) }] as const,
  systemsPage: (filters?: ListFilterParams) =>
    ['systems', 'page', stableFiltersKey(filters)] as const,
  subsystemsPage: (filters?: ListFilterParams) =>
    ['subsystems', 'page', stableFiltersKey(filters)] as const,
  modulesPage: (filters?: ListFilterParams) =>
    ['modules', 'page', stableFiltersKey(filters)] as const,
  unitsPage: (filters?: ListFilterParams) =>
    ['units', 'page', stableFiltersKey(filters)] as const,
  componentsPage: (filters?: ListFilterParams) =>
    ['components', 'page', stableFiltersKey(filters)] as const,
  maintenanceLogsPage: (filters?: ListFilterParams) =>
    ['maintenanceLogs', 'page', stableFiltersKey(filters)] as const,
  maintenanceCasesPage: (filters?: ListFilterParams) =>
    ['maintenanceCases', 'page', stableFiltersKey(filters)] as const,
  maintenanceCaseStatusCounts: () => ['maintenanceCases', 'statusCounts'] as const,
  statusesPage: (statusType?: string) => ['statuses', 'page', { statusType: statusType ?? null }] as const,
};

/** Lightweight refresh targets — invalidate together after polling. */
export const lightweightQueryKeys = [
  queryKeys.maintenanceCases(0, 20),
  queryKeys.faultyEntities(0, 20),
  queryKeys.projects(0, 20),
  queryKeys.customers(0, 20),
] as const;

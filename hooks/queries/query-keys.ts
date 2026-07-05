import type { ExecutiveDashboardFilters } from '@/lib/types/dashboard';

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
  customersPage: (filters?: import('@/lib/list-filters').ListFilterParams) =>
    ['customers', 'page', filters ?? null] as const,
  ordersPage: (filters?: import('@/lib/list-filters').ListFilterParams) =>
    ['orders', 'page', filters ?? null] as const,
  projectsPage: (filters?: import('@/lib/list-filters').ListFilterParams) =>
    ['projects', 'page', filters ?? null] as const,
  usersPage: (filters?: import('@/lib/list-filters').ListFilterParams) =>
    ['users', 'page', filters ?? null] as const,
  inventoryPage: (type?: string, filters?: import('@/lib/list-filters').ListFilterParams) =>
    ['inventory', 'page', { type: type ?? null, filters: filters ?? null }] as const,
  systemsPage: (filters?: import('@/lib/list-filters').ListFilterParams) =>
    ['systems', 'page', filters ?? null] as const,
  subsystemsPage: (filters?: import('@/lib/list-filters').ListFilterParams) =>
    ['subsystems', 'page', filters ?? null] as const,
  modulesPage: (filters?: import('@/lib/list-filters').ListFilterParams) =>
    ['modules', 'page', filters ?? null] as const,
  unitsPage: (filters?: import('@/lib/list-filters').ListFilterParams) =>
    ['units', 'page', filters ?? null] as const,
  componentsPage: (filters?: import('@/lib/list-filters').ListFilterParams) =>
    ['components', 'page', filters ?? null] as const,
  allProjects: () => ['projects', 'all'] as const,
  maintenanceLogsPage: () => ['maintenanceLogs', 'page'] as const,
  maintenanceCasesPage: () => ['maintenanceCases', 'page'] as const,
  statusesPage: (statusType?: string) => ['statuses', 'page', { statusType: statusType ?? null }] as const,
};

/** Lightweight refresh targets — invalidate together after polling. */
export const lightweightQueryKeys = [
  queryKeys.maintenanceCases(0, 20),
  queryKeys.faultyEntities(0, 20),
  queryKeys.projects(0, 20),
  queryKeys.customers(0, 20),
] as const;

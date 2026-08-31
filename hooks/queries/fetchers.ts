import type { AxiosResponse } from 'axios';
import * as api from '@/lib/api';
import { listEntityListNames } from '@/lib/hierarchy-template-names';
import { fetchExecutiveDashboard } from '@/lib/api/dashboard';
import { fetchPaginatedList, unwrapListItems } from '@/lib/paginated-api';
import { fetchCappedPages, ABSOLUTE_FETCH_CAP, HIERARCHY_TYPE_CAP, LIST_BOOTSTRAP_SIZE, LIST_PAGE_SIZE } from '@/lib/data-loading';
import type { ListFilterParams } from '@/lib/list-filters';
import type { ExecutiveDashboardFilters } from '@/lib/types/dashboard';
import type {
  Component,
  Customer,
  FaultyEntity,
  Inventory,
  MaintenanceCase,
  MaintenanceLog,
  Module,
  Order,
  Project,
  ProjectProgress,
  Status,
  Subsystem,
  System,
  Unit,
  User,
} from '@/lib/models';

export async function fetchStatuses(): Promise<Status[]> {
  const res = await api.statuses.list(0, 5000);
  return res.data ?? [];
}

export async function fetchCustomers(skip = 0, limit = LIST_PAGE_SIZE): Promise<Customer[]> {
  const res = await api.customers.list(skip, limit);
  return unwrapListItems<Customer>(res.data);
}

export async function fetchOrders(skip = 0, limit = LIST_PAGE_SIZE): Promise<Order[]> {
  const res = await api.orders.list(skip, limit);
  return unwrapListItems<Order>(res.data);
}

export async function fetchProjects(
  skip = 0,
  limit = LIST_PAGE_SIZE,
  options?: { includeTotal?: boolean }
): Promise<Project[]> {
  const res = await api.projects.list(skip, limit, options);
  return unwrapListItems<Project>(res.data);
}

export async function fetchProjectProgress(id: number): Promise<ProjectProgress> {
  const res = await api.projects.progress(id);
  return res.data;
}

export async function fetchUsers(skip = 0, limit = LIST_PAGE_SIZE): Promise<User[]> {
  const res = await api.users.list(skip, limit);
  return unwrapListItems<User>(res.data);
}

export async function fetchInventory(skip = 0, limit = LIST_PAGE_SIZE, type?: string): Promise<Inventory[]> {
  const res = await api.inventory.list(skip, limit, type);
  return unwrapListItems<Inventory>(res.data);
}

export async function fetchMaintenanceLogs(skip = 0, limit = LIST_PAGE_SIZE): Promise<MaintenanceLog[]> {
  const res = await api.maintenanceLogs.list(skip, limit);
  return unwrapListItems<MaintenanceLog>(res.data);
}

export async function fetchMaintenanceCases(skip = 0, limit = LIST_PAGE_SIZE): Promise<MaintenanceCase[]> {
  const res = await api.maintenanceCases.list(skip, limit);
  return unwrapListItems<MaintenanceCase>(res.data);
}

export async function fetchFaultyEntities(skip = 0, limit = LIST_PAGE_SIZE): Promise<FaultyEntity[]> {
  const res = await api.faultyEntities.list(skip, limit);
  return unwrapListItems<FaultyEntity>(res.data);
}

export async function fetchHierarchyEntities(): Promise<{
  systems: System[];
  subsystems: Subsystem[];
  modules: Module[];
  units: Unit[];
  components: Component[];
}> {
  // Load sequentially to avoid overwhelming PostgreSQL with 5 concurrent scans.
  // 403 means this role cannot list that type globally — keep the rest of the tree.
  const loadType = async <T>(
    listPage: (
      skip: number,
      limit: number,
      options?: { includeTotal?: boolean }
    ) => Promise<AxiosResponse<unknown>>
  ): Promise<T[]> => {
    try {
      return await fetchCappedPages<T>(listPage, {
        maxItems: HIERARCHY_TYPE_CAP,
        pageSize: LIST_BOOTSTRAP_SIZE,
      });
    } catch (error) {
      if (api.isForbiddenError(error)) return [];
      throw error;
    }
  };

  const systems = await loadType<System>(api.systems.list);
  const subsystems = await loadType<Subsystem>(api.subsystems.list);
  const modules = await loadType<Module>(api.modules.list);
  const units = await loadType<Unit>(api.units.list);
  const components = await loadType<Component>(api.components.list);
  return { systems, subsystems, modules, units, components };
}

export async function fetchExecutiveDashboardData(
  filters: ExecutiveDashboardFilters & { kpi_filter?: string }
) {
  return fetchExecutiveDashboard(filters);
}

export async function fetchHierarchies(hierarchyType?: string) {
  return listEntityListNames({ level: hierarchyType });
}

export async function fetchAllProjects(): Promise<Project[]> {
  return fetchProjects(0, LIST_BOOTSTRAP_SIZE, { includeTotal: false });
}

export const fetchCustomersPage = (skip: number, limit: number, filters?: ListFilterParams) =>
  fetchPaginatedList((s, l, f) => api.customers.list(s, l, f), skip, limit, filters);

export const fetchOrdersPage = (skip: number, limit: number, filters?: ListFilterParams) =>
  fetchPaginatedList((s, l, f) => api.orders.list(s, l, f), skip, limit, filters);

export const fetchProjectsPage = (skip: number, limit: number, filters?: ListFilterParams) =>
  fetchPaginatedList((s, l, f) => api.projects.list(s, l, undefined, f), skip, limit, filters);

export const fetchUsersPage = (skip: number, limit: number, filters?: ListFilterParams) =>
  fetchPaginatedList((s, l, f) => api.users.list(s, l, f), skip, limit, filters);

export const fetchInventoryPage = (
  skip: number,
  limit: number,
  inventoryType?: string,
  filters?: ListFilterParams
) =>
  fetchPaginatedList(
    (s, l, f) => api.inventory.list(s, l, inventoryType, f),
    skip,
    limit,
    filters
  );

export async function fetchAllMatchingInventoryIds(
  inventoryType?: string,
  filters?: ListFilterParams
): Promise<number[]> {
  try {
    const res = await api.inventory.listIds(inventoryType, filters);
    if (Array.isArray(res.data?.ids)) return res.data.ids;
  } catch {
    // Fall back to paging the list when the ids endpoint is unavailable.
  }

  const ids: number[] = [];
  const limit = LIST_BOOTSTRAP_SIZE;
  let skip = 0;
  let total = Number.POSITIVE_INFINITY;
  while (skip < total) {
    const page = await fetchInventoryPage(skip, limit, inventoryType, filters);
    total = page.total;
    ids.push(
      ...page.items
        .map((item) => item.id)
        .filter((id): id is number => typeof id === 'number')
    );
    if (page.items.length === 0) break;
    skip += limit;
    if (ids.length >= ABSOLUTE_FETCH_CAP) break;
  }
  return ids;
}

export const fetchSystemsPage = (skip: number, limit: number, filters?: ListFilterParams) =>
  fetchPaginatedList((s, l, f) => api.systems.list(s, l, undefined, f), skip, limit, filters);

export const fetchSubsystemsPage = (skip: number, limit: number, filters?: ListFilterParams) =>
  fetchPaginatedList((s, l, f) => api.subsystems.list(s, l, undefined, f), skip, limit, filters);

export const fetchModulesPage = (skip: number, limit: number, filters?: ListFilterParams) =>
  fetchPaginatedList((s, l, f) => api.modules.list(s, l, undefined, f), skip, limit, filters);

export const fetchUnitsPage = (skip: number, limit: number, filters?: ListFilterParams) =>
  fetchPaginatedList((s, l, f) => api.units.list(s, l, undefined, f), skip, limit, filters);

export const fetchComponentsPage = (skip: number, limit: number, filters?: ListFilterParams) =>
  fetchPaginatedList((s, l, f) => api.components.list(s, l, undefined, f), skip, limit, filters);

export const fetchAllComponents = (filters?: ListFilterParams) =>
  fetchCappedPages<Component>(
    (skip, limit, options) => api.components.list(skip, limit, options, filters),
    { pageSize: LIST_BOOTSTRAP_SIZE, maxItems: ABSOLUTE_FETCH_CAP },
  );

export const fetchMaintenanceLogsPage = (skip: number, limit: number, filters?: ListFilterParams) =>
  fetchPaginatedList((s, l, f) => api.maintenanceLogs.list(s, l, f), skip, limit, filters);

export const fetchMaintenanceCasesPage = (
  skip: number,
  limit: number,
  filters?: ListFilterParams
) => fetchPaginatedList((s, l, f) => api.maintenanceCases.list(s, l, f), skip, limit, filters);

export const fetchStatusesPage = (skip: number, limit: number, statusType?: string) =>
  fetchPaginatedList((s, l) => api.statuses.list(s, l, statusType), skip, limit);

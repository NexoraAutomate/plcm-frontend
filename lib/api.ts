import axios from "axios";
import type * as Models from "./models";
import type { ListFilterParams } from "./list-filters";
import { normalizeListFilters } from "./list-filters";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000/api' ||'http://193.193.193.80:8000/api';

export type ListRequestOptions = { includeTotal?: boolean };

export function buildQueryParams(
  params: Record<string, string | number | boolean | undefined | null>
) {
  const cleaned = Object.fromEntries(
    Object.entries(params).filter(
      ([, value]) => value !== undefined && value !== null && value !== ''
    )
  ) as Record<string, string | number | boolean>;

  return Object.keys(cleaned).length > 0 ? cleaned : undefined;
}

function listParams(
  skip: number,
  limit: number,
  options?: ListRequestOptions,
  filters?: ListFilterParams
) {
  const normalized = normalizeListFilters(filters);
  return buildQueryParams({
    skip,
    limit,
    include_total: options?.includeTotal === false ? false : true,
    ...normalized,
  });
}

const api = axios.create({
  baseURL: API_BASE,
  timeout: 45_000,
});

api.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

function clearClientAuth() {
  if (typeof window === "undefined") return;
  localStorage.removeItem("token");
  localStorage.removeItem("sat-user");
  localStorage.removeItem("session_id");
  document.cookie = "token=; path=/; max-age=0";
}

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (typeof window !== "undefined" && error?.response?.status === 401) {
      const detail = error.response?.data?.detail;
      const url = String(error.config?.url || "");
      const isAuthAttempt =
        url.includes("/auth/login") ||
        url.includes("/auth/token") ||
        url.includes("/auth/change-password");
      const sessionEnded =
        typeof detail === "string" &&
        (detail === "Session has been terminated" ||
          detail === "Could not validate credentials" ||
          detail === "User is inactive" ||
          detail.includes("inactive or pending") ||
          detail.includes("User is inactive"));

      if (!isAuthAttempt && sessionEnded) {
        clearClientAuth();
        if (!window.location.pathname.startsWith("/login")) {
          window.location.href = "/login";
        }
      }
    }
    return Promise.reject(error);
  }
);

export async function fetchStatusesByType(statusType: string): Promise<Models.Status[]> {
  try {
    const res = await api.get<Models.Status[]>('/statuses/', {
      params: buildQueryParams({ status_type: statusType }),
    });
    return res.data;
  } catch {
    const res = await api.get<Models.Status[]>('/statuses/');
    return res.data.filter((status) => status.status_type === statusType);
  }
}

// Authentication
export const auth = {
  login: (username: string, password: string) =>
    api.post<{ access_token: string; token_type: string }>("/auth/login", { username, password }),
  logout: () => api.post("/auth/logout"),
  listRoles: (sort_by?: string, sort_order?: 'asc' | 'desc') =>
    api.get<Models.Role[]>("/auth/roles", { params: buildQueryParams({ sort_by, sort_order }) }),
  getMe: () => api.get("/auth/me"),
  changePassword: (old_password: string, new_password: string) =>
    api.post<{ message: string }>("/auth/change-password", { old_password, new_password }),
  uploadAvatar: (file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    return api.post<{ avatar_url: string }>("/auth/avatar/", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },
  deleteAvatar: () => api.delete<{ avatar_url: string | null }>("/auth/avatar/"),
  register: (userData: any) => api.post("/auth/register", userData),
  signup: (userData: {
    username: string;
    password: string;
    full_name: string;
    email?: string;
  }) =>
    api.post<{ message: string; username: string }>("/auth/signup", userData),
  getRole: (id: number) => api.get<Models.Role>(`/auth/roles/${id}`),
  createRole: (data: { name: string; description?: string; permission_ids?: number[] }) =>
    api.post<Models.Role>("/auth/roles", data),
  updateRole: (
    id: number,
    data: { name?: string; description?: string; permission_ids?: number[] }
  ) => api.put<Models.Role>(`/auth/roles/${id}`, data),
  deleteRole: (id: number) => api.delete(`/auth/roles/${id}`),
  updateRolePermissions: (id: number, permission_ids: number[]) =>
    api.put<Models.Role>(`/auth/roles/${id}/permissions`, { permission_ids }),
  listPermissionRegistry: (sort_by?: string, sort_order?: 'asc' | 'desc') =>
    api.get<Models.Permission[]>("/auth/permission-registry", {
      params: buildQueryParams({ sort_by, sort_order }),
    }),
  createPermission: (data: { name: string; description?: string }) =>
    api.post<Models.Permission>("/auth/permission-registry", data),
  updatePermission: (id: number, data: { name?: string; description?: string }) =>
    api.put<Models.Permission>(`/auth/permission-registry/${id}`, data),
  deletePermission: (id: number) => api.delete(`/auth/permission-registry/${id}`),
  assignRole: (userId: number, roleId: number) =>
    api.post("/auth/assign-role", { user_id: userId, role_id: roleId }),
  removeRole: (userId: number, roleId: number) =>
    api.delete("/auth/remove-role", { data: { user_id: userId, role_id: roleId } }),
  deregister: (userId: number) => api.delete(`/users/${userId}/`),
  getSecuritySettings: () => api.get<Models.SecuritySettings>("/auth/security-settings"),
  updateSecuritySettings: (data: Partial<Models.SecuritySettings>) =>
    api.put<Models.SecuritySettings>("/auth/security-settings", data),
  getAppDefinitions: () => api.get<Models.AppDefinitions>("/definitions"),
  updateAppDefinitions: (data: Partial<Models.AppDefinitions>) =>
    api.put<Models.AppDefinitions>("/definitions", data),
  getPasswordPolicy: () => api.get<Models.PasswordPolicyPublic>("/auth/password-policy"),
  listSessions: (skip = 0, limit = 100) =>
    api.get<Models.ActiveSession[]>("/auth/sessions", {
      params: buildQueryParams({ skip, limit }),
    }),
  terminateSession: (sessionId: string) =>
    api.delete<{ message: string; session_id: string }>(`/auth/sessions/${sessionId}`),
  terminateAllSessions: (exceptCurrent = true) =>
    api.delete<{ message: string; terminated: number }>("/auth/sessions", {
      params: { except_current: exceptCurrent },
    }),
  listLoginHistory: (
    skip = 0,
    limit = 50,
    params?: {
      user_id?: number;
      search?: string;
      login_status?: string;
      date_from?: string;
      date_to?: string;
      sort_by?: string;
      sort_order?: 'asc' | 'desc';
    }
  ) =>
    api.get<Models.UserLoginHistory[]>("/auth/login-history", {
      params: buildQueryParams({ skip, limit, ...params }),
    }),
  runInactivityCheck: (dry_run = false) =>
    api.post("/auth/run-inactivity-check", null, { params: { dry_run } }),
};

// Users
export const users = {
  list: (skip = 0, limit = 100, filters?: ListFilterParams) =>
    api.get<Models.User[]>("/users/", { params: listParams(skip, limit, undefined, filters) }),
  usersWithRoles: () => api.get("/users/with-roles/"),
  get: (id: number) => api.get<Models.User>(`/users/${id}/`),
  create: (data: Partial<Models.User> & { password?: string }) =>
    api.post<Models.User>("/users/", data),
  update: (id: number, data: Partial<Models.User> & { password?: string }) =>
    api.put<Models.User>(`/users/${id}/`, data),
  delete: (id: number) => api.delete(`/users/${id}/`),
  stats: () => api.get<Models.UserStatsSummary>("/users/stats/summary"),
  activity: (id: number) => api.get<Models.UserActivitySummary>(`/users/${id}/activity/`),
  loginHistory: (
    id: number,
    skip = 0,
    limit = 50,
    params?: {
      search?: string;
      login_status?: string;
      date_from?: string;
      date_to?: string;
      sort_by?: string;
      sort_order?: 'asc' | 'desc';
    }
  ) =>
    api.get<Models.UserLoginHistory[]>(`/users/${id}/login-history/`, {
      params: buildQueryParams({ skip, limit, ...params }),
    }),
  fetchAvatarBlob: (id: number) =>
    api.get<Blob>(`/users/${id}/avatar/`, { responseType: "blob" }),
  uploadAvatar: (id: number, file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    return api.post<{ avatar_url: string }>(`/users/${id}/avatar/`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },
  deleteAvatar: (id: number) =>
    api.delete<{ avatar_url: string | null }>(`/users/${id}/avatar/`),
};

// Customers
export const customers = {
  list: (skip = 0, limit = 100, filters?: ListFilterParams) =>
    api.get<Models.Customer[]>("/customers/", { params: listParams(skip, limit, undefined, filters) }),
  get: (id: number) => api.get<Models.Customer>(`/customers/${id}/`),
  create: (data: Partial<Models.Customer>) => api.post<Models.Customer>("/customers/", data),
  update: (id: number, data: Partial<Models.Customer>) => api.put<Models.Customer>(`/customers/${id}/`, data),
  delete: (id: number) => api.delete(`/customers/${id}/`),
};

// Orders
export const orders = {
  list: (skip = 0, limit = 100, filters?: ListFilterParams) =>
    api.get<Models.Order[]>("/orders/", { params: listParams(skip, limit, undefined, filters) }),
  get: (id: number) => api.get<Models.Order>(`/orders/${id}/`),
  create: (data: Partial<Models.Order>) => api.post<Models.Order>("/orders/", data),
  update: (id: number, data: Partial<Models.Order>) => api.put<Models.Order>(`/orders/${id}/`, data),
  delete: (id: number) => api.delete(`/orders/${id}/`),
};

// Projects
export const projects = {
  list: (skip = 0, limit = 100, options?: ListRequestOptions, filters?: ListFilterParams) =>
    api.get<Models.Project[]>("/projects/", { params: listParams(skip, limit, options, filters) }),
  get: (id: number) => api.get<Models.Project>(`/projects/${id}/`),
  create: (data: Partial<Models.Project>) => api.post<Models.Project>("/projects/", data),
  createDraft: (data: Models.ProjectDraftCreate) =>
    api.post<Models.Project>("/projects/draft/", data),
  assignHm: (id: number, hmUserId: number) =>
    api.post<Models.Project>(`/projects/${id}/assign-hm/`, { hm_user_id: hmUserId }),
  approve: (id: number) => api.post<Models.Project>(`/projects/${id}/approve/`),
  generateHierarchy: (id: number) =>
    api.post<{
      ok: boolean;
      project_id: number;
      status: string;
      config_code?: string;
      config_name?: string;
      product_type?: string;
      counts: {
        flights: number;
        sdls: number;
        systems: number;
        subsystems: number;
        modules: number;
        units: number;
        components: number;
      };
      project?: Models.Project;
    }>(`/projects/${id}/generate-hierarchy/`),
  hierarchyTree: (id: number) =>
    api.get<{
      project_id: number;
      status?: string;
      flights: Array<{
        id: number;
        name: string;
        code?: string;
        sequence: number;
        sdls: Array<{
          id: number;
          name: string;
          code?: string;
          sequence: number;
          product_type?: string;
          systems: Array<{ id: number; name: string; subsystem_count: number }>;
        }>;
      }>;
    }>(`/projects/${id}/hierarchy-tree/`),
  update: (id: number, data: Partial<Models.Project>) => api.put<Models.Project>(`/projects/${id}/`, data),
  delete: (id: number) => api.delete(`/projects/${id}/`),
  getSystems: (id: number) => api.get<Models.System[]>(`/projects/${id}/systems/`),
};

// Systems
export const systems = {
  list: (skip = 0, limit = 100, options?: ListRequestOptions, filters?: ListFilterParams) =>
    api.get<Models.System[]>("/systems/", { params: listParams(skip, limit, options, filters) }),
  get: (id: number) => api.get<Models.System>(`/systems/${id}/`),
  create: (data: Partial<Models.System>) => api.post<Models.System>("/systems/", data),
  update: (id: number, data: Partial<Models.System>) => api.put<Models.System>(`/systems/${id}/`, data),
  delete: (id: number) => api.delete(`/systems/${id}/`),
  getSubsystems: (id: number) => api.get<Models.Subsystem[]>(`/systems/${id}/subsystems/`),
};

// Subsystems
export const subsystems = {
  list: (skip = 0, limit = 100, options?: ListRequestOptions, filters?: ListFilterParams) =>
    api.get<Models.Subsystem[]>("/subsystems/", { params: listParams(skip, limit, options, filters) }),
  get: (id: number) => api.get<Models.Subsystem>(`/subsystems/${id}/`),
  create: (data: Partial<Models.Subsystem>) => api.post<Models.Subsystem>("/subsystems/", data),
  update: (id: number, data: Partial<Models.Subsystem>) => api.put<Models.Subsystem>(`/subsystems/${id}/`, data),
  delete: (id: number) => api.delete(`/subsystems/${id}/`),
  getModules: (id: number) => api.get<Models.Module[]>(`/subsystems/${id}/modules/`),
};

// Modules
export const modules = {
  list: (skip = 0, limit = 100, options?: ListRequestOptions, filters?: ListFilterParams) =>
    api.get<Models.Module[]>("/modules/", { params: listParams(skip, limit, options, filters) }),
  get: (id: number) => api.get<Models.Module>(`/modules/${id}/`),
  create: (data: Partial<Models.Module>) => api.post<Models.Module>("/modules/", data),
  update: (id: number, data: Partial<Models.Module>) => api.put<Models.Module>(`/modules/${id}/`, data),
  delete: (id: number) => api.delete(`/modules/${id}/`),
  getUnits: (id: number) => api.get<Models.Unit[]>(`/modules/${id}/units/`),
};

// Units
export const units = {
  list: (skip = 0, limit = 100, options?: ListRequestOptions, filters?: ListFilterParams) =>
    api.get<Models.Unit[]>("/units/", { params: listParams(skip, limit, options, filters) }),
  get: (id: number) => api.get<Models.Unit>(`/units/${id}/`),
  create: (data: Partial<Models.Unit>) => api.post<Models.Unit>("/units/", data),
  update: (id: number, data: Partial<Models.Unit>) => api.put<Models.Unit>(`/units/${id}/`, data),
  delete: (id: number) => api.delete(`/units/${id}/`),
  getComponents: (id: number) => api.get<Models.Component[]>(`/units/${id}/components/`),
};

// Components
export const components = {
  list: (skip = 0, limit = 100, options?: ListRequestOptions, filters?: ListFilterParams) =>
    api.get<Models.Component[]>("/components/", { params: listParams(skip, limit, options, filters) }),
  get: (id: number) => api.get<Models.Component>(`/components/${id}/`),
  create: (data: Partial<Models.Component>) => api.post<Models.Component>("/components/", data),
  update: (id: number, data: Partial<Models.Component>) => api.put<Models.Component>(`/components/${id}/`, data),
  delete: (id: number) => api.delete(`/components/${id}/`),
};

// Hierarchies
export const hierarchies = {
  list: (hierarchy_type?: string, parent_id?: number) =>
    api.get<Models.Hierarchy[]>("/hierarchies/", {
      params: buildQueryParams({ hierarchy_type, parent_id }),
    }),
  get: (id: number) => api.get<Models.Hierarchy>(`/hierarchies/${id}/`),
  create: (data: Partial<Models.Hierarchy>) => api.post<Models.Hierarchy>("/hierarchies/", data),
  batchCreate: (
    items: Array<Partial<Models.Hierarchy> & { description?: string | null }>
  ) => api.post<Models.Hierarchy[]>("/hierarchies/batch/", items),
  update: (id: number, data: Partial<Models.Hierarchy>) => api.put<Models.Hierarchy>(`/hierarchies/${id}/`, data),
  delete: (id: number) => api.delete(`/hierarchies/${id}/`),
};

// Spec 01 — Smart SDLS hierarchy configurations
export const hierarchyConfigurations = {
  meta: () => api.get<Models.HierarchyConfigMeta>("/hierarchy-configurations/meta"),
  list: (availableOnly = false) =>
    api.get<Models.HierarchyConfiguration[]>("/hierarchy-configurations/", {
      params: buildQueryParams({ available_only: availableOnly || undefined }),
    }),
  listAvailable: () =>
    api.get<Models.HierarchyConfigurationSummary[]>(
      "/hierarchy-configurations/available"
    ),
  get: (id: number) =>
    api.get<Models.HierarchyConfiguration>(`/hierarchy-configurations/${id}`),
  create: (data: Models.HierarchyConfigurationWrite) =>
    api.post<Models.HierarchyConfiguration>("/hierarchy-configurations/", data),
  update: (id: number, data: Partial<Models.HierarchyConfigurationWrite>) =>
    api.put<Models.HierarchyConfiguration>(`/hierarchy-configurations/${id}`, data),
  setAvailable: (id: number, isAvailable: boolean) =>
    api.patch<Models.HierarchyConfiguration>(
      `/hierarchy-configurations/${id}/availability`,
      null,
      { params: { is_available: isAvailable } }
    ),
  remove: (id: number, hard = false) =>
    api.delete(`/hierarchy-configurations/${id}`, { params: { hard } }),
};

// Inventory
export const inventory = {
  list: (skip = 0, limit = 100, inventoryType?: string, filters?: ListFilterParams) =>
    api.get<Models.Inventory[]>('/inventory/', {
      params: listParams(skip, limit, undefined, {
        ...filters,
        inventory_type: inventoryType ?? filters?.inventory_type,
      }),
    }),
  get: (id: number) => api.get<Models.Inventory>(`/inventory/${id}/`),
  listByEntity: (entityId: number) =>
    api.get<Models.Inventory[]>(`/inventory/by-entity/${entityId}/`),
  create: (data: Partial<Models.Inventory>) => api.post<Models.Inventory>("/inventory/", data),
  update: (id: number, data: Partial<Models.Inventory>) => api.put<Models.Inventory>(`/inventory/${id}/`, data),
  delete: (id: number) => api.delete(`/inventory/${id}/`),
  consume: (
    id: number,
    instanceId?: number,
    options?: {
      issuanceId?: number | null
      installedEntityType?: string | null
      installedEntityId?: number | null
    }
  ) =>
    api.post<Models.InventoryConsumeResult>(`/inventory/${id}/consume/`, {
      instance_id: instanceId ?? null,
      issuance_id: options?.issuanceId ?? null,
      installed_entity_type: options?.installedEntityType ?? null,
      installed_entity_id: options?.installedEntityId ?? null,
    }),
  issue: (id: number, data: Models.InventoryIssuePayload) =>
    api.post<Models.InventoryIssuance>(`/inventory/${id}/issue/`, data),
  listIssuances: (params?: {
    status?: string
    issued_to_user_id?: number
    issued_by_user_id?: number
    inventory_id?: number
    part_number?: string
    serial_number?: string
    search?: string
  }) =>
    api.get<Models.InventoryIssuance[]>('/inventory/issuances/', { params }),
  getIssuance: (issuanceId: number) =>
    api.get<Models.InventoryIssuance>(`/inventory/issuances/${issuanceId}/`),
  getIssuanceHistory: (issuanceId: number) =>
    api.get<Models.InventoryIssuanceEvent[]>(`/inventory/issuances/${issuanceId}/history/`),
  returnIssuance: (issuanceId: number, notes: string) =>
    api.post<Models.InventoryIssuance>(`/inventory/issuances/${issuanceId}/return/`, {
      notes,
    }),
  acceptReturn: (issuanceId: number, notes: string) =>
    api.post<Models.InventoryIssuance>(`/inventory/issuances/${issuanceId}/accept-return/`, {
      notes,
    }),
  rejectReturn: (issuanceId: number, notes: string) =>
    api.post<Models.InventoryIssuance>(`/inventory/issuances/${issuanceId}/reject-return/`, {
      notes,
    }),
  listReturnNotices: (options?: {
    unreadOnly?: boolean
    pendingOnly?: boolean
    search?: string
  }) =>
    api.get<Models.InventoryReturnNotice[]>('/inventory/return-notices/', {
      params: {
        unread_only: options?.unreadOnly ?? false,
        pending_only: options?.pendingOnly ?? false,
        search: options?.search || undefined,
      },
    }),
  markReturnNoticeRead: (noticeId: number) =>
    api.post<Models.InventoryReturnNotice>(`/inventory/return-notices/${noticeId}/read/`),
  markAllReturnNoticesRead: () =>
    api.post<{ ok: boolean; marked: number }>('/inventory/return-notices/read-all/'),
  listInstallerNotices: (options?: {
    unreadOnly?: boolean
    search?: string
    allUsers?: boolean
  }) =>
    api.get<Models.InventoryInstallerNotice[]>('/inventory/installer-notices/', {
      params: {
        unread_only: options?.unreadOnly ?? false,
        search: options?.search || undefined,
        all_users: options?.allUsers ?? false,
      },
    }),
  markInstallerNoticeRead: (noticeId: number) =>
    api.post<Models.InventoryInstallerNotice>(
      `/inventory/installer-notices/${noticeId}/read/`
    ),
  markAllInstallerNoticesRead: (options?: { allUsers?: boolean }) =>
    api.post<{ ok: boolean; marked: number }>('/inventory/installer-notices/read-all/', {
      params: { all_users: options?.allUsers ?? false },
    }),
  linkIssuanceInstall: (
    issuanceId: number,
    installedEntityType: string,
    installedEntityId: number
  ) =>
    api.post<Models.InventoryIssuance>(`/inventory/issuances/${issuanceId}/link-install/`, {
      installed_entity_type: installedEntityType,
      installed_entity_id: installedEntityId,
    }),
  revertToStock: (entityType: string, entityId: number, notes?: string) =>
    api.post<Models.InventoryRevertResult>('/inventory/revert-to-stock/', {
      entity_type: entityType,
      entity_id: entityId,
      notes: notes ?? null,
    }),
  listInstances: (inventoryId: number) =>
    api.get<Models.InventoryInstance[]>(`/inventory/${inventoryId}/instances/`),
  createInstance: (inventoryId: number, data: Partial<Models.InventoryInstance>) =>
    api.post<Models.InventoryInstance>(`/inventory/${inventoryId}/instances/`, data),
  updateInstance: (instanceId: number, data: Partial<Models.InventoryInstance>) =>
    api.put<Models.InventoryInstance>(`/inventory/instances/${instanceId}/`, data),
  deleteInstance: (instanceId: number) => api.delete(`/inventory/instances/${instanceId}/`),
  getChildren: (
    inventoryId: number,
    options?: { parentInstanceId?: number; parentInstanceSerial?: string }
  ) =>
    api.get<Models.InventoryChildLink[]>(`/inventory/${inventoryId}/children/`, {
      params: {
        ...(options?.parentInstanceId != null
          ? { parent_instance_id: options.parentInstanceId }
          : {}),
        ...(options?.parentInstanceSerial
          ? { parent_instance_serial: options.parentInstanceSerial }
          : {}),
      },
    }),
  replaceChildren: (
    inventoryId: number,
    data: {
      parent_instance_id?: number;
      parent_instance_serial?: string;
      children: Array<{
        child_category_name: string;
        child_inventory_id: number;
        child_instance_id?: number;
        child_instance_serial?: string;
      }>;
    }
  ) => api.put<Models.InventoryChildLink[]>(`/inventory/${inventoryId}/children/`, data),
};

// Statuses
export const statuses = {
  /** Paginated list, or pass a status type string as the first arg (legacy). */
  list: (skipOrStatusType: number | string = 0, limit = 100, status_type?: string) => {
    const skip = typeof skipOrStatusType === 'string' ? 0 : skipOrStatusType;
    const resolvedStatusType =
      typeof skipOrStatusType === 'string' ? skipOrStatusType : status_type;
    return api.get<Models.Status[]>('/statuses/', {
      params: buildQueryParams({ skip, limit, status_type: resolvedStatusType }),
    });
  },
  get: (id: number) => api.get<Models.Status>(`/statuses/${id}/`),
  create: (data: Partial<Models.Status>) => api.post<Models.Status>("/statuses/", data),
  batchCreate: (items: Array<Partial<Models.Status>>) =>
    api.post<Models.Status[]>("/statuses/batch/", items),
  update: (id: number, data: Partial<Models.Status>) => api.put<Models.Status>(`/statuses/${id}/`, data),
  delete: (id: number) => api.delete(`/statuses/${id}/`),
};

// Entities
export const entities = {
  list: (skip = 0, limit = 100, filters?: ListFilterParams) =>
    api.get<Models.Entity[]>("/entities/", {
      params: listParams(skip, limit, undefined, filters),
    }),
  lookup: (entityType: string, entityPk: number) =>
    api.get<Models.Entity>('/entities/lookup/', {
      params: buildQueryParams({ entity_type: entityType, entity_pk: entityPk }),
    }),
  get: (id: number) => api.get<Models.Entity>(`/entities/${id}/`),
  getStatusHistory: (id: number) => api.get<Models.EntityStatusHistory[]>(`/entities/${id}/status-history/`),
  getMaintenanceLogs: (id: number) => api.get<Models.MaintenanceLog[]>(`/entities/${id}/maintenance-logs/`),
  getReplacementChain: (entityType: string, entityPk: number) =>
    api.get<Models.EntityReplacementChainItem[]>(
      `/entities/${encodeURIComponent(entityType)}/${entityPk}/replacement-chain/`
    ),
  partNumber: () => api.get<string[]>("/part-numbers/"),
  serialNumbers: (options?: { q?: string; limit?: number }) =>
    api.get<string[]>("/serial-numbers/", {
      params: buildQueryParams({
        q: options?.q,
        limit: options?.limit,
      }),
    }),
};

// Entity Status History
export const entityStatusHistory = {
  list: (skip = 0, limit = 100) =>
    api.get<Models.EntityStatusHistory[]>("/entity-status-history/", { params: { skip, limit } }),
  get: (id: number) => api.get<Models.EntityStatusHistory>(`/entity-status-history/${id}/`),
  create: (data: Partial<Models.EntityStatusHistory>) => api.post<Models.EntityStatusHistory>("/entity-status-history/", data),
};

// maintenanceLogs Logs
export const maintenanceLogs = {
  list: (skip = 0, limit = 100, filters?: ListFilterParams) =>
    api.get<Models.MaintenanceLog[]>('/maintenance-logs/', {
      params: listParams(skip, limit, undefined, filters),
    }),
  get: (id: number) => api.get<Models.MaintenanceLog>(`/maintenance-logs/${id}/`),
  create: (data: Partial<Models.MaintenanceLog>) => api.post<Models.MaintenanceLog>('/maintenance-logs/', data),
  update: (id: number, data: Partial<Models.MaintenanceLog>) => api.put<Models.MaintenanceLog>(`/maintenance-logs/${id}/`, data),
  delete: (id: number) => api.delete(`/maintenance-logs/${id}/`),
};

// Maintenance Cases
export const maintenanceCases = {
  list: (skip = 0, limit = 100, filters?: ListFilterParams) =>
    api.get<Models.MaintenanceCase[]>('/maintenance-cases/', {
      params: listParams(skip, limit, undefined, filters),
    }),
  get: (id: number) => api.get<Models.MaintenanceCase>(`/maintenance-cases/${id}/`),
  create: (data: Models.CreateMaintenanceCasePayload) => api.post<Models.MaintenanceCase>('/maintenance-cases/', data),
  update: (id: number, data: Models.UpdateMaintenanceCasePayload) => api.put<Models.MaintenanceCase>(`/maintenance-cases/${id}/`, data),
  delete: (id: number) => api.delete(`/maintenance-cases/${id}/`),
  lookupEntityByPartNumber: (partNumber: string) =>
    api.get<Models.lookUpResponse>(`/entities/lookup-by-PN/${encodeURIComponent(partNumber)}/`),
  lookupEntityBySerialNumber: (serialNumber: string) =>
    api.get<Models.lookUpResponse>(`/entities/lookup-by-SN/${encodeURIComponent(serialNumber)}/`),
  suspectChildren: (caseId: number, data: Models.SuspectChildrenPayload) => api.post(`/maintenance-cases/${caseId}/suspect-children/`, data),
  confirmFault: (caseId: number, data: Models.ConfirmFaultPayload) => api.post(`/maintenance-cases/${caseId}/confirm-fault/`, data),
  adminHierarchyReplace: (data: Models.AdminHierarchyReplacePayload) =>
    api.post<Models.AdminHierarchyReplaceResponse>('/maintenance-cases/admin-hierarchy-replace/', data),
};

// Faulty Entities
export const faultyEntities = {
  list: (skip = 0, limit = 100) => api.get<Models.FaultyEntity[]>('/faulty-entities/', { params: { skip, limit } }),
  listByCaseId: (caseId: number, skip = 0, limit = 100) => api.get<Models.FaultyEntity[]>(`/maintenance-cases/${caseId}/faulty-entities/`, { params: { skip, limit } }),
  get: (id: number) =>    api.get<Models.FaultyEntity>(`/faulty-entities/${id}/`),
  create: (data: Models.CreateFaultyEntityPayload) =>    api.post<Models.FaultyEntity>('/faulty-entities/', data),
  update: (id: number, data: Models.UpdateFaultyEntityPayload) => api.put<Models.FaultyEntity>(`/faulty-entities/${id}/`, data),
  updateChildren: (id: number, data: Models.UpdateFaultyEntityPayload) => api.put<Models.FaultyEntity>(`/faulty-entities-Children/${id}/`, data),
  delete: (id: number) =>    api.delete(`/faulty-entities/${id}/`),
  cascadeFault: (entityId: number, faultType: string) =>    api.post(`/faulty-entities/${entityId}/cascade-fault/`, {fault_type: faultType }),
  getMaintenanceHistory: (entityId: number) => api.get<Models.MaintenanceAction[]>(`/faulty-entities/${entityId}/history/`),
  getEntityMaintenanceHistory: (entityType: string, entityId: number) =>
    api.get<Models.FaultyEntity[]>(`/entities/${entityType}/${entityId}/maintenance-history/`),
};

// Maintenance Actions
export const maintenanceActions = {
  list: (skip?: number, limit?: number, caseId?: number) =>
    api.get<Models.MaintenanceAction[]>('/maintenance-actions/', {
      params: buildQueryParams({ skip, limit, case_id: caseId }),
    }),
  listByFaultyEntityId: (faultyEntityId: number, skip?: number, limit?: number) =>
    api.get<Models.MaintenanceAction[]>(`/faulty-entities/${faultyEntityId}/actions/`, {
      params: buildQueryParams({ skip, limit }),
    }),
  get: (id: number) =>    api.get<Models.MaintenanceAction>(`/maintenance-actions/${id}/`),
  create: (data: Models.CreateMaintenanceActionPayload) =>    api.post<Models.MaintenanceAction>('/maintenance-actions/', data),
  update: (id: number, data: Models.UpdateMaintenanceActionPayload) =>    api.put<Models.MaintenanceAction>(`/maintenance-actions/${id}/`, data),
  delete: (id: number) =>    api.delete(`/maintenance-actions/${id}/`),
};

// Maintenance Deliveries
export const maintenanceDeliveries = {
  list: (skip?: number, limit?: number) =>
    api.get<Models.MaintenanceDelivery[]>('/maintenance-deliveries/', {
      params: buildQueryParams({ skip, limit }),
    }),
  listByCaseId: (caseId: number, skip?: number, limit?: number) =>
    api.get<Models.MaintenanceDelivery[]>(`/maintenance-cases/${caseId}/deliveries/`, {
      params: buildQueryParams({ skip, limit }),
    }),
  get: (id: number) =>    api.get<Models.MaintenanceDelivery>(`/maintenance-deliveries/${id}/`),
  create: (data: Models.CreateMaintenanceDeliveryPayload) =>    api.post<Models.MaintenanceDelivery>('/maintenance-deliveries/', data),
  update: (id: number, data: Models.UpdateMaintenanceDeliveryPayload) =>    api.put<Models.MaintenanceDelivery>(`/maintenance-deliveries/${id}/`, data),
  confirm: (id: number, receivedBy: string) =>    api.post(`/maintenance-deliveries/${id}/confirm/`, { received_by: receivedBy }),
  delete: (id: number) =>    api.delete(`/maintenance-deliveries/${id}/`),
};

// Configurations History
export const configurationHistory = {
  confirm: (id: number, receivedBy: string) =>    api.post(`/configuration_history/${id}/confirm/`, { received_by: receivedBy }),
  delete: (id: number) =>    api.delete(`/configuration_history/${id}/`),
  list: (skip?: number, limit?: number) =>
    api.get<Models.ConfigurationHistory[]>('/configuration_history_list/', {
      params: buildQueryParams({ skip, limit }),
    }),
  get: (id: number) =>    api.get<Models.ConfigurationHistory>(`/configuration_history/${id}/`),
  listByCaseId: (caseId: number, skip?: number, limit?: number) =>
    api.get<Models.ConfigurationHistory[]>(`/configuration_history_list/${caseId}/caseID/`, {
      params: buildQueryParams({ skip, limit }),
    }),
  listByEntityID: (entityId: number, skip?: number, limit?: number) =>
    api.get<Models.ConfigurationHistory[]>(`/configuration_history_list/${entityId}/EntityID/`, {
      params: buildQueryParams({ skip, limit }),
    }),
  create: (data: Models.CreateConfigurationHistoryPayload) =>    api.post<Models.ConfigurationHistory>('/configuration_history/', data),
  update: (id: number, data: Models.UpdateConfigurationHistoryPayload) =>    api.put<Models.ConfigurationHistory>(`/configuration_history/${id}/`, data),
};

// Entity attachments
export const attachments = {
  list: (ownerType: string, ownerId: number) =>
    api.get<Models.EntityAttachment[]>('/attachments/', {
      params: buildQueryParams({ owner_type: ownerType, owner_id: ownerId }),
    }),
  upload: async (
    ownerType: string,
    ownerId: number,
    file: File,
    metadata?: Models.EntityAttachmentMetadata
  ) => {
    const formData = new FormData();
    formData.append('owner_type', ownerType);
    formData.append('owner_id', String(ownerId));
    formData.append('file', file);
    formData.append('attachment_type', metadata?.attachment_type ?? 'other');
    if (metadata?.description?.trim()) {
      formData.append('description', metadata.description.trim());
    }
    return api.post<Models.EntityAttachment>('/attachments/', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  update: (attachmentId: number, data: Models.EntityAttachmentMetadata) =>
    api.patch<Models.EntityAttachment>(`/attachments/${attachmentId}/`, data),
  delete: (attachmentId: number) => api.delete(`/attachments/${attachmentId}/`),
  copy: (fromOwnerType: string, fromOwnerId: number, toOwnerType: string, toOwnerId: number) => {
    const formData = new FormData();
    formData.append('from_owner_type', fromOwnerType);
    formData.append('from_owner_id', String(fromOwnerId));
    formData.append('to_owner_type', toOwnerType);
    formData.append('to_owner_id', String(toOwnerId));
    return api.post<Models.EntityAttachment[]>('/attachments/copy/', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  download: async (attachmentId: number, fileName: string) => {
    const res = await api.get<Blob>(`/attachments/${attachmentId}/download/`, {
      responseType: 'blob',
    });
    const url = URL.createObjectURL(res.data);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = fileName;
    anchor.click();
    URL.revokeObjectURL(url);
  },
};

export const pictures = {
  upload: async (ownerType: string, ownerId: number, file: File) => {
    const formData = new FormData();
    formData.append('owner_type', ownerType);
    formData.append('owner_id', String(ownerId));
    formData.append('file', file);
    return api.post<{ picture_url: string }>('/pictures/', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  fetchBlob: (ownerType: string, ownerId: number) =>
    api.get<Blob>('/pictures/', {
      params: buildQueryParams({ owner_type: ownerType, owner_id: ownerId }),
      responseType: 'blob',
    }),
  remove: (ownerType: string, ownerId: number) =>
    api.delete('/pictures/', {
      params: buildQueryParams({ owner_type: ownerType, owner_id: ownerId }),
    }),
  copy: (fromOwnerType: string, fromOwnerId: number, toOwnerType: string, toOwnerId: number) => {
    const formData = new FormData();
    formData.append('from_owner_type', fromOwnerType);
    formData.append('from_owner_id', String(fromOwnerId));
    formData.append('to_owner_type', toOwnerType);
    formData.append('to_owner_id', String(toOwnerId));
    return api.post<{ picture_url: string | null }>('/pictures/copy/', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
};

const BACKUP_TIMEOUT_MS = 10 * 60 * 1000;

export type RestoreBackupResult = {
  message: string;
  alembic_revision?: string;
  created_at?: string;
  created_by?: string;
};

export const backup = {
  create: async () => {
    const res = await api.post<Blob>(
      '/backup/',
      null,
      {
        responseType: 'blob',
        timeout: BACKUP_TIMEOUT_MS,
      }
    );

    const disposition = res.headers['content-disposition'] as string | undefined;
    let filename = `satlife-backup-${new Date().toISOString().replace(/[:.]/g, '-')}.zip`;
    if (disposition) {
      const match = /filename="?([^"]+)"?/i.exec(disposition);
      if (match?.[1]) filename = match[1];
    }

    const url = URL.createObjectURL(res.data);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
    return { filename };
  },
  restore: async (file: File, confirm: string) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('confirm', confirm);
    return api.post<RestoreBackupResult>('/backup/restore/', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: BACKUP_TIMEOUT_MS,
    });
  },
};

export default api;

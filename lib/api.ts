import axios from "axios";
import type * as Models from "./models";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000/api';

export function buildQueryParams(
  params: Record<string, string | number | undefined | null>
) {
  const cleaned = Object.fromEntries(
    Object.entries(params).filter(
      ([, value]) => value !== undefined && value !== null && value !== ''
    )
  ) as Record<string, string | number>;

  return Object.keys(cleaned).length > 0 ? cleaned : undefined;
}

const api = axios.create({
  baseURL: API_BASE,
  timeout: 20_000,
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
  listRoles: () => api.get("/auth/roles"),
  getMe: () => api.get("/auth/me"),
  register: (userData: any) => api.post("/auth/register", userData),
  getRole: (id: number) => api.get(`/auth/roles/${id}`),
  assignRole: (userId: number, roleId: number) =>
    api.post("/auth/assign-role", { user_id: userId, role_id: roleId }),
  removeRole: (userId: number, roleId: number) =>
    api.delete("/auth/remove-role", { data: { user_id: userId, role_id: roleId } }),
  deregister: (userId: number) => api.delete(`/auth/deregister/${userId}`),
};

// Users
export const users = {
  list: (skip = 0, limit = 100) => api.get<Models.User[]>("/users/", { params: { skip, limit } }),
  usersWithRoles: () => api.get("/users/with-roles/"),
  get: (id: number) => api.get<Models.User>(`/users/${id}/`),
  create: (data: Partial<Models.User>) => api.post<Models.User>("/users/", data),
  update: (id: number, data: Partial<Models.User>) => api.put<Models.User>(`/users/${id}/`, data),
  delete: (id: number) => api.delete(`/users/${id}/`),
};

// Customers
export const customers = {
  list: (skip = 0, limit = 100) => api.get<Models.Customer[]>("/customers/", { params: { skip, limit } }),
  get: (id: number) => api.get<Models.Customer>(`/customers/${id}/`),
  create: (data: Partial<Models.Customer>) => api.post<Models.Customer>("/customers/", data),
  update: (id: number, data: Partial<Models.Customer>) => api.put<Models.Customer>(`/customers/${id}/`, data),
  delete: (id: number) => api.delete(`/customers/${id}/`),
};

// Orders
export const orders = {
  list: (skip = 0, limit = 100) => api.get<Models.Order[]>("/orders/", { params: { skip, limit } }),
  get: (id: number) => api.get<Models.Order>(`/orders/${id}/`),
  create: (data: Partial<Models.Order>) => api.post<Models.Order>("/orders/", data),
  update: (id: number, data: Partial<Models.Order>) => api.put<Models.Order>(`/orders/${id}/`, data),
  delete: (id: number) => api.delete(`/orders/${id}/`),
};

// Projects
export const projects = {
  list: (skip = 0, limit = 100) => api.get<Models.Project[]>("/projects/", { params: { skip, limit } }),
  get: (id: number) => api.get<Models.Project>(`/projects/${id}/`),
  create: (data: Partial<Models.Project>) => api.post<Models.Project>("/projects/", data),
  update: (id: number, data: Partial<Models.Project>) => api.put<Models.Project>(`/projects/${id}/`, data),
  delete: (id: number) => api.delete(`/projects/${id}/`),
  getSystems: (id: number) => api.get<Models.System[]>(`/projects/${id}/systems/`),
};

// Systems
export const systems = {
  list: (skip = 0, limit = 100) => api.get<Models.System[]>("/systems/", { params: { skip, limit } }),
  get: (id: number) => api.get<Models.System>(`/systems/${id}/`),
  create: (data: Partial<Models.System>) => api.post<Models.System>("/systems/", data),
  update: (id: number, data: Partial<Models.System>) => api.put<Models.System>(`/systems/${id}/`, data),
  delete: (id: number) => api.delete(`/systems/${id}/`),
  getSubsystems: (id: number) => api.get<Models.Subsystem[]>(`/systems/${id}/subsystems/`),
};

// Subsystems
export const subsystems = {
  list: (skip = 0, limit = 100) => api.get<Models.Subsystem[]>("/subsystems/", { params: { skip, limit } }),
  get: (id: number) => api.get<Models.Subsystem>(`/subsystems/${id}/`),
  create: (data: Partial<Models.Subsystem>) => api.post<Models.Subsystem>("/subsystems/", data),
  update: (id: number, data: Partial<Models.Subsystem>) => api.put<Models.Subsystem>(`/subsystems/${id}/`, data),
  delete: (id: number) => api.delete(`/subsystems/${id}/`),
  getModules: (id: number) => api.get<Models.Module[]>(`/subsystems/${id}/modules/`),
};

// Modules
export const modules = {
  list: (skip = 0, limit = 100) => api.get<Models.Module[]>("/modules/", { params: { skip, limit } }),
  get: (id: number) => api.get<Models.Module>(`/modules/${id}/`),
  create: (data: Partial<Models.Module>) => api.post<Models.Module>("/modules/", data),
  update: (id: number, data: Partial<Models.Module>) => api.put<Models.Module>(`/modules/${id}/`, data),
  delete: (id: number) => api.delete(`/modules/${id}/`),
  getUnits: (id: number) => api.get<Models.Unit[]>(`/modules/${id}/units/`),
};

// Units
export const units = {
  list: (skip = 0, limit = 100) => api.get<Models.Unit[]>("/units/", { params: { skip, limit } }),
  get: (id: number) => api.get<Models.Unit>(`/units/${id}/`),
  create: (data: Partial<Models.Unit>) => api.post<Models.Unit>("/units/", data),
  update: (id: number, data: Partial<Models.Unit>) => api.put<Models.Unit>(`/units/${id}/`, data),
  delete: (id: number) => api.delete(`/units/${id}/`),
  getComponents: (id: number) => api.get<Models.Component[]>(`/units/${id}/components/`),
};

// Components
export const components = {
  list: (skip = 0, limit = 100) => api.get<Models.Component[]>("/components/", { params: { skip, limit } }),
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
  update: (id: number, data: Partial<Models.Hierarchy>) => api.put<Models.Hierarchy>(`/hierarchies/${id}/`, data),
  delete: (id: number) => api.delete(`/hierarchies/${id}/`),
};

// Inventory
export const inventory = {
  list: (skip = 0, limit = 100, inventoryType?: string) =>
    api.get<Models.Inventory[]>('/inventory/', {
      params: buildQueryParams({ skip, limit, inventory_type: inventoryType }),
    }),
  get: (id: number) => api.get<Models.Inventory>(`/inventory/${id}/`),
  create: (data: Partial<Models.Inventory>) => api.post<Models.Inventory>("/inventory/", data),
  update: (id: number, data: Partial<Models.Inventory>) => api.put<Models.Inventory>(`/inventory/${id}/`, data),
  delete: (id: number) => api.delete(`/inventory/${id}/`),
};

// Statuses
export const statuses = {
  list: (status_type?: string) =>
    api.get<Models.Status[]>("/statuses/", {
      params: buildQueryParams({ status_type }),
    }),
  get: (id: number) => api.get<Models.Status>(`/statuses/${id}/`),
  create: (data: Partial<Models.Status>) => api.post<Models.Status>("/statuses/", data),
  update: (id: number, data: Partial<Models.Status>) => api.put<Models.Status>(`/statuses/${id}/`, data),
  delete: (id: number) => api.delete(`/statuses/${id}/`),
};

// Entities
export const entities = {
  list: (skip = 0, limit = 100) => api.get<Models.Entity[]>("/entities/", { params: { skip, limit } }),
  lookup: (entityType: string, entityPk: number) =>
    api.get<Models.Entity>('/entities/lookup/', {
      params: buildQueryParams({ entity_type: entityType, entity_pk: entityPk }),
    }),
  get: (id: number) => api.get<Models.Entity>(`/entities/${id}/`),
  getStatusHistory: (id: number) => api.get<Models.EntityStatusHistory[]>(`/entities/${id}/status-history/`),
  getMaintenanceLogs: (id: number) => api.get<Models.MaintenanceLog[]>(`/entities/${id}/maintenance-logs/`),
  partNumber: () => api.get<string[]>("/part-numbers/"),
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
  list: (skip?: number, limit?: number) =>
    api.get<Models.MaintenanceLog[]>('/maintenance-logs/', {
      params: buildQueryParams({ skip, limit }),
    }),
  get: (id: number) => api.get<Models.MaintenanceLog>(`/maintenance-logs/${id}/`),
  create: (data: Partial<Models.MaintenanceLog>) => api.post<Models.MaintenanceLog>('/maintenance-logs/', data),
  update: (id: number, data: Partial<Models.MaintenanceLog>) => api.put<Models.MaintenanceLog>(`/maintenance-logs/${id}/`, data),
  delete: (id: number) => api.delete(`/maintenance-logs/${id}/`),
};

// Maintenance Cases
export const maintenanceCases = {
  list: (skip = 0, limit = 100) => api.get<Models.MaintenanceCase[]>('/maintenance-cases/', { params: { skip, limit } }),
  get: (id: number) => api.get<Models.MaintenanceCase>(`/maintenance-cases/${id}/`),
  create: (data: Models.CreateMaintenanceCasePayload) => api.post<Models.MaintenanceCase>('/maintenance-cases/', data),
  update: (id: number, data: Models.UpdateMaintenanceCasePayload) => api.put<Models.MaintenanceCase>(`/maintenance-cases/${id}/`, data),
  delete: (id: number) => api.delete(`/maintenance-cases/${id}/`),
  lookupEntityByPartNumber: (partNumber: string) => api.get<Models.lookUpResponse>(`/entities/lookup-by-PN/${encodeURIComponent(partNumber)}/`),
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
  list: (skip?: number, limit?: number) =>
    api.get<Models.MaintenanceAction[]>('/maintenance-actions/', {
      params: buildQueryParams({ skip, limit }),
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
};

export default api;

import axios from 'axios';
import * as Types from '@/types/maintenance';

const api = axios.create({
  baseURL: 'http://127.0.0.1:8000/api',
});

api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

// Maintenance Cases
export const maintenanceCases = {
  list: (skip = 0, limit = 100) => api.get<Types.MaintenanceCase[]>('/maintenance-cases/', { params: { skip, limit } }),
  get: (id: number) => api.get<Types.MaintenanceCase>(`/maintenance-cases/${id}/`),
  create: (data: Types.CreateMaintenanceCasePayload) => api.post<Types.MaintenanceCase>('/maintenance-cases/', data),
  update: (id: number, data: Types.UpdateMaintenanceCasePayload) => api.put<Types.MaintenanceCase>(`/maintenance-cases/${id}/`, data),
  delete: (id: number) => api.delete(`/maintenance-cases/${id}/`),
  lookupEntityByPartNumber: (partNumber: string) =>
    api.get<Types.EntityLookupResponse>(`/entities/lookup-by-PN/${encodeURIComponent(partNumber)}/`),
  suspectChildren: (caseId: number, data: Types.SuspectChildrenPayload) =>
    api.post(`/maintenance-cases/${caseId}/suspect-children/`, data),
  confirmFault: (caseId: number, data: Types.ConfirmFaultPayload) =>
    api.post(`/maintenance-cases/${caseId}/confirm-fault/`, data),
};

// Faulty Entities
export const faultyEntities = {
  list: (skip = 0, limit = 100) =>
    api.get<Types.FaultyEntity[]>('/faulty-entities/', { params: { skip, limit } }),
  listByCaseId: (caseId: number, skip = 0, limit = 100) =>
    api.get<Types.FaultyEntity[]>(`/maintenance-cases/${caseId}/faulty-entities/`, { params: { skip, limit } }),
  get: (id: number) =>
    api.get<Types.FaultyEntity>(`/faulty-entities/${id}/`),
  create: (data: Types.CreateFaultyEntityPayload) =>
    api.post<Types.FaultyEntity>('/faulty-entities/', data),
  update: (id: number, data: Types.UpdateFaultyEntityPayload) =>
    api.put<Types.FaultyEntity>(`/faulty-entities/${id}/`, data),
  delete: (id: number) =>
    api.delete(`/faulty-entities/${id}/`),
  cascadeFault: (entityId: number, faultType: string) =>
    api.post(`/faulty-entities/${entityId}/cascade-fault/`, { fault_type: faultType }),
  getMaintenanceHistory: (entityId: number) =>
    api.get<Types.MaintenanceAction[]>(`/faulty-entities/${entityId}/history/`),
};

// Maintenance Actions
export const maintenanceActions = {
  list: (skip = 0, limit = 100) =>
    api.get<Types.MaintenanceAction[]>('/maintenance-actions/', { params: { skip, limit } }),
  listByFaultyEntityId: (faultyEntityId: number, skip = 0, limit = 100) =>
    api.get<Types.MaintenanceAction[]>(`/faulty-entities/${faultyEntityId}/actions/`, { params: { skip, limit } }),
  get: (id: number) =>
    api.get<Types.MaintenanceAction>(`/maintenance-actions/${id}/`),
  create: (data: Types.CreateMaintenanceActionPayload) =>
    api.post<Types.MaintenanceAction>('/maintenance-actions/', data),
  update: (id: number, data: Types.UpdateMaintenanceActionPayload) =>
    api.put<Types.MaintenanceAction>(`/maintenance-actions/${id}/`, data),
  delete: (id: number) =>
    api.delete(`/maintenance-actions/${id}/`),
};

// Maintenance Deliveries
export const maintenanceDeliveries = {
  list: (skip = 0, limit = 100) =>
    api.get<Types.MaintenanceDelivery[]>('/maintenance-deliveries/', { params: { skip, limit } }),
  listByCaseId: (caseId: number, skip = 0, limit = 100) =>
    api.get<Types.MaintenanceDelivery[]>(`/maintenance-cases/${caseId}/deliveries/`, { params: { skip, limit } }),
  get: (id: number) =>
    api.get<Types.MaintenanceDelivery>(`/maintenance-deliveries/${id}/`),
  create: (data: Types.CreateMaintenanceDeliveryPayload) =>
    api.post<Types.MaintenanceDelivery>('/maintenance-deliveries/', data),
  update: (id: number, data: Types.UpdateMaintenanceDeliveryPayload) =>
    api.put<Types.MaintenanceDelivery>(`/maintenance-deliveries/${id}/`, data),
  confirm: (id: number, receivedBy: string) =>
    api.post(`/maintenance-deliveries/${id}/confirm/`, { received_by: receivedBy }),
  delete: (id: number) =>
    api.delete(`/maintenance-deliveries/${id}/`),
};

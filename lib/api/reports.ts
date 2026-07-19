import api, { buildQueryParams } from '@/lib/api';

export type ReportType =
  | 'build_history_dossier'
  | 'maintenance_history_dossier'
  | 'inventory'
  | 'maintenance'
  | 'executive';

export interface ReportRegisterRequest {
  report_type: ReportType;
  report_title: string;
  filters?: Record<string, unknown> | null;
  file_name?: string | null;
  checksum?: string | null;
  software_version?: string | null;
  report_uuid?: string | null;
}

export interface ReportRegisterResponse {
  id: number;
  report_uuid: string;
  report_type: string;
  report_title: string;
  generated_by?: number | null;
  generated_by_name?: string | null;
  generated_at: string;
  filters_json?: string | null;
  file_name?: string | null;
  checksum?: string | null;
  software_version: string;
  verify_payload: string;
}

export interface ReportVerifyResponse {
  valid: boolean;
  report_uuid: string;
  report_type?: string | null;
  report_title?: string | null;
  generated_by?: number | null;
  generated_by_name?: string | null;
  generated_at?: string | null;
  filters_json?: string | null;
  file_name?: string | null;
  checksum?: string | null;
  software_version?: string | null;
  message?: string | null;
}

export interface HierarchyEntityNode {
  entity_type: string;
  id: number;
  name: string;
  part_number?: string | null;
  serial_number?: string | null;
  installation_date?: string | null;
  configuration_item?: string | null;
  current_status?: string | null;
  previous_status?: string | null;
  created_date?: string | null;
  modified_date?: string | null;
  description?: string | null;
  picture_url?: string | null;
  children: HierarchyEntityNode[];
}

export interface TimelineEvent {
  event_type: string;
  title: string;
  description?: string | null;
  occurred_at?: string | null;
  actor?: string | null;
}

export interface AttachmentItem {
  id: number;
  file_name: string;
  mime_type?: string | null;
  attachment_type?: string | null;
  description?: string | null;
  uploaded_at?: string | null;
}

export interface ConfigHistoryItem {
  id: number;
  change_type?: string | null;
  fault_type?: string | null;
  resolution_type?: string | null;
  old_part_number?: string | null;
  old_serial_number?: string | null;
  new_part_number?: string | null;
  new_serial_number?: string | null;
  change_date?: string | null;
  installation_date?: string | null;
  removal_date?: string | null;
  reason?: string | null;
  corrective_action?: string | null;
  remarks?: string | null;
  performed_by?: string | null;
  work_order_number?: string | null;
}

export interface BuildHistoryDossier {
  project: Record<string, unknown>;
  customer?: Record<string, unknown> | null;
  order?: Record<string, unknown> | null;
  delivery?: Record<string, unknown> | null;
  hierarchy: HierarchyEntityNode[];
  configuration_history: ConfigHistoryItem[];
  timeline: TimelineEvent[];
  images: { url?: string | null; caption?: string | null; entity_name?: string | null }[];
  attachments: AttachmentItem[];
  signatures: Record<string, string | null>;
}

export interface MaintenanceActionItem {
  id: number;
  action_type?: string | null;
  outcome?: string | null;
  notes?: string | null;
  performed_by?: string | null;
  performed_at?: string | null;
  duration?: string | null;
  replacement_entity_type?: string | null;
  replacement_entity_id?: number | null;
}

export interface FaultyEntityItem {
  id: number;
  entity_name?: string | null;
  entity_type?: string | null;
  entity_id?: number | null;
  part_number?: string | null;
  serial_number?: string | null;
  fault_type?: string | null;
  fault_description?: string | null;
  status?: string | null;
  resolution_type?: string | null;
  system?: string | null;
  subsystem?: string | null;
  module?: string | null;
  unit?: string | null;
  component?: string | null;
  actions: MaintenanceActionItem[];
}

export interface MaintenanceHistoryDossier {
  case: Record<string, unknown>;
  fault?: Record<string, unknown> | null;
  faulty_entities: FaultyEntityItem[];
  replacements: ConfigHistoryItem[];
  timeline: TimelineEvent[];
  deliveries: Record<string, unknown>[];
  attachments: AttachmentItem[];
  signatures: Record<string, string | null>;
}

export interface InventoryReportItem {
  id: number;
  name: string;
  inventory_type?: string | null;
  part_number?: string | null;
  serial_number?: string | null;
  quantity?: number | null;
  location?: string | null;
  status_name?: string | null;
  sku?: string | null;
  oem_name?: string | null;
  entity_id?: number | null;
  configuration_item?: string | null;
  added_date?: string | null;
}

export interface InventoryReportResponse {
  mode: string;
  items: InventoryReportItem[];
  summary: Record<string, unknown>;
  placeholders: string[];
}

export interface MaintenanceSummaryResponse {
  summary: Record<string, unknown>;
  cases: Record<string, unknown>[];
  by_status: { name: string; value: number }[];
  by_fault_type: { name: string; value: number }[];
  engineer_workload: { name: string; value: number }[];
  aging: { name: string; value: number }[];
  monthly_trends: { name: string; value: number }[];
  mttr_hours?: number | null;
  placeholders: string[];
}

export interface ExecutiveReportResponse {
  dashboard: Record<string, unknown>;
  financial: Record<string, unknown>;
  placeholders: string[];
}

export const reportsApi = {
  register: (payload: ReportRegisterRequest) =>
    api.post<ReportRegisterResponse>('/reports/register', payload),

  verify: (reportUuid: string) =>
    api.get<ReportVerifyResponse>(`/reports/verify/${reportUuid}`),

  history: (
    page = 1,
    pageSize = 20,
    reportType?: string,
    sort_by?: string,
    sort_order?: 'asc' | 'desc'
  ) =>
    api.get('/reports/history', {
      params: buildQueryParams({
        page,
        page_size: pageSize,
        report_type: reportType,
        sort_by,
        sort_order,
      }),
    }),

  buildHistory: (projectId: number) =>
    api.get<BuildHistoryDossier>(`/reports/build-history/${projectId}`),

  maintenanceHistory: (caseId: number) =>
    api.get<MaintenanceHistoryDossier>(`/reports/maintenance-history/${caseId}`),

  inventory: (params: Record<string, string | number | undefined | null>) =>
    api.get<InventoryReportResponse>('/reports/inventory', {
      params: buildQueryParams(params),
    }),

  maintenanceSummary: (params: Record<string, string | number | undefined | null>) =>
    api.get<MaintenanceSummaryResponse>('/reports/maintenance-summary', {
      params: buildQueryParams(params),
    }),

  executive: (params: Record<string, string | number | undefined | null>) =>
    api.get<ExecutiveReportResponse>('/reports/executive', {
      params: buildQueryParams(params),
    }),
};

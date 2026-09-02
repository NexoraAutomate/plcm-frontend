
// User
export interface User {
  id: number
  username: string
  email: string
  full_name: string
  is_active: boolean
  avatar_url?: string | null
  created_at: string
  updated_at?: string | null
  last_login_at?: string | null
  last_logout_at?: string | null
  last_activity_at?: string | null
  failed_login_count?: number
  created_by_id?: number | null
  roles: string[]
  /** Flat permission codes from JWT /auth/me */
  permissions?: string[]
}

export interface UserStatsSummary {
  total_users: number
  active_users: number
  inactive_users: number
  currently_logged_in: number
  failed_logins_today: number
}

export interface UserActivitySummary {
  last_login?: string | null
  last_logout?: string | null
  last_activity?: string | null
  last_ip_address?: string | null
  last_device?: string | null
  browser?: string | null
  operating_system?: string | null
  total_login_count: number
  failed_login_count: number
  created_at?: string | null
  updated_at?: string | null
  created_by_id?: number | null
  is_active: boolean
}

export interface UserLoginHistory {
  id: number
  user_id?: number | null
  username: string
  login_time: string
  logout_time?: string | null
  session_id?: string | null
  ip_address?: string | null
  device_name?: string | null
  browser?: string | null
  operating_system?: string | null
  login_status: 'Success' | 'Failed' | string
  failure_reason?: string | null
  last_activity?: string | null
  session_duration?: number | null
  authentication_method?: string | null
  created_at?: string | null
}

export interface SecuritySettings {
  id: number
  min_password_length: number
  password_expiry_days: number
  require_uppercase: boolean
  require_lowercase: boolean
  require_numbers: boolean
  require_special: boolean
  password_history_length: number
  max_login_attempts: number
  lockout_duration_minutes: number
  inactivity_deactivate_days: number
  two_factor_enabled: boolean
  two_factor_require_all: boolean
  two_factor_require_admins_only: boolean
  updated_at?: string | null
}

export interface AppDefinitions {
  id: number
  serial_number_template: string
  part_number_template: string
  configuration_item_template: string
  sku_template: string
  label_project: string
  label_projects: string
  abbrev_project: string
  label_system: string
  label_systems: string
  label_subsystem: string
  label_subsystems: string
  label_module: string
  label_modules: string
  label_unit: string
  label_units: string
  label_component: string
  label_components: string
  abbrev_system: string
  abbrev_subsystem: string
  abbrev_module: string
  abbrev_unit: string
  abbrev_component: string
  part_template_system: string
  serial_template_system: string
  part_template_subsystem: string
  serial_template_subsystem: string
  part_template_module: string
  serial_template_module: string
  part_template_unit: string
  serial_template_unit: string
  part_template_component: string
  serial_template_component: string
  inventory_label_code_type: 'qr' | 'barcode' | string
  inventory_qr_size_in: number
  inventory_barcode_width_in: number
  inventory_barcode_height_in: number
  inventory_qr_sticker_width_in: number
  inventory_qr_sticker_height_in: number
  inventory_barcode_sticker_width_in: number
  inventory_barcode_sticker_height_in: number
  updated_at?: string | null
}

// Customer
export interface Customer {
  id: number
  customer_code?: string
  name: string
  organization_type?: string | null
  primary_contact_name?: string | null
  designation?: string | null
  email?: string | null
  phone?: string | null
  website?: string | null
  address?: string | null
  country?: string | null
  notes?: string | null
  status_id?: number;
  created_by?: number | null
  created_at: string
  updated_at: string
  status_name: string

}

// Permission
export interface Permission {
  id: number
  name: string
  description?: string
}

// Role
export interface Role {
  id: number
  name: string
  description?: string
  permissions?: Permission[]
  user_count?: number
}

// Status
export interface Status {
  id: number
  status_name: string
  description: string
  status_type: string
  color?: string | null
}

export interface PasswordPolicyPublic {
  min_password_length: number
  require_uppercase: boolean
  require_lowercase: boolean
  require_numbers: boolean
  require_special: boolean
  password_history_length: number
  password_expiry_days: number
}

export interface ActiveSession {
  id: number
  session_id: string
  user_id?: number | null
  username: string
  device_name?: string | null
  browser?: string | null
  operating_system?: string | null
  ip_address?: string | null
  login_time: string
  last_activity?: string | null
  status: string
  is_current?: boolean
}

// Order
export interface Order {
  id: number
  customer_id: number
  order_number: string
  title: string
  description?: string | null
  contract_number?: string | null
  po_number?: string | null
  order_date: string
  delivery_date?: string | null
  total_value?: number | null
  currency: string
  project_manager?: string | null
  remarks?: string | null
  status_id?: number | null
  created_at: string
  customer?: Customer
  status?: Status
  status_name: string
}

export interface OrderCreate {
  customer_id: number
  order_number: string
  title: string
  description?: string
  contract_number?: string
  po_number?: string
  order_date: string
  delivery_date?: string
  total_value?: number
  currency?: string
  project_manager?: string
  remarks?: string
  status_id?: number
}

export interface OrderUpdate {
  customer_id?: number
  order_number?: string
  title?: string
  description?: string
  contract_number?: string
  po_number?: string
  order_date?: string
  delivery_date?: string
  total_value?: number
  currency?: string
  project_manager?: string
  remarks?: string
  status_id?: number
}
// Project
export interface Project {
  id: number
  name: string
  description: string
  start_date: string
  end_date: string
  owner_id: number
  order_id: number
  status_id: number
  progress?: number
  created_at: string
  updated_at: string
  owner?: User
  order?: Order
  status_name?: string
  systems?: System[]
  /** Spec 02 workflow fields */
  hierarchy_config_id?: number | null
  hierarchy_config_version?: number | null
  product_type?: string | null
  flight_count?: number | null
  sdls_per_flight?: number | null
  sdls_counts_by_flight?: number[] | null
  assigned_hm_id?: number | null
  created_by_id?: number | null
  approved_by_id?: number | null
  approved_at?: string | null
  successor_project_id?: number | null
  predecessor_project_id?: number | null
  is_existing_project?: boolean
}

export interface ProjectCancelPreview {
  project_id: number
  project_name?: string | null
  project_status?: string | null
  progress_pct: number
  critical_path_unfinished: boolean
  reserved_count: number
  issued_count: number
  in_progress_count: number
  testing_count: number
  verified_count: number
  returned_pending_count: number
  shortage_count: number
  pending_request_count: number
  open_rework_count: number
  recall_units_total: number
}

export interface ProjectCancelResult {
  project_id: number
  project_status: string
  critical_path_unfinished: boolean
  reserved_released: number
  shortages_cancelled: number
  pending_requests_cancelled: number
  rework_closed: number
  recall_tasks_created: number
  preview?: ProjectCancelPreview | null
  project?: Project | null
}

export const ConfigChangeRequestStatus = {
  REQUESTED: 'REQUESTED',
  INVENTORY_RETURNED: 'INVENTORY_RETURNED',
  SUBMITTED: 'SUBMITTED',
  APPROVED: 'APPROVED',
  NEW_PROJECT_CREATED: 'NEW_PROJECT_CREATED',
  CANCELLED: 'CANCELLED',
} as const

export type ConfigChangeRequestStatusCode =
  (typeof ConfigChangeRequestStatus)[keyof typeof ConfigChangeRequestStatus]

export interface ConfigChangeRequest {
  id: number
  source_project_id: number
  source_project_name?: string | null
  source_project_status?: string | null
  target_hierarchy_config_id?: number | null
  target_hierarchy_config_code?: string | null
  target_hierarchy_config_name?: string | null
  target_product_type?: string | null
  target_flight_count?: number | null
  target_sdls_per_flight?: number | null
  reason_remarks?: string | null
  status: string
  successor_project_id?: number | null
  successor_project_name?: string | null
  requested_by_id?: number | null
  requested_at?: string | null
  submitted_by_id?: number | null
  submitted_at?: string | null
  approved_by_id?: number | null
  approved_at?: string | null
  notes?: string | null
  created_at?: string | null
  updated_at?: string | null
  inventory_cleared?: boolean
  inventory_preview?: ProjectCancelPreview | null
  structural_frozen?: boolean
  project?: Project | null
  successor_project?: Project | null
}

export interface ConfigChangeCreateProjectResult {
  change: ConfigChangeRequest
  project?: Project | null
}

export const WorkflowAuditAction = {
  CREATED: 'CREATED',
  ASSIGNED: 'ASSIGNED',
  UNASSIGNED: 'UNASSIGNED',
  HM_ASSIGNED: 'HM_ASSIGNED',
  STATUS_CHANGED: 'STATUS_CHANGED',
  COMPLETE_REPORTED: 'COMPLETE_REPORTED',
  RESERVED: 'RESERVED',
  RESERVATION_EXTENDED: 'RESERVATION_EXTENDED',
  RELEASED: 'RELEASED',
  ISSUED: 'ISSUED',
  INSTALLATION_IN_PROGRESS: 'INSTALLATION_IN_PROGRESS',
  UNDER_TESTING: 'UNDER_TESTING',
  INSTALLED_VERIFIED: 'INSTALLED_VERIFIED',
  RETURNED: 'RETURNED',
  RE_ISSUED: 'RE_ISSUED',
  MODIFIED: 'MODIFIED',
  DELETED: 'DELETED',
  PROJECT_CREATED: 'PROJECT_CREATED',
  PROJECT_APPROVED: 'PROJECT_APPROVED',
  HIERARCHY_GENERATED: 'HIERARCHY_GENERATED',
  PROJECT_CANCELLED: 'PROJECT_CANCELLED',
  CONFIG_CHANGE_REQUESTED: 'CONFIG_CHANGE_REQUESTED',
  CONFIG_CHANGE_INVENTORY_RETURNED: 'CONFIG_CHANGE_INVENTORY_RETURNED',
  CONFIG_CHANGE_SUBMITTED: 'CONFIG_CHANGE_SUBMITTED',
  CONFIG_CHANGE_APPROVED: 'CONFIG_CHANGE_APPROVED',
  CONFIG_CHANGE_NEW_PROJECT: 'CONFIG_CHANGE_NEW_PROJECT',
  CONFIG_CHANGE_CANCELLED: 'CONFIG_CHANGE_CANCELLED',
  SHORTAGE_CREATED: 'SHORTAGE_CREATED',
  SHORTAGE_PARTIAL: 'SHORTAGE_PARTIAL',
  SHORTAGE_FULFILLED: 'SHORTAGE_FULFILLED',
  AUTO_RESERVE: 'AUTO_RESERVE',
  AUTO_RELEASE_EXPIRY: 'AUTO_RELEASE_EXPIRY',
} as const

export type WorkflowAuditActionCode =
  (typeof WorkflowAuditAction)[keyof typeof WorkflowAuditAction]

export const WORKFLOW_AUDIT_ACTION_LABELS: Record<string, string> = {
  CREATED: 'Created',
  ASSIGNED: 'Developer Assigned',
  UNASSIGNED: 'Developer Unassigned',
  HM_ASSIGNED: 'Hierarchy Manager Assigned',
  STATUS_CHANGED: 'Status Changed',
  COMPLETE_REPORTED: 'Installation Complete Reported',
  RESERVED: 'Reserved',
  RESERVATION_EXTENDED: 'Reservation Extended',
  RELEASED: 'Released',
  ISSUED: 'Issued',
  INSTALLATION_IN_PROGRESS: 'Installation in Progress',
  UNDER_TESTING: 'Under Testing',
  INSTALLED_VERIFIED: 'Installed Verified',
  RETURNED: 'Returned',
  RE_ISSUED: 'Re-Issued',
  MODIFIED: 'Modified',
  DELETED: 'Deleted',
  PROJECT_CREATED: 'Project Created',
  PROJECT_APPROVED: 'Project Approved',
  HIERARCHY_GENERATED: 'Hierarchy Generated',
  PROJECT_CANCELLED: 'Project Cancelled',
  CONFIG_CHANGE_REQUESTED: 'Config Change Requested',
  CONFIG_CHANGE_INVENTORY_RETURNED: 'Config Change Inventory Returned',
  CONFIG_CHANGE_SUBMITTED: 'Config Change Submitted',
  CONFIG_CHANGE_APPROVED: 'Config Change Approved',
  CONFIG_CHANGE_NEW_PROJECT: 'Config Change New Project',
  CONFIG_CHANGE_CANCELLED: 'Config Change Cancelled',
  SHORTAGE_CREATED: 'Shortage Created',
  SHORTAGE_PARTIAL: 'Shortage Partial',
  SHORTAGE_FULFILLED: 'Shortage Fulfilled',
  AUTO_RESERVE: 'Auto-Reserve',
  AUTO_RELEASE_EXPIRY: 'Auto-Release (Expiry)',
}

export const WORKFLOW_AUDIT_ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Administrator',
  PD: 'Project Director',
  HM: 'Hierarchy Manager',
  IM: 'Inventory Manager',
  DEV: 'Developer',
  SYSTEM: 'System',
}

export interface WorkflowAuditEvent {
  id: string
  occurred_at: string
  actor_user_id: number | null
  actor_username?: string | null
  actor_role: string
  action: string
  action_label?: string | null
  entity_type: string
  entity_id: string
  project_id?: number | null
  old_value?: Record<string, unknown> | null
  new_value?: Record<string, unknown> | null
  remarks?: string | null
  ip_address?: string | null
  user_agent?: string | null
  correlation_id?: string | null
}

export interface EntityLifecycleHistoryEvent extends WorkflowAuditEvent {
  /** Normalized status/workflow event returned for a hardware node. */
  source?: string
}

export interface WorkflowAuditActionCatalogItem {
  code: string
  label: string
}

export interface WorkflowAuditListParams {
  entity_type?: string
  entity_id?: string
  actor_user_id?: number
  actor_role?: string
  action?: string
  project_id?: number
  date_from?: string
  date_to?: string
  search?: string
  sort_by?: string
  sort_order?: string
}

export const WORKFLOW_AUDIT_ENTITY_TYPES = [
  { value: 'project', label: 'Project' },
  { value: 'inventory_reservation', label: 'Reservation' },
  { value: 'inventory_issuance', label: 'Issuance' },
  { value: 'inventory_shortage', label: 'Shortage' },
  { value: 'inventory_rework', label: 'Rework' },
  { value: 'inventory_recall', label: 'Recall' },
  { value: 'config_change', label: 'Config change' },
  { value: 'hierarchy_configuration', label: 'Hierarchy configuration' },
] as const

/** Spec 09 — automatic weighted project progress */
export interface ProjectProgressSystemNode {
  entity_type: string
  entity_id: number
  name: string
  weight: number
  progress_pct: number
  verified_leaves: number
  status?: string | null
}

export interface ProjectProgressSdlsNode {
  entity_type: string
  entity_id: number
  name: string
  code?: string | null
  product_type?: string | null
  weight: number
  progress_pct: number
  verified_leaves: number
  systems: ProjectProgressSystemNode[]
}

export interface ProjectProgressFlightNode {
  entity_type: string
  entity_id: number
  name: string
  code?: string | null
  weight: number
  progress_pct: number
  verified_leaves: number
  sdls: ProjectProgressSdlsNode[]
}

export interface ProjectProgressBottleneck {
  entity_type: string
  entity_id: number
  name: string
  path: string
  status?: string | null
  defect_pending: boolean
  weight: number
  reason: string
}

export interface ProjectProgress {
  project_id: number
  project_status?: string | null
  progress_pct: number
  weight: number
  verified_leaves: number
  can_complete: boolean
  stage_policy: string
  flights: ProjectProgressFlightNode[]
  bottlenecks: ProjectProgressBottleneck[]
}

export interface ProjectDraftCreate {
  name: string
  description?: string | null
  start_date?: string | null
  end_date?: string | null
  owner_id?: number | null
  order_id?: number | null
  assigned_hm_id?: number | null
  hierarchy_config_id: number
  product_type: string
  flight_count: number
  sdls_per_flight?: number
  sdls_counts_by_flight: number[]
  is_existing_project?: boolean
}

export interface ProjectDraftBulkCreateResponse {
  projects: Project[]
  count: number
}

/** Spec 04 — project hierarchy inventory reservation */
export interface InventoryReservation {
  id: number
  project_id: number
  flight_id: number
  sdls_id: number
  target_entity_type: string
  target_entity_id: number
  inventory_id: number
  inventory_instance_id?: number | null
  reserved_by_user_id: number
  reserved_at: string
  expires_at: string
  last_reminder_at?: string | null
  extension_count: number
  auto_release_at?: string | null
  part_number?: string | null
  serial_number?: string | null
  status: string
  released_at?: string | null
  released_by_user_id?: number | null
  notes?: string | null
  flight_code?: string | null
  flight_name?: string | null
  sdls_code?: string | null
  sdls_name?: string | null
  inventory_name?: string | null
  reserved_by_name?: string | null
}

export interface InventoryAvailabilityCheck {
  available: boolean
  free_quantity?: number | null
  inventory_id?: number | null
  inventory_name?: string | null
  part_number?: string | null
  serial_numbers?: string[] | null
  flight_id?: number | null
  sdls_id?: number | null
  system_id?: number | null
  reservation_id?: number | null
  reason?: string | null
}

/** Spec 04 — hierarchy shell + matched stock for the reserve workspace */
export interface ReservationPlanItem {
  target_entity_type: string
  target_entity_id: number
  entity_name: string
  path: string
  depth: number
  status: 'available' | 'short' | 'reserved' | 'assemble' | 'issued' | 'installing' | 'testing' | 'verified' | string
  available: boolean
  reason?: string | null
  free_quantity?: number | null
  inventory_id?: number | null
  inventory_name?: string | null
  part_number?: string | null
  serial_numbers?: string[] | null
  suggested_serial?: string | null
  reservation_id?: number | null
  issuance_id?: number | null
  item_status?: string | null
  flight_id?: number | null
  sdls_id?: number | null
  system_id?: number | null
  inventory_source?: string | null
  children_total?: number | null
  children_complete?: number | null
  assigned_developer_id?: number | null
  assigned_developer_name?: string | null
  can_assign_developer?: boolean
  assembled?: boolean
  issued?: boolean
}

export interface ReservationPlan {
  project_id: number
  project_status?: string | null
  total: number
  available_count: number
  short_count: number
  reserved_count: number
  assemble_count?: number
  items: ReservationPlanItem[]
}

/** Spec 05 — waiting demand while stock is short */
export interface InventoryShortage {
  id: number
  project_id: number
  flight_id: number
  sdls_id: number
  target_entity_type: string
  target_entity_id: number
  inventory_id?: number | null
  part_number?: string | null
  suggested_part_number?: string | null
  suggested_serial_number?: string | null
  qty_short: number
  qty_original: number
  lru_name?: string | null
  requested_by_user_id: number
  requested_at: string
  status: 'OPEN' | 'PARTIAL' | 'FULFILLED' | 'CANCELLED' | string
  last_notified_at?: string | null
  fulfilled_reservation_id?: number | null
  cancelled_at?: string | null
  cancelled_by_user_id?: number | null
  notes?: string | null
  project_name?: string | null
  flight_code?: string | null
  flight_name?: string | null
  sdls_code?: string | null
  sdls_name?: string | null
  requested_by_name?: string | null
}

export interface InventoryShortageNotice {
  id: number
  user_id: number
  shortage_id: number
  notice_type: string
  part_number?: string | null
  qty: number
  flight_code?: string | null
  flight_name?: string | null
  sdls_code?: string | null
  sdls_name?: string | null
  lru_name?: string | null
  project_id?: number | null
  project_name?: string | null
  message?: string | null
  created_at: string
  read_at?: string | null
}

/** Spec 06 — idle reservation reminder / auto-release notice for HM */
export interface InventoryReservationExpiryNotice {
  id: number
  user_id: number
  reservation_id: number
  notice_type: string
  part_number?: string | null
  serial_number?: string | null
  flight_code?: string | null
  flight_name?: string | null
  sdls_code?: string | null
  sdls_name?: string | null
  inventory_name?: string | null
  project_id?: number | null
  project_name?: string | null
  message?: string | null
  created_at: string
  read_at?: string | null
}

export interface FCFSFulfillment {
  shortage_id: number
  reservation_id?: number | null
  project_id: number
  project_name?: string | null
  part_number?: string | null
  qty_applied: number
  shortage_status: string
  serial_number?: string | null
  flight_name?: string | null
  sdls_name?: string | null
  lru_name?: string | null
}

export interface ReserveOutcome {
  outcome: 'reserved' | 'shortage' | string
  reservation?: InventoryReservation | null
  shortage?: InventoryShortage | null
}

// Shared install metadata for hierarchy hardware entities
export interface HierarchyInstallFields {
  installation_date?: string
  installed_by_id?: number
  picture_url?: string | null
  original_part_number?: string
  original_serial_number?: string
  is_current_install?: boolean
  root_entity_id?: number | null
  replaced_entity_id?: number | null
  replacement_sequence?: number
  replaced_at?: string | null
  assigned_developer_id?: number | null
}

export interface EntityAttachment {
  id: number
  owner_type: string
  owner_id: number
  file_name: string
  file_path: string
  mime_type?: string
  attachment_type: string
  description?: string
  uploaded_by_id?: number
  uploaded_at: string
}

export interface EntityAttachmentMetadata {
  attachment_type: string
  description?: string
}

// System (top level in hierarchy)
export interface System extends HierarchyInstallFields {
  id: number
  name: string
  description: string
  project_id: number
  sdls_id?: number | null
  sdls_number?: number | null
  status_id: number
  part_number: string
  serial_number: string
  configuration_item: string
  created_at: string
  project?: Project
  status?: Status
  status_name?: string


  
}

// Subsystem
export interface Subsystem extends HierarchyInstallFields {
  id: number
  name: string
  description: string
  system_id: number
  status_id: number
  created_at: string
  part_number: string
  serial_number: string
  configuration_item: string
  system?: System
  status?: Status
}

// Module
export interface Module extends HierarchyInstallFields {
  id: number
  name: string
  description: string
  subsystem_id: number
  status_id: number
  created_at: string
  part_number: string
  serial_number: string
  configuration_item: string
  subsystem?: Subsystem
  status?: Status
}

// Unit
export interface Unit extends HierarchyInstallFields {
  id: number
  name: string
  description: string
  module_id: number
  status_id: number
  created_at: string
  part_number: string
  serial_number: string
  configuration_item: string
  module?: Module
  status?: Status
}

// Component (leaf node in hierarchy)
export interface Component extends HierarchyInstallFields {
  id: number
  name: string
  description: string
  sku: string
  unit_id: number
  status_id: number
  created_at: string
  part_number: string
  serial_number?: string
  configuration_item: string
  unit?: Unit
  status?: Status
}

// Hierarchy entry used by the hierarchy management API
export interface Hierarchy {
  id: number
  name: string
  hierarchy_type: string
  parent_id?: number | null
  parent_name?: string | null
  description?: string | null
  abbreviation?: string | null
  created_at: string
  updated_at?: string
}

export interface EntityListImportResult {
  imported?: number
  skipped?: number
  valid_rows?: number
  dry_run?: boolean
  rows?: Array<{ id: number; name: string; hierarchy_type: string }>
  errors: Array<{ row: number; errors: string[] }>
}

export interface StatusImportResult {
  imported?: number
  skipped?: number
  valid_rows?: number
  dry_run?: boolean
  rows?: Array<{ id: number; status_name: string; status_type: string }>
  errors: Array<{ row: number; errors: string[] }>
}

/** Spec 01 — Smart SDLS hierarchy configuration */
export interface HierarchyConfigProductType {
  id?: number
  code: string
  name: string
  description?: string | null
  sort_order?: number
}

export interface HierarchyConfigNode {
  id?: number
  client_key: string
  parent_id?: number | null
  parent_client_key?: string | null
  level: string
  name: string
  description?: string | null
  abbreviation?: string | null
  sort_order?: number
  inventory_source?: string
}

export interface HierarchyConfiguration {
  id: number
  code: string
  name: string
  description?: string | null
  notes?: string | null
  is_available: boolean
  version: number
  created_at?: string
  updated_at?: string
  created_by_id?: number | null
  product_types: HierarchyConfigProductType[]
  nodes: HierarchyConfigNode[]
}

export interface HierarchyConfigurationSummary {
  id: number
  code: string
  name: string
  description?: string | null
  is_available: boolean
  version: number
  product_type_codes: string[]
}

export interface HierarchyConfigurationWrite {
  code: string
  name: string
  description?: string | null
  notes?: string | null
  is_available?: boolean
  product_types: HierarchyConfigProductType[]
  nodes: HierarchyConfigNode[]
}

export interface HierarchyConfigMeta {
  fixed_levels: Array<{
    code: string
    label: string
    order: number
    is_template_level: boolean
  }>
  default_product_types: Array<{ code: string; name: string; description?: string }>
  default_notes: string
}

/** Spec 04/06 — HM project hold shown on a reserved serial */
export interface InventoryProjectHold {
  id: number
  project_id: number
  project_name?: string | null
  flight_id: number
  flight_code?: string | null
  flight_name?: string | null
  sdls_id: number
  sdls_code?: string | null
  sdls_name?: string | null
  target_entity_type: string
  target_entity_id: number
  target_entity_name?: string | null
  reserved_by_user_id: number
  reserved_by_name?: string | null
  reserved_at: string
  expires_at: string
  last_reminder_at?: string | null
  serial_number?: string | null
  part_number?: string | null
  inventory_name?: string | null
}

// Inventory — fields mirror hierarchy entities for install-from-stock
export interface InventoryInstance extends HierarchyInstallFields {
  id: number
  inventory_id: number
  /** Server-generated unit identity when a manufacturer serial is unavailable. */
  serial_number?: string
  configuration_item?: string
  status_id?: number
  holder_user_id?: number
  location?: string
  added_date?: string
  shelf_life_expires_at?: string
  updated_at?: string
  is_reserved?: boolean
  is_project_reserved?: boolean
  status_name?: string | null
  project_reservation?: InventoryProjectHold | null
  open_issuance_id?: number | null
  open_issuance_status?: string | null
  fcfs_fulfillments?: FCFSFulfillment[] | null
}

export type InventoryLabelType = 'qr' | 'barcode' | 'both'

export interface InventoryLabel {
  id: number
  label_id: string
  signed_payload: string
  barcode_payload?: string
  inventory_id: number
  inventory_instance_id?: number | null
  serial_number?: string | null
  inventory_name?: string | null
  part_number?: string | null
  label_type: InventoryLabelType | string
  status: string
  print_count: number
  first_printed_at?: string | null
  last_printed_at?: string | null
  created_at: string
  updated_at: string
}

export interface InventoryLabelPrintEvent {
  id: number
  label_id: string
  user_id: number
  printed_at: string
  reason?: string | null
  label_type: string
  label_format: string
  quantity: number
  is_first_print: boolean
}

export interface InventoryLabelHistory {
  label: InventoryLabel
  print_events: InventoryLabelPrintEvent[]
  scan_events: Array<{
    id?: number
    scanned_at: string
    user_id?: number | null
    location?: string | null
    valid: boolean
    suspicious: boolean
    reason?: string | null
  }>
}

export interface InventoryLabelScanResponse {
  valid: boolean
  status: string
  message: string
  warnings: string[]
  label?: InventoryLabel | null
  inventory?: (Inventory & { instance?: InventoryInstance | null }) | null
  stock_history: Record<string, unknown>[]
  build_history: Record<string, unknown>[]
  maintenance_history: Record<string, unknown>[]
  ownership_location_history: Record<string, unknown>[]
  hierarchy?: {
    entity_type: string
    entity_id: number
    ancestors: Record<string, unknown>[]
    descendants: Record<string, unknown>[]
  } | null
  print_history: InventoryLabelPrintEvent[]
}

export interface Inventory extends HierarchyInstallFields {
  id: number
  name: string
  inventory_type: string
  serial_number?: string
  part_number?: string
  configuration_item?: string
  status_id?: number
  sku?: string
  /** Total physical units in this catalog group, derived from instances. */
  quantity: number
  reserved_quantity?: number
  available_quantity?: number
  total_used?: number
  location?: string
  description?: string
  oem_name?: string
  entity_id?: number
  holder_user_id?: number
  added_date?: string
  shelf_life_expires_at?: string
  created_at?: string
  updated_at?: string
  instances?: InventoryInstance[]
  component?: Component
  fcfs_fulfillments?: FCFSFulfillment[] | null
}

export interface InventoryStatsSummary {
  total_catalog_items: number
  available_units: number
  reserved_issued_open_units: number
  out_of_stock_catalog_items: number
  out_of_stock_top_names: string[]
  open_shortages: number
  open_shortage_top_names: string[]
  pending_issue_requests: number
  return_pending_inspect: number
}

export type InventoryIssuanceStatus =
  | 'issued'
  | 'return_pending'
  | 'installed'
  | 'returned'
  | 'reverted'

export interface InventoryIssuance {
  id: number
  inventory_id: number
  inventory_instance_id?: number | null
  quantity: number
  issued_to_user_id: number
  issued_by_user_id: number
  issued_at: string
  status: InventoryIssuanceStatus | string
  target_entity_type?: string | null
  target_entity_id?: number | null
  part_number?: string | null
  serial_number?: string | null
  inventory_name?: string | null
  inventory_type?: string | null
  notes?: string | null
  installed_at?: string | null
  installed_entity_type?: string | null
  installed_entity_id?: number | null
  installed_by_id?: number | null
  closed_at?: string | null
  closed_by_id?: number | null
  return_requested_at?: string | null
  issued_to_name?: string | null
  issued_by_name?: string | null
  installed_by_name?: string | null
  closed_by_name?: string | null
  item_lifecycle_status?: string | null
  verified_at?: string | null
  signature_type?: string | null
  display_status?: string | null
  has_signature_attachment?: boolean | null
  has_proforma_attachment?: boolean | null
  signature_attachment_id?: number | null
  proforma_attachment_id?: number | null
}

export interface InventoryIssuanceSignature {
  signature_type?: string | null
  has_signature_attachment: boolean
  has_proforma_attachment: boolean
  signature_attachment_id?: number | null
  proforma_attachment_id?: number | null
  signature_file_name?: string | null
  proforma_file_name?: string | null
  signature_mime_type?: string | null
  proforma_mime_type?: string | null
}

export interface InventoryIssuePayload {
  issued_to_user_id: number
  quantity?: number
  instance_id?: number | null
  target_entity_type?: string | null
  target_entity_id?: number | null
  notes?: string | null
  signature_type: 'DIGITAL' | 'HARD_COPY' | string
  signature_payload?: string | null
  item_request_id?: number | null
}

export interface ItemIssueRequest {
  id: number
  project_id: number
  project_name?: string | null
  flight_id: number
  flight_code?: string | null
  flight_name?: string | null
  sdls_id: number
  sdls_code?: string | null
  sdls_name?: string | null
  target_entity_type: string
  target_entity_id: number
  target_entity_name?: string | null
  assigned_developer_id: number
  assigned_developer_name?: string | null
  requested_by_user_id: number
  requested_by_name?: string | null
  inventory_id: number
  inventory_instance_id?: number | null
  inventory_name?: string | null
  part_number?: string | null
  serial_number?: string | null
  reservation_id: number
  status: 'pending' | 'issued' | 'cancelled' | string
  requested_at: string
  issued_at?: string | null
  issued_issuance_id?: number | null
  notes?: string | null
}

export interface HierarchyAssignDeveloperResult {
  entity_type: string
  id: number
  name?: string | null
  assigned_developer_id?: number | null
  assigned_developer_name?: string | null
  issued?: boolean | null
}

export interface HierarchyAssignmentStatus {
  entity_type: string
  id: number
  name?: string | null
  assigned_developer_id?: number | null
  assigned_developer_name?: string | null
  issued: boolean
  issuance_id?: number | null
  item_status?: string | null
  test_result?: string | null
  complete_reported?: boolean
  defect_pending?: boolean
  verified?: boolean
  can_install?: boolean
  can_test?: boolean
  can_report_complete?: boolean
  rework_id?: number | null
  rework_status?: string | null
  rework_stage?: string | null
  rework_attempt_count?: number | null
  rework_cycle_warning?: boolean
  rework_disposition?: string | null
  can_remove?: boolean
  can_return?: boolean
}

export interface DeveloperAssignedWork {
  entity_type: string
  entity_id: number
  name?: string | null
  part_number?: string | null
  serial_number?: string | null
  project_id?: number | null
  project_name?: string | null
  assigned_developer_id: number
  reserved: boolean
  reservation_id?: number | null
  request_status: 'none' | 'pending' | 'issued' | string
  issued: boolean
  can_request: boolean
  pending_request_id?: number | null
  issuance_id?: number | null
  item_status?: string | null
  test_result?: string | null
  complete_reported?: boolean
  complete_reported_at?: string | null
  defect_pending?: boolean
  verified?: boolean
  verified_at?: string | null
  installed_at?: string | null
  can_install?: boolean
  can_test?: boolean
  can_report_complete?: boolean
  rework_id?: number | null
  rework_status?: string | null
  rework_stage?: string | null
  rework_attempt_count?: number | null
  rework_cycle_warning?: boolean
  rework_disposition?: string | null
  can_remove?: boolean
  can_return?: boolean
}

export interface ItemInstallState {
  issuance_id: number
  entity_type: string
  entity_id: number
  entity_name?: string | null
  project_id?: number | null
  project_name?: string | null
  serial_number?: string | null
  part_number?: string | null
  assigned_developer_id?: number | null
  assigned_developer_name?: string | null
  item_status?: string | null
  test_result?: string | null
  complete_reported: boolean
  complete_reported_at?: string | null
  defect_pending: boolean
  verified: boolean
  verified_at?: string | null
  installed_at?: string | null
  can_install: boolean
  can_test: boolean
  can_report_complete: boolean
  rework_id?: number | null
  rework_status?: string | null
  rework_stage?: string | null
  rework_attempt_count?: number | null
  rework_cycle_warning?: boolean
  rework_disposition?: string | null
  can_remove?: boolean
  can_return?: boolean
}

export interface ItemReworkEvent {
  id: number
  issuance_id: number
  event_type: string
  actor_name?: string | null
  notes?: string | null
  serial_number?: string | null
  created_at?: string | null
}

export interface ItemReworkCase {
  id: number
  project_id: number
  project_name?: string | null
  flight_id?: number | null
  sdls_id?: number | null
  target_entity_type: string
  target_entity_id: number
  target_entity_name?: string | null
  inventory_id: number
  inventory_name?: string | null
  part_number?: string | null
  serial_number?: string | null
  original_instance_id?: number | null
  current_instance_id?: number | null
  current_issuance_id?: number | null
  assigned_developer_id?: number | null
  assigned_developer_name?: string | null
  status: string
  stage: string
  attempt_count: number
  cycle_warning: boolean
  disposition?: string | null
  repaired_at?: string | null
  item_status?: string | null
  opened_at?: string | null
  closed_at?: string | null
  notes?: string | null
  updated_at?: string | null
  events?: ItemReworkEvent[] | null
}

export interface InventoryRecallTask {
  id: number
  project_id: number
  project_name?: string | null
  flight_id?: number | null
  sdls_id?: number | null
  target_entity_type?: string | null
  target_entity_id?: number | null
  target_entity_name?: string | null
  inventory_id: number
  inventory_name?: string | null
  part_number?: string | null
  serial_number?: string | null
  inventory_instance_id?: number | null
  issuance_id?: number | null
  assigned_developer_id?: number | null
  assigned_developer_name?: string | null
  status: string
  stage: string
  disposition?: string | null
  forced_return: boolean
  item_status?: string | null
  opened_at?: string | null
  returned_at?: string | null
  inspected_at?: string | null
  closed_at?: string | null
  notes?: string | null
  updated_at?: string | null
  can_return: boolean
  can_inspect: boolean
  can_disposition: boolean
}

export interface ItemIssueRequestBulkResult {
  created: ItemIssueRequest[]
  skipped: Array<{
    entity_type: string
    entity_id: number
    reason: string
  }>
}

export interface InventoryConsumeResult {
  inventory: Inventory
  consumed_instance?: InventoryInstance | null
  issuance?: InventoryIssuance | null
}

export interface InventoryRevertResult {
  inventory: Inventory
  restored_instance?: InventoryInstance | null
  issuance?: InventoryIssuance | null
}

export type InventoryReturnDecision = 'pending' | 'accepted' | 'rejected'

export interface InventoryReturnNotice {
  id: number
  issuance_id: number
  inventory_id?: number | null
  inventory_name?: string | null
  part_number?: string | null
  serial_number?: string | null
  returned_by_user_id: number
  returned_by_name?: string | null
  created_at: string
  read_at?: string | null
  decision?: InventoryReturnDecision | string | null
  decided_at?: string | null
  decided_by_id?: number | null
  decision_notes?: string | null
  request_notes?: string | null
}

export type InventoryInstallerNoticeType =
  | 'issued'
  | 'return_accepted'
  | 'return_rejected'

export interface InventoryInstallerNotice {
  id: number
  user_id: number
  notice_type: InventoryInstallerNoticeType | string
  issuance_id?: number | null
  inventory_id?: number | null
  inventory_name?: string | null
  part_number?: string | null
  serial_number?: string | null
  message?: string | null
  notes?: string | null
  created_at: string
  read_at?: string | null
  user_name?: string | null
}

export interface InventoryIssuanceEvent {
  id?: number | null
  issuance_id: number
  inventory_id?: number | null
  inventory_instance_id?: number | null
  event_type: string
  quantity: number
  actor_user_id?: number | null
  actor_name?: string | null
  installer_user_id?: number | null
  installer_name?: string | null
  notes?: string | null
  part_number?: string | null
  serial_number?: string | null
  inventory_name?: string | null
  inventory_type?: string | null
  created_at: string
}

export interface InventoryChildLink {
  id: number
  parent_inventory_id: number
  parent_instance_id?: number | null
  parent_instance_serial?: string | null
  child_category_name: string
  child_inventory_id: number
  child_instance_id?: number | null
  child_instance_serial?: string | null
  stock_consumed?: boolean
}

// Entity (generic resource tracker)
export interface Entity {
  id: number
  entity_type: string
  entity_pk: number
  display_name: string
  status_id: number
  created_at: string
  status?: Status
}

// Entity Status History
export interface EntityStatusHistory {
  id: number
  entity_id: number
  status_id: number
  changed_by: number
  changed_at: string
  notes: string
  entity?: Entity
  status?: Status
  changed_by_user?: User
}

// maintenanceLogs Log
export interface MaintenanceLog {
  id: number
  entity_id: number
  performed_by: number
  maintenance_type?: string
  notes: string
  performed_at: string
  next_due: string
  created_at: string
  entity?: Entity
  performed_by_user?: User
}

// Maintenance Management Types

// Enums
export enum CaseStatus {
  Open = 'open',
  UnderInspection = 'under_inspection',
  UnderRepair = 'under_repair',
  Resolved = 'resolved',
  Closed = 'closed',
}

export enum FaultType {
  HARDWARE             = "hardware",
  SOFTWARE             = "software",
  PHYSICAL_DAMAGE      = "physical_damage",
  WEAR                 = "wear",
  MANUFACTURING_DEFECT = "manufacturing_defect",
  UNCLASSIFIED         = "unclassified",
  ELECTRICAL           = 'electrical',
  MECHANICAL           = 'mechanical',
  ENVIRONMENTAL        = 'environmental',
  OTHER                = 'other',
}

                

export enum FaultyEntityStatus {
  IDENTIFIED       = "identified",
  /** @deprecated API-only; display as IDENTIFIED + Potentially Affected badge */
  SUSPECTED        = "suspected",
  UNDER_INSPECTION = "under_inspection",
  CONFIRMED_FAULTY = "confirmed_faulty",
  /** @deprecated API-only; display as NO_FAULT_FOUND */
  HEALTHY          = "healthy",
  /** @deprecated API-only; display as REPAIRED or REPLACED via resolution_type */
  RESOLVED         = "resolved",
  NO_FAULT_FOUND   = "no_fault_found",
  /** @deprecated API-only; display as NO_FAULT_FOUND */
  FALSEPOSITIVE    = 'false_positive'
}

export enum ResolutionType {
  REPAIRED = 'repaired',
  REPLACED = 'replaced',
  NO_FAULT_FOUND   = "no_fault_found",
  DECOMMISSIONED = "decommissioned",
  /** @deprecated Hidden from UI selectors */
  CLEAR = 'clear',
}

export enum ActionType {
  Inspection = 'inspection',
  Disassembly = 'disassembly',
  Repair = 'repair',
  Replacement = 'replacement',
  Testing = 'testing',
  Cleaning = 'cleaning',
  Recalibration = 'recalibration',
  Assembly = 'assembly',
  SoftwareUpdate = 'software_update',
  ConfigurationChange = 'configuration_change',
  Documentation = 'documentation',
}

export enum ActionOutcome {
  Pass = 'pass',
  Fail = 'fail',
  Pending = 'pending',
  Inconclusive = 'inconclusive',
  NotApplicable = 'not_applicable',
}

export enum DeliveryType {
  Parts = 'parts',
  Equipment = 'equipment',
  Components = 'components',
  Other = 'other',
}

export enum DeliveryStatus {
  Dispatched = 'dispatched',
  Delivered = 'delivered',
  ConfirmedByCustomer = 'confirmed_by_customer',
}

export enum EntityType {
  System = 'system',
  Subsystem = 'subsystem',
  Module = 'module',
  Unit = 'unit',
  Component = 'component',
}

// Maintenance Case
export interface MaintenanceCase {
  id: number;
  case_number: string;
  project_id: number;
  description: string;
  status: CaseStatus;
  status_id?: number;
  entity_id: number;
  entity_type: EntityType;
  part_number:string;
  reported_at: string;
  reported_by?: string;
  reported_by_user?: string | User;
  resolved_at?: string;
  resolution_notes?: string;
  created_at: string;
  updated_at: string;
  project_name?: string;
}

// Faulty Entity
export interface FaultyEntity {
  id: number;
  case_id: number;
  identified_by: number;

  entity_type: EntityType;
  entity_id: number;
  fault_type?: FaultType;
  fault_description?: string;
  status: FaultyEntityStatus;
  status_id?: number;
  resolution_type?: ResolutionType;
  identified_at: string;
  resolved_at?: string;

  entity_name?: string;
  part_number?: string;
  serial_number?: string;
  parent_faulty_entity_id?: number;
  parent_entity_name?: string;
  confirmed_at?: string;
  investigation_notes?: string;
  created_at: string;
  updated_at: string;
  case?: MaintenanceCase;
}

// Maintenance Action
export interface MaintenanceAction {
  id: number;
  faulty_entity_id: number;
  action_type: ActionType;
  outcome: ActionOutcome;
  notes?: string;
  performed_by?: number;
  performed_at: string;
  created_at: string;
  updated_at: string;
  faulty_entity?: FaultyEntity;
  replacement_entity_type?: EntityType;
  replacement_entity_id?: number;
}

// Maintenance Delivery
export interface MaintenanceDelivery {
  id: number;
  case_id: number;
  status_id?: number;
  delivery_type: DeliveryType;
  status: DeliveryStatus;
  delivered_at?: string;
  received_by?: string;
  created_at: string;
  updated_at: string;
  case?: MaintenanceCase;
}

// Request/Response Payloads
export interface CreateMaintenanceCasePayload {
  project_id: number;
  description: string;
  status: CaseStatus;
  entity_id: number;
  entity_type: string;
  part_number?:string;
}


export interface UpdateMaintenanceCasePayload {
  status?: CaseStatus;
  resolution_notes?: string;
}

export interface CreateFaultyEntityPayload {
  case_id: number;
  entity_type: EntityType;
  entity_id: number;
  fault_type: FaultType;
}

export interface UpdateFaultyEntityPayload {
  status?: FaultyEntityStatus;
  resolution_type?: ResolutionType;
  fault_type?: FaultType;
  part_number?: string;
  old_part_number?: string;
  new_part_number?: string;
  old_serial_number?: string;
  new_serial_number?: string;
  remarks?: string;
}

export interface CreateMaintenanceActionPayload {
  faulty_entity_id: number;
  action_type: ActionType;
  outcome: ActionOutcome;
  notes?: string;
  performed_by?: number;
}

export interface UpdateMaintenanceActionPayload {
  outcome?: ActionOutcome;
  notes?: string;
}

export interface CreateMaintenanceDeliveryPayload {
  case_id: number;
  delivery_type: DeliveryType;
}

export interface UpdateMaintenanceDeliveryPayload {
  status?: DeliveryStatus;
  delivered_at?: string;
  received_by?: string;
}

export interface EntityLookupNode {
  entity_type: string;
  entity_id: number;
  label: string;
  depth?: number;
  children: EntityLookupNode[];
  entity_name: string;
  entity_PartNumber: string;
  entity_SerialNumber: string;
  parent_ID?: number;
  parent_type?: string;
}

export interface EntityLookupResponse {
  matched_entity_type: string;
  matched_entity_id: number;
  matched_label: string;
  ancestors: EntityLookupNode[];
  descendants: EntityLookupNode[];
  project_id: number;
  project_name: string;
  order_id: number;
  order_ref: string;
  customer_id: number;
  customer_name: string;
}

export interface lookUpResponse extends EntityLookupResponse {
  fault_description?: string;
  status?: FaultyEntityStatus;
  resolution_type?: ResolutionType;
  identified_at?: string;
  resolved_at?: string;

  confirmed_at?: string;
  investigation_notes?: string;
  created_at?: string;
  updated_at?: string;
  matched_entity_serialNumber: string;
  matched_entity_PartNumber: string;
}

export interface SuspectChildrenPayload {
  entity_type: string;
  entity_id: number;
  fault_type: FaultType;
  entity_status: FaultyEntityStatus;
  fault_description?: string;
  entity_name: string;
  serial_number?: string;
  part_number?: string;
  children?:EntityLookupNode[];
}

export interface ConfirmFaultPayload {
  confirmed_entity_type: string;
  confirmed_entity_id: number;
  fault_type: string;
  fault_description: string;
  parent_faulty_entity_id: number;
}

export interface AdminHierarchyReplacePayload {
  project_id: number;
  entity_type: EntityType | string;
  entity_id: number;
  new_part_number: string;
  new_serial_number?: string;
  notes?: string;
  inventory_item_id?: number;
  inventory_instance_id?: number;
}

export interface AdminHierarchyReplaceResponse {
  case_id: number;
  faulty_entity_id: number;
  configuration_history_id?: number | null;
  old_part_number?: string | null;
  new_part_number: string;
  new_entity_id: number;
  old_entity_id: number;
}

export interface EntityReplacementChainItem {
  id: number;
  entity_type: string;
  name?: string;
  part_number?: string;
  serial_number?: string;
  configuration_item?: string;
  original_part_number?: string;
  original_serial_number?: string;
  is_current_install: boolean;
  root_entity_id: number;
  replaced_entity_id?: number | null;
  replacement_sequence: number;
  replaced_at?: string | null;
  installation_date?: string | null;
  installed_by_id?: number | null;
  created_at?: string | null;
}

// API Response types
export interface MaintenanceCaseResponse {
  data: MaintenanceCase | MaintenanceCase[];
  error?: string;
}

export interface FaultyEntityResponse {
  data: FaultyEntity | FaultyEntity[];
  error?: string;
}

export interface MaintenanceActionResponse {
  data: MaintenanceAction | MaintenanceAction[];
  error?: string;
}

export interface MaintenanceDeliveryResponse {
  data: MaintenanceDelivery | MaintenanceDelivery[];
  error?: string;
}


export interface ConfigurationHistory {
  id: number;

  entity_id: number;
  maintenance_case_id?: number | null;
  faulty_entity_id?: number | null;

  performed_by: number;
  approved_by?: number | null;
  verified_by?: number | null;

  change_date: string;
  installation_date?: string | null;
  removal_date?: string | null;

  fault_type?: FaultType | null;
  resolution_type: ResolutionType;

  old_part_number?: string | null;
  new_part_number?: string | null;

  old_serial_number?: string | null;
  new_serial_number?: string | null;

  old_revision?: string | null;
  new_revision?: string | null;

  old_batch_number?: string | null;
  new_batch_number?: string | null;

  operating_hours?: number | null;
  operating_cycles?: number | null;

  work_order_number?: string | null;

  reason?: string | null;
  corrective_action?: string | null;
  remarks?: string | null;

  // Relationships
  entity?: Entity;
  maintenance_case?: MaintenanceCase | null;

  performed_by_user?: User | null;
  approved_by_user?: User | null;
  verified_by_user?: User | null;
}

export interface CreateConfigurationHistoryPayload {
  entity_id: number;
  maintenance_case_id?: number;

  performed_by: number;
  approved_by?: number;
  verified_by?: number;

  installation_date?: string;
  removal_date?: string;

  fault_type?: FaultType;
  resolution_type: ResolutionType;

  old_part_number?: string;
  new_part_number?: string;

  old_serial_number?: string;
  new_serial_number?: string;

  old_revision?: string;
  new_revision?: string;

  old_batch_number?: string;
  new_batch_number?: string;

  operating_hours?: number;
  operating_cycles?: number;

  work_order_number?: string;

  reason?: string;
  corrective_action?: string;
  remarks?: string;
}

export interface UpdateConfigurationHistoryPayload {
  maintenance_case_id?: number;

  approved_by?: number;
  verified_by?: number;

  installation_date?: string;
  removal_date?: string;

  fault_type?: FaultType;
  resolution_type?: ResolutionType;

  old_part_number?: string;
  new_part_number?: string;

  old_serial_number?: string;
  new_serial_number?: string;

  old_revision?: string;
  new_revision?: string;

  old_batch_number?: string;
  new_batch_number?: string;

  operating_hours?: number;
  operating_cycles?: number;

  work_order_number?: string;

  reason?: string;
  corrective_action?: string;
  remarks?: string;
}
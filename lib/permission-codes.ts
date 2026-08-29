/**
 * Canonical permission codes — keep in sync with backend app/auth.py DEFAULT_PERMISSIONS.
 */

export const P = {
  // Users
  view_users: 'view_users',
  create_users: 'create_users',
  edit_users: 'edit_users',
  delete_users: 'delete_users',
  assign_roles: 'assign_roles',
  remove_roles: 'remove_roles',

  // Customers
  view_customers: 'view_customers',
  create_customers: 'create_customers',
  edit_customers: 'edit_customers',
  delete_customers: 'delete_customers',

  // Orders
  view_orders: 'view_orders',
  create_orders: 'create_orders',
  edit_orders: 'edit_orders',
  delete_orders: 'delete_orders',
  approve_orders: 'approve_orders',

  // Projects
  view_projects: 'view_projects',
  create_projects: 'create_projects',
  edit_projects: 'edit_projects',
  delete_projects: 'delete_projects',
  assign_project_manager: 'assign_project_manager',

  // Systems → Components
  view_systems: 'view_systems',
  create_systems: 'create_systems',
  edit_systems: 'edit_systems',
  delete_systems: 'delete_systems',
  view_subsystems: 'view_subsystems',
  create_subsystems: 'create_subsystems',
  edit_subsystems: 'edit_subsystems',
  delete_subsystems: 'delete_subsystems',
  view_modules: 'view_modules',
  create_modules: 'create_modules',
  edit_modules: 'edit_modules',
  delete_modules: 'delete_modules',
  view_units: 'view_units',
  create_units: 'create_units',
  edit_units: 'edit_units',
  delete_units: 'delete_units',
  view_components: 'view_components',
  create_components: 'create_components',
  edit_components: 'edit_components',
  delete_components: 'delete_components',

  // Inventory
  view_inventory: 'view_inventory',
  create_inventory: 'create_inventory',
  edit_inventory: 'edit_inventory',
  delete_inventory: 'delete_inventory',
  issue_inventory: 'issue_inventory',
  revert_inventory_install: 'revert_inventory_install',
  view_inventory_issuances: 'view_inventory_issuances',
  inventory_label_generate: 'inventory.label.generate',
  inventory_label_print: 'inventory.label.print',
  inventory_label_scan: 'inventory.label.scan',
  inventory_label_manage: 'inventory.label.manage',

  // Maintenance
  view_maintenance: 'view_maintenance',
  create_maintenance: 'create_maintenance',
  edit_maintenance: 'edit_maintenance',
  approve_maintenance: 'approve_maintenance',
  close_maintenance: 'close_maintenance',

  // Entities & status
  view_entities: 'view_entities',
  create_entities: 'create_entities',
  edit_entities: 'edit_entities',
  delete_entities: 'delete_entities',
  view_statuses: 'view_statuses',
  create_statuses: 'create_statuses',
  edit_statuses: 'edit_statuses',
  delete_statuses: 'delete_statuses',
  view_hierarchy: 'view_hierarchy',
  create_hierarchy: 'create_hierarchy',
  edit_hierarchy: 'edit_hierarchy',
  delete_hierarchy: 'delete_hierarchy',
  view_status_history: 'view_status_history',

  // Reports & analytics
  view_reports: 'view_reports',
  view_executive_dashboard: 'view_executive_dashboard',
  view_hierarchy_dashboard: 'view_hierarchy_dashboard',
  export_reports: 'export_reports',
  print_reports: 'print_reports',
  export_data: 'export_data',
  import_data: 'import_data',
  generate_build_dossier: 'generate_build_dossier',
  generate_maintenance_dossier: 'generate_maintenance_dossier',

  // Attachments
  upload_attachments: 'upload_attachments',
  delete_attachments: 'delete_attachments',
  download_attachments: 'download_attachments',

  // System administration
  backup_database: 'backup_database',
  restore_database: 'restore_database',
  manage_settings: 'manage_settings',
  view_audit_logs: 'view_audit_logs',
  manage_notifications: 'manage_notifications',
  view_notifications: 'view_notifications',
  approve_configuration_changes: 'approve_configuration_changes',

  // Roles
  view_roles: 'view_roles',
  create_roles: 'create_roles',
  edit_roles: 'edit_roles',
  delete_roles: 'delete_roles',

  // Maintenance cases / faulty entities
  view_maintenance_cases: 'view_maintenance_cases',
  create_maintenance_cases: 'create_maintenance_cases',
  edit_maintenance_cases: 'edit_maintenance_cases',
  delete_maintenance_cases: 'delete_maintenance_cases',
  view_faulty_entities: 'view_faulty_entities',
  create_faulty_entities: 'create_faulty_entities',
  edit_faulty_entities: 'edit_faulty_entities',
  delete_faulty_entities: 'delete_faulty_entities',
  cascade_faults: 'cascade_faults',
  suspect_children: 'suspect_children',
  confirm_faults: 'confirm_faults',
  view_entity_maintenance_history: 'view_entity_maintenance_history',
  lookup_entities_by_part_number: 'lookup_entities_by_part_number',
  view_maintenance_actions: 'view_maintenance_actions',
  create_maintenance_actions: 'create_maintenance_actions',
  edit_maintenance_actions: 'edit_maintenance_actions',
  delete_maintenance_actions: 'delete_maintenance_actions',
  view_maintenance_deliveries: 'view_maintenance_deliveries',
  create_maintenance_deliveries: 'create_maintenance_deliveries',
  edit_maintenance_deliveries: 'edit_maintenance_deliveries',
  delete_maintenance_deliveries: 'delete_maintenance_deliveries',
  confirm_maintenance_deliveries: 'confirm_maintenance_deliveries',
  view_configuration_history: 'view_configuration_history',
  create_configuration_history: 'create_configuration_history',
  edit_configuration_history: 'edit_configuration_history',
  delete_configuration_history: 'delete_configuration_history',

  // Workflow stubs (Spec 00 — enforced in Spec 01+)
  hierarchy_config_manage: 'hierarchy_config.manage',
  project_assign_hm: 'project.assign_hm',
  project_create_draft: 'project.create_draft',
  project_approve: 'project.approve',
  hierarchy_generate: 'hierarchy.generate',
  inventory_reserve: 'inventory.reserve',
  inventory_release: 'inventory.release',
  inventory_receive: 'inventory.receive',
  inventory_issue_workflow: 'inventory.issue',
  hierarchy_assign_developer: 'hierarchy.assign_developer',
  item_request: 'item.request',
  item_install_test: 'item.install_test',
  item_verify: 'item.verify',
  item_inspect: 'item.inspect',
  project_cancel: 'project.cancel',
  config_change_request: 'config_change.request',
  config_change_approve: 'config_change.approve',
  audit_read: 'audit.read',
} as const;

export type PermissionCode = (typeof P)[keyof typeof P];

/** Human-readable labels for tooltips (e.g. disabled export). */
export const PERMISSION_LABELS: Record<string, string> = {
  [P.export_reports]: 'Export Reports',
  [P.print_reports]: 'Print Reports',
  [P.export_data]: 'Export Data',
  [P.import_data]: 'Import Data',
  [P.backup_database]: 'Backup Database',
  [P.restore_database]: 'Restore Database',
  [P.upload_attachments]: 'Upload Attachments',
  [P.delete_attachments]: 'Delete Attachments',
  [P.download_attachments]: 'Download Attachments',
  [P.manage_settings]: 'Manage Settings',
  [P.view_audit_logs]: 'View Audit Logs',
  [P.approve_configuration_changes]: 'Approve Configuration Changes',
  [P.generate_build_dossier]: 'Generate Build Dossier',
  [P.generate_maintenance_dossier]: 'Generate Maintenance Dossier',
  [P.view_executive_dashboard]: 'Executive Dashboard View',
  [P.view_hierarchy_dashboard]: 'Hierarchy Dashboard View',
  [P.view_inventory_issuances]: 'Inventory Issuances',
  [P.confirm_faults]: 'Confirm Faults',
  [P.cascade_faults]: 'Cascade Faults',
  [P.suspect_children]: 'Suspect Children',
  [P.close_maintenance]: 'Close Maintenance',
  [P.hierarchy_config_manage]: 'Manage Hierarchy Config',
  [P.project_assign_hm]: 'Assign Hierarchy Manager',
  [P.project_create_draft]: 'Create Draft Project',
  [P.project_approve]: 'Approve Project',
  [P.hierarchy_generate]: 'Generate Hierarchy',
  [P.inventory_reserve]: 'Reserve Inventory',
  [P.inventory_release]: 'Release Reservation',
  [P.inventory_receive]: 'Receive Inventory',
  [P.inventory_issue_workflow]: 'Issue Inventory (Workflow)',
  [P.hierarchy_assign_developer]: 'Assign Developer',
  [P.item_request]: 'Request Item',
  [P.item_install_test]: 'Install / Test Item',
  [P.item_verify]: 'Verify Installation',
  [P.item_inspect]: 'Inspect Returned Item',
  [P.project_cancel]: 'Cancel Project',
  [P.config_change_request]: 'Request Config Change',
  [P.config_change_approve]: 'Approve Config Change',
  [P.audit_read]: 'Read Audit Trail',
};

export function permissionTooltip(permission: string | string[]): string {
  const codes = Array.isArray(permission) ? permission : [permission];
  const labels = codes.map((code) => PERMISSION_LABELS[code] ?? code.replace(/_/g, ' '));
  if (labels.length === 1) return `Requires ${labels[0]} permission`;
  return `Requires one of: ${labels.join(', ')}`;
}

/** Sidebar / menu items → required view permission */
export const NAV_PERMISSIONS: Record<string, PermissionCode | PermissionCode[]> = {
  '/executive-dashboard': P.view_executive_dashboard,
  '/customers': P.view_customers,
  '/orders': P.view_orders,
  '/projects': P.view_projects,
  '/inventory': P.view_inventory,
  '/inventory/issuances': P.view_inventory_issuances,
  '/scan': [P.view_inventory, P.inventory_label_scan],
  '/shortages': [P.view_inventory, P.inventory_receive],
  '/issue-queue': [P.inventory_issue_workflow, P.issue_inventory],
  '/inspect-queue': P.item_inspect,
  '/config-changes': [P.config_change_approve, P.config_change_request],
  '/audit': P.audit_read,
  '/my-assignments': [P.item_request, P.item_install_test],
  '/verify-queue': P.item_verify,
  '/maintenance': P.view_maintenance_cases,
  '/notifications': P.view_notifications,
  '/hierarchy-dashboard': P.view_hierarchy_dashboard,
  '/systems': P.view_systems,
  '/subsystems': P.view_subsystems,
  '/modules': P.view_modules,
  '/units': P.view_units,
  '/components': P.view_components,
  '/hierarchy': P.view_hierarchy,
  '/users': P.view_users,
  '/statuses': P.view_statuses,
  '/roles': P.view_roles,
  '/settings': [
    P.view_users,
    P.view_roles,
    P.view_statuses,
    P.view_hierarchy,
    P.manage_settings,
    P.manage_notifications,
    P.hierarchy_config_manage,
  ],
  '/dashboard': P.view_executive_dashboard,
  '/maintenanceLogs': P.view_maintenance,
  '/reporting': P.view_reports,
  '/reporting/build-history': P.generate_build_dossier,
  '/reporting/maintenance-history': P.generate_maintenance_dossier,
  '/reporting/hierarchy': P.view_reports,
  '/reporting/inventory': P.view_reports,
  '/reporting/maintenance': P.view_reports,
  '/reporting/executive': P.view_executive_dashboard,
};

/** OR of permissions that grant access to the Settings module */
export const SETTINGS_ACCESS_PERMISSIONS: PermissionCode[] = [
  P.view_users,
  P.view_roles,
  P.view_statuses,
  P.view_hierarchy,
  P.manage_settings,
  P.manage_notifications,
  P.backup_database,
  P.restore_database,
  P.hierarchy_config_manage,
];

/**
 * Preferential landing routes after login — first match the user can access.
 */
export const LANDING_CANDIDATES: Array<{ href: string; permission: PermissionCode }> = [
  { href: '/executive-dashboard', permission: P.view_executive_dashboard },
  { href: '/projects', permission: P.view_projects },
  { href: '/maintenance', permission: P.view_maintenance_cases },
  { href: '/inventory', permission: P.view_inventory },
  { href: '/systems', permission: P.view_systems },
  { href: '/customers', permission: P.view_customers },
  { href: '/orders', permission: P.view_orders },
  { href: '/settings', permission: P.view_users },
];

export function firstAccessiblePath(canFn: (p: string | string[]) => boolean): string {
  for (const candidate of LANDING_CANDIDATES) {
    if (canFn(candidate.permission)) return candidate.href;
  }
  return '/executive-dashboard';
}

/**
 * Resolve the view permission required for a pathname.
 * Matches longest prefix first (e.g. /maintenance/cases/1 → view_maintenance_cases).
 */
export function routePermissionForPath(pathname: string): PermissionCode | PermissionCode[] | null {
  const normalized = pathname.replace(/\/$/, '') || '/';
  const entries = Object.entries(NAV_PERMISSIONS).sort((a, b) => b[0].length - a[0].length);
  for (const [href, permission] of entries) {
    if (normalized === href || normalized.startsWith(`${href}/`)) {
      return permission;
    }
  }
  // Nested maintenance case detail
  if (normalized.startsWith('/maintenance/')) return P.view_maintenance_cases;
  if (normalized === '/inventory/issuances' || normalized.startsWith('/inventory/issuances/')) {
    return P.view_inventory_issuances;
  }
  if (normalized === '/issue-queue' || normalized.startsWith('/issue-queue/')) {
    return NAV_PERMISSIONS['/issue-queue'];
  }
  if (normalized === '/inspect-queue' || normalized.startsWith('/inspect-queue/')) {
    return NAV_PERMISSIONS['/inspect-queue'];
  }
  if (normalized === '/my-assignments' || normalized.startsWith('/my-assignments/')) {
    return NAV_PERMISSIONS['/my-assignments'];
  }
  if (normalized === '/verify-queue' || normalized.startsWith('/verify-queue/')) {
    return NAV_PERMISSIONS['/verify-queue'];
  }
  if (normalized.startsWith('/inventory/')) return P.view_inventory;
  if (normalized.startsWith('/projects/')) return P.view_projects;
  if (normalized.startsWith('/customers/')) return P.view_customers;
  if (normalized.startsWith('/orders/')) return P.view_orders;
  if (normalized.startsWith('/systems/')) return P.view_systems;
  if (normalized.startsWith('/subsystems/')) return P.view_subsystems;
  if (normalized.startsWith('/modules/')) return P.view_modules;
  if (normalized.startsWith('/units/')) return P.view_units;
  if (normalized.startsWith('/components/')) return P.view_components;
  return null;
}

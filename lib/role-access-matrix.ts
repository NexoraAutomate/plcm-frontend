/**
 * Groups permission codes into a readable CRUD matrix + toggle sections
 * for the Admin Role Access settings panel.
 */

export type CrudAction = 'view' | 'create' | 'edit' | 'delete';

export type CrudExtra = {
  code: string;
  label: string;
};

export type CrudModuleDef = {
  key: string;
  label: string;
  /** Resource suffix used in view_/create_/edit_/delete_ codes */
  resource: string;
  extras?: CrudExtra[];
};

export type TogglePermissionDef = {
  code: string;
  label: string;
  description?: string;
};

export type ToggleSectionDef = {
  key: string;
  label: string;
  description?: string;
  permissions: TogglePermissionDef[];
};

/** Modules that follow the standard view/create/edit/delete pattern */
export const CRUD_MODULES: CrudModuleDef[] = [
  { key: 'users', label: 'Users', resource: 'users', extras: [
    { code: 'assign_roles', label: 'Assign roles' },
    { code: 'remove_roles', label: 'Remove roles' },
  ]},
  { key: 'customers', label: 'Customers', resource: 'customers' },
  { key: 'orders', label: 'Orders', resource: 'orders', extras: [
    { code: 'approve_orders', label: 'Approve orders' },
  ]},
  { key: 'projects', label: 'Projects', resource: 'projects', extras: [
    { code: 'assign_project_manager', label: 'Assign project manager' },
  ]},
  { key: 'systems', label: 'Systems', resource: 'systems' },
  { key: 'subsystems', label: 'Subsystems', resource: 'subsystems' },
  { key: 'modules', label: 'Modules', resource: 'modules' },
  { key: 'units', label: 'Units', resource: 'units' },
  { key: 'components', label: 'Components', resource: 'components' },
  { key: 'inventory', label: 'Inventory', resource: 'inventory' },
  { key: 'entities', label: 'Entities', resource: 'entities' },
  { key: 'statuses', label: 'Statuses', resource: 'statuses' },
  { key: 'hierarchy', label: 'System Hierarchy', resource: 'hierarchy' },
  { key: 'status_history', label: 'Status History', resource: 'status_history' },
  { key: 'roles', label: 'Roles', resource: 'roles' },
  {
    key: 'maintenance',
    label: 'Maintenance Logs',
    resource: 'maintenance',
    extras: [
      { code: 'approve_maintenance', label: 'Approve' },
      { code: 'close_maintenance', label: 'Close' },
    ],
  },
  { key: 'maintenance_cases', label: 'Maintenance Cases', resource: 'maintenance_cases' },
  {
    key: 'faulty_entities',
    label: 'Faulty Entities',
    resource: 'faulty_entities',
    extras: [
      { code: 'cascade_faults', label: 'Cascade faults' },
      { code: 'suspect_children', label: 'Suspect children' },
      { code: 'confirm_faults', label: 'Confirm faults' },
      { code: 'view_entity_maintenance_history', label: 'View history' },
      { code: 'lookup_entities_by_part_number', label: 'Lookup by part #' },
    ],
  },
  { key: 'maintenance_actions', label: 'Maintenance Actions', resource: 'maintenance_actions' },
  {
    key: 'maintenance_deliveries',
    label: 'Maintenance Deliveries',
    resource: 'maintenance_deliveries',
    extras: [{ code: 'confirm_maintenance_deliveries', label: 'Confirm deliveries' }],
  },
  { key: 'configuration_history', label: 'Configuration History', resource: 'configuration_history' },
];

/** Page / feature toggles that are primarily view or action based */
export const TOGGLE_SECTIONS: ToggleSectionDef[] = [
  {
    key: 'pages',
    label: 'Pages & Dashboards',
    description: 'Controls which areas of the app this role can open',
    permissions: [
      { code: 'view_executive_dashboard', label: 'Executive Dashboard' },
      { code: 'view_reports', label: 'Reporting' },
      { code: 'view_notifications', label: 'Notifications' },
    ],
  },
  {
    key: 'reports',
    label: 'Reports & Data',
    description: 'Export, print, and dossier generation',
    permissions: [
      { code: 'export_reports', label: 'Export reports' },
      { code: 'print_reports', label: 'Print reports' },
      { code: 'export_data', label: 'Export data' },
      { code: 'import_data', label: 'Import data' },
      { code: 'generate_build_dossier', label: 'Generate build dossier' },
      { code: 'generate_maintenance_dossier', label: 'Generate maintenance dossier' },
    ],
  },
  {
    key: 'attachments',
    label: 'Attachments',
    permissions: [
      { code: 'upload_attachments', label: 'Upload' },
      { code: 'download_attachments', label: 'Download' },
      { code: 'delete_attachments', label: 'Delete' },
    ],
  },
  {
    key: 'administration',
    label: 'Administration',
    description: 'System-level controls',
    permissions: [
      { code: 'manage_settings', label: 'Manage settings' },
      { code: 'manage_notifications', label: 'Manage notifications / alerts' },
      { code: 'view_audit_logs', label: 'View audit logs' },
      { code: 'approve_configuration_changes', label: 'Approve configuration changes' },
      { code: 'backup_database', label: 'Backup database' },
      { code: 'restore_database', label: 'Restore database' },
    ],
  },
];

export const CRUD_ACTIONS: { action: CrudAction; label: string }[] = [
  { action: 'view', label: 'View' },
  { action: 'create', label: 'Create' },
  { action: 'edit', label: 'Edit' },
  { action: 'delete', label: 'Delete' },
];

export function crudPermissionCode(resource: string, action: CrudAction): string {
  return `${action}_${resource}`;
}

/** All permission codes referenced by the matrix (CRUD + extras + toggles). */
export function matrixKnownCodes(): Set<string> {
  const codes = new Set<string>();
  for (const mod of CRUD_MODULES) {
    for (const { action } of CRUD_ACTIONS) {
      codes.add(crudPermissionCode(mod.resource, action));
    }
    for (const extra of mod.extras ?? []) {
      codes.add(extra.code);
    }
  }
  for (const section of TOGGLE_SECTIONS) {
    for (const perm of section.permissions) {
      codes.add(perm.code);
    }
  }
  return codes;
}

export function humanizePermissionCode(code: string): string {
  return code
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

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
  { key: 'inventory', label: 'Inventory', resource: 'inventory', extras: [
    { code: 'issue_inventory', label: 'Issue to developer' },
    { code: 'revert_inventory_install', label: 'Revert install to stock' },
    { code: 'view_inventory_issuances', label: 'Inventory issuances' },
  ]},
  { key: 'entities', label: 'Entities', resource: 'entities' },
  { key: 'statuses', label: 'Statuses', resource: 'statuses' },
  { key: 'hierarchy', label: 'System Hierarchy', resource: 'hierarchy' },
  { key: 'status_history', label: 'Status History', resource: 'status_history' },
  { key: 'roles', label: 'Roles', resource: 'roles' },
  {
    key: 'maintenance',
    label: 'Maintenance Logs',
    resource: 'maintenance',
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
      { code: 'view_executive_dashboard', label: 'Executive Dashboard view' },
      { code: 'view_hierarchy_dashboard', label: 'Hierarchy Dashboard view' },
      { code: 'view_reports', label: 'Reporting' },
      { code: 'view_notifications', label: 'Notifications' },
      {
        code: 'view_my_assignments',
        label: 'My assignments',
        description: 'Sidebar and page for assigned install work, handover requests, and recall returns',
      },
    ],
  },
  {
    key: 'workflow',
    label: 'Workflow actions',
    description: 'Spec 00–12 actions used on assignments, inventory, and project workflows',
    permissions: [
      { code: 'item.request', label: 'Request item handover', description: 'Developer asks IM to issue reserved stock' },
      { code: 'item.install_test', label: 'Install & test items', description: 'Record install and Pass/Fail on issued items' },
      { code: 'item.verify', label: 'Verify installations' },
      { code: 'hierarchy.assign_developer', label: 'Assign developer to hierarchy work' },
      { code: 'inventory.reserve', label: 'Reserve inventory' },
      { code: 'inventory.release', label: 'Release reservations' },
      { code: 'inventory.receive', label: 'Receive stock' },
      { code: 'inventory.issue', label: 'Issue inventory (workflow)' },
      { code: 'item.inspect', label: 'Inspect returned items' },
      { code: 'project.create_draft', label: 'Create draft project' },
      { code: 'project.approve', label: 'Approve project' },
      { code: 'project.assign_hm', label: 'Assign hierarchy manager' },
      { code: 'project.cancel', label: 'Cancel project / recall' },
      { code: 'hierarchy.generate', label: 'Generate hierarchy' },
      { code: 'hierarchy_config.manage', label: 'Manage hierarchy configurations' },
      { code: 'config_change.request', label: 'Request configuration change' },
      { code: 'config_change.approve', label: 'Approve configuration change' },
      { code: 'audit.read', label: 'Read audit trail' },
      { code: 'inventory.label.generate', label: 'Generate labels' },
      { code: 'inventory.label.print', label: 'Print labels' },
      { code: 'inventory.label.scan', label: 'Scan labels' },
      { code: 'inventory.label.manage', label: 'Manage labels' },
    ],
  },
  {
    key: 'mmhd_track_a',
    label: 'Maintenance workflow — Track A (Replacement)',
    description:
      'Immediate replacement path: request, PD approval, assign ME, IM issue, AIT',
    permissions: [
      {
        code: 'maintenance.occurrence_report',
        label: 'Occurrence report',
        description: 'Record onsite / occurrence report on a case',
      },
      {
        code: 'maintenance.replacement_request',
        label: 'Replacement request',
        description: 'Create a Track A replacement request (ME)',
      },
      {
        code: 'maintenance.replacement_approve',
        label: 'Approve / reject replacement',
        description: 'PD decision on awaiting replacement approval',
      },
      {
        code: 'maintenance.assign_me',
        label: 'Assign ME',
        description: 'Assign maintenance engineer and reserve stock (HM/PD)',
      },
      {
        code: 'maintenance.request_issue',
        label: 'Request inventory issue',
        description: 'ME requests IM to issue reserved replacement stock',
      },
      {
        code: 'maintenance.im_issue',
        label: 'Issue new inventory (Track A)',
        description: 'IM issues reserved replacement inventory',
      },
      {
        code: 'maintenance.ait_upload',
        label: 'Start / upload AIT',
        description: 'ME starts AIT and uploads evidence',
      },
      {
        code: 'maintenance.ait_approve',
        label: 'Approve / reject AIT',
        description: 'PD decision on AIT results',
      },
    ],
  },
  {
    key: 'mmhd_track_b',
    label: 'Maintenance workflow — Track B (Inspection / rework)',
    description:
      'Faulty return path: reception, assign IE, issue to IE, disposition, repair',
    permissions: [
      {
        code: 'maintenance.reception',
        label: 'Record reception',
        description: 'IM records faulty-unit arrival reception',
      },
      {
        code: 'maintenance.assign_ie',
        label: 'Assign IE',
        description: 'Assign inspection engineer on Track B (PD/HM)',
      },
      {
        code: 'maintenance.im_issue_to_ie',
        label: 'Issue to IE',
        description: 'IM issues faulty unit to IE for inspection',
      },
      {
        code: 'maintenance.inspection_disposition',
        label: 'Inspection disposition',
        description: 'IE disposition, handover request, and repair submit',
      },
      {
        code: 'maintenance.repair_approve',
        label: 'Approve / reject repair',
        description: 'PD decision on Track B repair outcome',
      },
      {
        code: 'maintenance.confirm_discard',
        label: 'Confirm discard',
        description: 'IM confirms discard of unrepairable returned unit',
      },
    ],
  },
  {
    key: 'mmhd_case',
    label: 'Maintenance workflow — Case actions',
    description: 'Case-level controls shared across tracks',
    permissions: [
      {
        code: 'maintenance.case_close',
        label: 'Close / resolve case',
        description: 'Close or resolve a maintenance case',
      },
      {
        code: 'close_maintenance',
        label: 'Close maintenance log',
        description: 'Close legacy maintenance log entries',
      },
      {
        code: 'approve_maintenance',
        label: 'Approve maintenance log',
        description: 'Approve legacy maintenance log entries',
      },
      {
        code: 'confirm_maintenance_deliveries',
        label: 'Confirm deliveries',
        description: 'Confirm maintenance delivery records',
      },
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
    .split(/[._]/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

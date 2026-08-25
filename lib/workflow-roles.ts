/**
 * Spec 00 — workflow role codes ↔ DB Role.name mapping.
 * Use ROLE / WORKFLOW_ROLE_NAMES with <Can role=…> for later action gates.
 */

export const WorkflowRole = {
  ADMIN: 'ADMIN',
  PD: 'PD',
  HM: 'HM',
  IM: 'IM',
  DEV: 'DEV',
} as const;

export type WorkflowRoleCode = (typeof WorkflowRole)[keyof typeof WorkflowRole];

/** Spec code → Role.name stored in backend DEFAULT_ROLES */
export const WORKFLOW_ROLE_DB_NAMES: Record<WorkflowRoleCode, string> = {
  ADMIN: 'Admin',
  PD: 'ProjectDirector',
  HM: 'HierarchyManager',
  IM: 'InventoryManager',
  DEV: 'Developer',
};

export const WORKFLOW_ROLE_LABELS: Record<WorkflowRoleCode, string> = {
  ADMIN: 'Administrator',
  PD: 'Project Director',
  HM: 'Hierarchy Manager',
  IM: 'Inventory Manager',
  DEV: 'Developer',
};

/** Convenience: DB names for <Can role={[ROLE.HM, ROLE.ADMIN]} /> */
export const ROLE = {
  ADMIN: WORKFLOW_ROLE_DB_NAMES.ADMIN,
  PD: WORKFLOW_ROLE_DB_NAMES.PD,
  HM: WORKFLOW_ROLE_DB_NAMES.HM,
  IM: WORKFLOW_ROLE_DB_NAMES.IM,
  DEV: WORKFLOW_ROLE_DB_NAMES.DEV,
} as const;

const DB_TO_CODE: Record<string, WorkflowRoleCode> = Object.fromEntries(
  (Object.entries(WORKFLOW_ROLE_DB_NAMES) as [WorkflowRoleCode, string][]).map(
    ([code, name]) => [name.toLowerCase(), code]
  )
);

const ALIASES: Record<string, WorkflowRoleCode> = {
  admin: 'ADMIN',
  administrator: 'ADMIN',
  pd: 'PD',
  'project director': 'PD',
  projectdirector: 'PD',
  'project manager': 'PD',
  projectmanager: 'PD',
  hm: 'HM',
  'hierarchy manager': 'HM',
  hierarchymanager: 'HM',
  im: 'IM',
  'inventory manager': 'IM',
  inventorymanager: 'IM',
  dev: 'DEV',
  developer: 'DEV',
};

export function normalizeWorkflowRole(role: string | null | undefined): WorkflowRoleCode | null {
  if (!role) return null;
  const key = role.trim().toLowerCase();
  if (DB_TO_CODE[key]) return DB_TO_CODE[key];
  if (ALIASES[key]) return ALIASES[key];
  const upper = role.trim().toUpperCase();
  if ((Object.values(WorkflowRole) as string[]).includes(upper)) {
    return upper as WorkflowRoleCode;
  }
  return null;
}

export function resolveWorkflowRoles(roleNames: string[]): Set<WorkflowRoleCode> {
  const found = new Set<WorkflowRoleCode>();
  for (const name of roleNames) {
    const code = normalizeWorkflowRole(name);
    if (code) found.add(code);
  }
  return found;
}

export function hasWorkflowRole(
  roleNames: string[],
  required: WorkflowRoleCode | WorkflowRoleCode[] | string | string[]
): boolean {
  const have = resolveWorkflowRoles(roleNames);
  const needList = Array.isArray(required) ? required : [required];
  return needList.some((r) => {
    const code = normalizeWorkflowRole(r);
    return code !== null && have.has(code);
  });
}

/** Role.name list for permission gates (Admin always included for HM-style actions). */
export function roleNamesFor(...codes: WorkflowRoleCode[]): string[] {
  return codes.map((c) => WORKFLOW_ROLE_DB_NAMES[c]);
}

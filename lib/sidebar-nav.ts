import type { WorkflowRoleCode } from '@/lib/workflow-roles';
import { resolveWorkflowRoles } from '@/lib/workflow-roles';

/**
 * Ordered sidebar sections / items.
 * `inventory` / `issue-queue` are standalone links;
 * `inventory-system` is the full Inventory System group.
 */
export type SidebarEntryKey =
  | 'onboarding'
  | 'executive-dashboard'
  | 'hierarchy-dashboard'
  | 'my-assignments'
  | 'customers'
  | 'orders'
  | 'projects'
  | 'verify-queue'
  | 'inventory'
  | 'issue-queue'
  | 'inventory-system'
  | 'maintenance'
  | 'notifications'
  | 'reporting'
  | 'project-hierarchy'
  | 'definitions'
  | 'administration';

/** Default / Admin: full nav with new groupings */
export const FALLBACK_SIDEBAR_ORDER: SidebarEntryKey[] = [
  'onboarding',
  'executive-dashboard',
  'hierarchy-dashboard',
  'my-assignments',
  'customers',
  'orders',
  'projects',
  'verify-queue',
  'inventory-system',
  'maintenance',
  'notifications',
  'reporting',
  'project-hierarchy',
  'definitions',
  'administration',
];

export const ROLE_SIDEBAR_ORDER: Record<WorkflowRoleCode, SidebarEntryKey[]> = {
  ADMIN: FALLBACK_SIDEBAR_ORDER,
  PD: [
    'onboarding',
    'executive-dashboard',
    'hierarchy-dashboard',
    'my-assignments',
    'customers',
    'orders',
    'projects',
    'inventory',
    'maintenance',
    'notifications',
    'reporting',
    'definitions',
  ],
  HM: [
    'onboarding',
    'hierarchy-dashboard',
    'executive-dashboard',
    'projects',
    'my-assignments',
    'verify-queue',
    'inventory-system',
    'maintenance',
    'notifications',
    'reporting',
    'project-hierarchy',
    'definitions',
  ],
  IM: [
    'onboarding',
    'inventory-system',
    'my-assignments',
    'hierarchy-dashboard',
    'notifications',
    'reporting',
    'definitions',
  ],
  DEV: [
    'onboarding',
    'my-assignments',
    'inventory',
    'notifications',
  ],
  // ME / FSE / IE use the full fallback layout (incl. Onboarding).
  ME: FALLBACK_SIDEBAR_ORDER,
  FSE: FALLBACK_SIDEBAR_ORDER,
  IE: FALLBACK_SIDEBAR_ORDER,
};

const ROLE_PRIORITY: WorkflowRoleCode[] = ['ADMIN', 'PD', 'HM', 'IM', 'DEV', 'ME', 'FSE', 'IE'];

/** Highest-priority Spec 00 workflow role for sidebar layout. */
export function primarySidebarRole(
  roleNames: string[] | null | undefined
): WorkflowRoleCode | null {
  if (!roleNames?.length) return null;
  const have = resolveWorkflowRoles(roleNames);
  for (const role of ROLE_PRIORITY) {
    if (have.has(role)) return role;
  }
  return null;
}

export function sidebarOrderForRoles(
  roleNames: string[] | null | undefined
): SidebarEntryKey[] {
  const role = primarySidebarRole(roleNames);
  if (!role) return FALLBACK_SIDEBAR_ORDER;
  return ROLE_SIDEBAR_ORDER[role];
}

import type { WorkflowRoleCode } from '@/lib/workflow-roles';
import { resolveWorkflowRoles } from '@/lib/workflow-roles';

/**
 * Ordered sidebar sections / items.
 * `inventory` / `issue-queue` are standalone links;
 * `inventory-system` is the full Inventory System group.
 */
export type SidebarEntryKey =
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
  | 'administration';

/** Default / Admin: full nav with new groupings */
export const FALLBACK_SIDEBAR_ORDER: SidebarEntryKey[] = [
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
  'administration',
];

export const ROLE_SIDEBAR_ORDER: Record<WorkflowRoleCode, SidebarEntryKey[]> = {
  ADMIN: FALLBACK_SIDEBAR_ORDER,
  PD: [
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
  ],
  HM: [
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
  ],
  IM: [
    'inventory-system',
    'hierarchy-dashboard',
    'notifications',
    'reporting',
  ],
  DEV: [
    'my-assignments',
    'inventory',
    'notifications',
  ],
};

const ROLE_PRIORITY: WorkflowRoleCode[] = ['ADMIN', 'PD', 'HM', 'IM', 'DEV'];

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

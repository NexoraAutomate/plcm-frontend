/**
 * Map a notification to a route the current user is allowed to open.
 *
 * Stored hrefs often point at /projects/{id}. Inventory Manager and Developer
 * should not land there — send them to the matching warehouse / assignment page.
 */

import { P, routePermissionForPath } from '@/lib/permission-codes';
import { primarySidebarRole } from '@/lib/sidebar-nav';
import type { AppNotification } from '@/lib/app-notifications';

export type NotificationHrefCan = (permission: string | string[]) => boolean;

export type NotificationHrefOptions = {
  can: NotificationHrefCan;
  roleNames?: string[] | null;
};

const SHORTAGE_TYPES = new Set([
  'inventory_shortage',
  'inventory_shortage_fulfilled',
  'inventory_shortage_partial',
  'shortage_cancelled',
]);

const RESERVATION_TYPES = new Set([
  'reservation_idle_reminder',
  'reservation_auto_released',
  'inventory_reserved',
  'reservation_released',
  'reservation_extended',
]);

const ISSUE_RETURN_TYPES = new Set([
  'inventory_returned',
  'inventory_issued',
  'inventory_return_accepted',
  'inventory_return_rejected',
  'item_issued_hm',
]);

const INSPECT_TYPES = new Set([
  'rework_returned',
  'rework_item_removed',
  'inspection_started',
  'inspection_passed',
  'inspection_failed',
  'repair_complete',
  'recall_force_return',
  'recall_returned',
  'recall_inspected',
  'install_reverted',
  'project_cancelled',
]);

const SETTINGS_TYPES = new Set([
  'user_created',
  'user_activated',
  'user_deactivated',
  'user_edited',
  'user_deleted',
  'user_signup_pending',
  'password_changed',
  'role_assigned',
  'backup_created',
  'backup_restored',
  'hierarchy_config_edited',
  'hierarchy_config_created',
  'hierarchy_config_deleted',
]);

const PROJECT_TAB_VALUES = new Set(['workflow', 'hierarchy', 'reservations', 'bottlenecks']);

/** IM / DEV work from warehouse and assignment queues, not project detail. */
export function canUseProjectDetail(roleNames?: string[] | null): boolean {
  const primary = primarySidebarRole(roleNames);
  if (primary === 'IM' || primary === 'DEV') return false;
  return true;
}

export function notificationPathname(href: string): string {
  const path = href.split('?')[0]?.split('#')[0] || '/';
  return path.replace(/\/$/, '') || '/';
}

export function isProjectDetailHref(href: string): boolean {
  return /^\/projects\/\d+/.test(notificationPathname(href));
}

export function canAccessNotificationHref(href: string, can: NotificationHrefCan): boolean {
  const required = routePermissionForPath(notificationPathname(href));
  if (!required) return true;
  return can(required);
}

function uniqueHrefs(hrefs: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const href of hrefs) {
    if (!href || seen.has(href)) continue;
    seen.add(href);
    out.push(href);
  }
  return out;
}

function projectHref(projectId?: number | null, tab?: string): string | null {
  if (projectId == null || !Number.isFinite(projectId)) return null;
  if (tab && PROJECT_TAB_VALUES.has(tab)) {
    return `/projects/${projectId}?tab=${tab}`;
  }
  return `/projects/${projectId}`;
}

function projectReservationsHref(
  projectId?: number | null,
  shortageId?: number | null
): string | null {
  if (projectId == null || !Number.isFinite(projectId)) return null;
  const params = new URLSearchParams({ tab: 'reservations' });
  if (shortageId != null) params.set('shortage', String(shortageId));
  return `/projects/${projectId}?${params.toString()}`;
}

function shortageListHref(item: AppNotification): string {
  const shortageId =
    item.shortageId ?? (item.entityType === 'shortage' ? item.entityId : undefined);
  if (shortageId != null) return `/shortages?shortage=${shortageId}`;
  return '/shortages';
}

function inventoryReservedHref(item: AppNotification): string {
  const params = new URLSearchParams();
  params.set('stock', 'reserved');
  const q = item.serialNumber || item.partNumber;
  if (q) params.set('q', q);
  return `/inventory?${params.toString()}`;
}

function upgradeStoredHref(item: AppNotification): string | null {
  const stored = item.href?.trim();
  if (!stored || stored === '/notifications') return null;
  const projectMatch = notificationPathname(stored).match(/^\/projects\/(\d+)$/);
  if (!projectMatch) return stored;
  const projectId = Number(projectMatch[1]);
  if (SHORTAGE_TYPES.has(item.type) || RESERVATION_TYPES.has(item.type)) {
    const shortageId =
      item.shortageId ?? (item.entityType === 'shortage' ? item.entityId : undefined);
    return projectReservationsHref(projectId, SHORTAGE_TYPES.has(item.type) ? shortageId : undefined);
  }
  if (item.type === 'ready_for_inventory' || item.type === 'hierarchy_generated') {
    return projectReservationsHref(projectId);
  }
  return stored;
}

function preferredHrefs(item: AppNotification, allowProject: boolean): string[] {
  const type = item.type;
  const projectId = item.projectId;
  const hrefs: Array<string | null | undefined> = [];

  if (type === 'inventory_shortage_fulfilled') {
    const shortageId =
      item.shortageId ?? (item.entityType === 'shortage' ? item.entityId : undefined);
    if (allowProject) hrefs.push(projectReservationsHref(projectId, shortageId));
    hrefs.push(inventoryReservedHref(item), shortageListHref(item), '/inventory');
  } else if (SHORTAGE_TYPES.has(type)) {
    const shortageId =
      item.shortageId ?? (item.entityType === 'shortage' ? item.entityId : undefined);
    if (allowProject) hrefs.push(projectReservationsHref(projectId, shortageId));
    hrefs.push(shortageListHref(item), '/inventory');
  } else if (RESERVATION_TYPES.has(type)) {
    if (allowProject) hrefs.push(projectReservationsHref(projectId));
    hrefs.push(inventoryReservedHref(item), '/inventory');
  } else if (ISSUE_RETURN_TYPES.has(type)) {
    hrefs.push('/my-assignments', '/inventory/issuances', '/issue-queue', '/inventory');
  } else if (type === 'item_request_created') {
    hrefs.push('/issue-queue', '/my-assignments');
  } else if (type === 'developer_assigned' || type === 'developer_unassigned') {
    hrefs.push('/my-assignments');
    if (allowProject) hrefs.push(projectHref(projectId));
  } else if (type === 'handover_requested') {
    hrefs.push('/verify-queue', '/my-assignments');
    if (allowProject) hrefs.push(projectHref(projectId));
  } else if (type === 'verified_installed' || type === 'install_started' || type === 'test_passed') {
    hrefs.push('/verify-queue', '/my-assignments');
    if (allowProject) hrefs.push(projectHref(projectId));
  } else if (type === 'test_failed') {
    hrefs.push('/inspect-queue', '/verify-queue', '/inventory');
    if (allowProject) hrefs.push(projectHref(projectId));
  } else if (INSPECT_TYPES.has(type)) {
    hrefs.push('/inspect-queue', '/inventory', '/my-assignments');
    if (allowProject) hrefs.push(projectHref(projectId));
  } else if (type.startsWith('config_change')) {
    hrefs.push('/config-changes');
    if (allowProject) hrefs.push(projectHref(projectId));
  } else if (
    type.startsWith('label_') ||
    type === 'inventory_created' ||
    type === 'inventory_imported' ||
    type === 'inventory_edited' ||
    type === 'inventory_deleted' ||
    type === 'inventory_assembled' ||
    type === 'ready_for_inventory' ||
    type === 'hierarchy_generated'
  ) {
    if (allowProject && (type === 'ready_for_inventory' || type === 'hierarchy_generated')) {
      hrefs.push(projectReservationsHref(projectId));
    }
    hrefs.push('/inventory', '/issue-queue');
    if (allowProject) hrefs.push(projectHref(projectId));
  } else if (SETTINGS_TYPES.has(type) || type.startsWith('user_') || type.startsWith('role_')) {
    hrefs.push('/settings');
  } else if (
    type.startsWith('maintenance') ||
    type.startsWith('case_') ||
    type.includes('fault') ||
    type.startsWith('delivery') ||
    type === 'cascade_fault'
  ) {
    hrefs.push(item.href, '/maintenance');
  } else if (type.startsWith('order_')) {
    hrefs.push(item.href, '/orders');
  } else if (type.startsWith('customer_')) {
    hrefs.push(item.href, '/customers');
  } else if (type.startsWith('report_')) {
    hrefs.push(item.href, '/reporting');
  } else if (
    type.startsWith('project_') ||
    type === 'hm_assigned' ||
    type === 'project_progress_milestone' ||
    type === 'rework_cycle_warning'
  ) {
    if (allowProject) hrefs.push(projectHref(projectId), '/projects');
    hrefs.push('/hierarchy-dashboard', '/inventory');
  } else {
    hrefs.push(item.href);
  }

  hrefs.push(upgradeStoredHref(item), '/notifications');
  return uniqueHrefs(hrefs);
}

export function resolveNotificationHref(
  item: AppNotification,
  options: NotificationHrefOptions
): string {
  const allowProject = canUseProjectDetail(options.roleNames);
  for (const href of preferredHrefs(item, allowProject)) {
    if (isProjectDetailHref(href) && !allowProject) continue;
    if (!canAccessNotificationHref(href, options.can)) continue;
    return href;
  }
  if (options.can(P.view_notifications)) return '/notifications';
  return '/';
}

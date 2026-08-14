import { CaseStatus, FaultyEntityStatus } from '@/lib/models';
import { getCaseStatusMeta, mapCaseStatusFromApi } from '@/lib/maintenance-workflow';
import type { Customer, FaultyEntity, InventoryInstallerNotice, InventoryReturnNotice, InventoryShortageNotice, MaintenanceCase, Project } from '@/lib/models';
import { parseApiDate } from '@/lib/parse-api-date';

export type AppNotificationType =
  | 'open_maintenance_case'
  | 'confirmed_fault'
  | 'identified_fault'
  | 'suspected_fault'
  | 'under_inspection_fault'
  | 'case_resolved'
  | 'project_completed'
  | 'customer_status_change'
  | 'order_updated'
  | 'project_updated'
  | 'inventory_returned'
  | 'inventory_issued'
  | 'inventory_return_accepted'
  | 'inventory_return_rejected'
  | 'inventory_shortage'
  | 'inventory_shortage_fulfilled'
  | 'inventory_shortage_partial';

export interface AppNotification {
  id: string;
  type: AppNotificationType;
  title: string;
  message: string;
  href: string;
  timestamp: string;
  priority: 'high' | 'medium' | 'low';
  /** Backend notice id for inventory returns / installer notices. */
  metaId?: number;
  /** Issuance id for inventory return accept/reject. */
  metaIssuanceId?: number;
  /** Server-backed inventory notice already marked read (stays in history). */
  serverRead?: boolean;
  /** Persist in history — not removable by Clear all. */
  persistent?: boolean;
  /** Extra text for client-side search (recipient name, notes, etc.). */
  searchText?: string;
}

const OPEN_CASE_STATUSES: string[] = [
  CaseStatus.Open,
  CaseStatus.UnderInspection,
  CaseStatus.UnderRepair,
];

const RECENT_MS = 7 * 24 * 60 * 60 * 1000;

function isRecent(isoDate?: string | null): boolean {
  if (!isoDate) return false;
  const ts = parseApiDate(isoDate).getTime();
  if (Number.isNaN(ts)) return false;
  return Date.now() - ts <= RECENT_MS;
}

export function buildAppNotifications(input: {
  maintenanceCases: MaintenanceCase[];
  faultyEntities: FaultyEntity[];
  projects: Project[];
  customers: Customer[];
  inventoryReturnNotices?: InventoryReturnNotice[];
  inventoryInstallerNotices?: InventoryInstallerNotice[];
  inventoryShortageNotices?: InventoryShortageNotice[];
}): AppNotification[] {
  const {
    maintenanceCases,
    faultyEntities,
    projects,
    customers,
    inventoryReturnNotices = [],
    inventoryInstallerNotices = [],
    inventoryShortageNotices = [],
  } = input;
  const notifications: AppNotification[] = [];

  for (const mc of maintenanceCases) {
    if (OPEN_CASE_STATUSES.includes(mc.status)) {
      notifications.push({
        id: `case-open-${mc.id}`,
        type: 'open_maintenance_case',
        title: 'Open maintenance case',
        message: `${mc.case_number} — ${getCaseStatusMeta(mapCaseStatusFromApi(mc.status)).label}`,
        href: `/maintenance/cases/${mc.id}`,
        timestamp: mc.reported_at ?? mc.created_at ?? new Date().toISOString(),
        priority: mc.status === CaseStatus.Open ? 'high' : 'medium',
      });
    }
    if (
      (mc.status === CaseStatus.Resolved || mc.status === CaseStatus.Closed) &&
      isRecent(mc.updated_at ?? mc.reported_at)
    ) {
      notifications.push({
        id: `case-resolved-${mc.id}`,
        type: 'case_resolved',
        title: 'Maintenance case resolved',
        message: `${mc.case_number} marked ${mc.status}`,
        href: `/maintenance/cases/${mc.id}`,
        timestamp: mc.updated_at ?? mc.reported_at ?? new Date().toISOString(),
        priority: 'low',
      });
    }
  }

  for (const fe of faultyEntities) {
    const openCase = maintenanceCases.some(
      (mc) =>
        mc.id === fe.case_id &&
        mc.status !== CaseStatus.Resolved &&
        mc.status !== CaseStatus.Closed
    );
    if (!openCase) continue;

    const label = fe.entity_name ?? fe.part_number ?? 'Entity';
    const base = {
      href: `/maintenance/cases/${fe.case_id}`,
      timestamp: fe.updated_at ?? fe.identified_at ?? new Date().toISOString(),
    };

    if (fe.status === FaultyEntityStatus.CONFIRMED_FAULTY) {
      notifications.push({
        id: `fault-confirmed-${fe.id}-${fe.status}`,
        type: 'confirmed_fault',
        title: 'Confirmed fault',
        message: `${label} requires attention`,
        priority: 'high',
        ...base,
      });
    } else if (fe.status === FaultyEntityStatus.IDENTIFIED) {
      notifications.push({
        id: `fault-identified-${fe.id}-${fe.status}`,
        type: 'identified_fault',
        title: 'Fault identified',
        message: `${label} flagged for inspection`,
        priority: 'medium',
        ...base,
      });
    } else if (fe.status === FaultyEntityStatus.UNDER_INSPECTION) {
      notifications.push({
        id: `fault-inspection-${fe.id}-${fe.status}`,
        type: 'under_inspection_fault',
        title: 'Under inspection',
        message: `${label} is being inspected`,
        priority: 'medium',
        ...base,
      });
    } else if (
      fe.status === FaultyEntityStatus.SUSPECTED ||
      fe.status === ('suspected' as FaultyEntityStatus)
    ) {
      notifications.push({
        id: `fault-potentially-affected-${fe.id}-${fe.status}`,
        type: 'suspected_fault',
        title: 'Potentially affected',
        message: `${label} may be affected by an upstream fault`,
        priority: 'medium',
        ...base,
      });
    }
  }

  for (const project of projects) {
    if (isRecent(project.updated_at)) {
      notifications.push({
        id: `project-updated-${project.id}-${project.updated_at}`,
        type: 'project_updated',
        title: 'Project updated',
        message: `${project.name} — ${project.status_name ?? 'status changed'}`,
        href: `/projects/${project.id}`,
        timestamp: project.updated_at,
        priority: 'low',
      });
    }
    const completed =
      project.status_name === 'Completed' || (project.progress ?? 0) >= 100;
    if (completed && isRecent(project.updated_at)) {
      notifications.push({
        id: `project-completed-${project.id}`,
        type: 'project_completed',
        title: 'Project completed',
        message: `${project.name} reached 100% progress`,
        href: `/projects/${project.id}`,
        timestamp: project.updated_at,
        priority: 'low',
      });
    }
  }

  for (const customer of customers) {
    if (
      customer.updated_at &&
      customer.created_at &&
      customer.updated_at !== customer.created_at &&
      isRecent(customer.updated_at)
    ) {
      notifications.push({
        id: `customer-status-${customer.id}-${customer.updated_at}`,
        type: 'customer_status_change',
        title: 'Customer status updated',
        message: `${customer.name} — ${customer.status_name}`,
        href: `/customers/${customer.id}`,
        timestamp: customer.updated_at,
        priority: 'medium',
      });
    }
  }

  for (const notice of inventoryReturnNotices) {
    const itemLabel =
      notice.inventory_name ||
      notice.part_number ||
      (notice.inventory_id != null ? `Inventory #${notice.inventory_id}` : 'inventory item');
    const who = notice.returned_by_name || `User #${notice.returned_by_user_id}`;
    const serial = notice.serial_number ? ` (${notice.serial_number})` : '';
    const decision = (notice.decision || 'pending').toLowerCase();
    const searchText = [
      itemLabel,
      who,
      notice.serial_number,
      notice.part_number,
      notice.request_notes,
      notice.decision_notes,
      decision,
    ]
      .filter(Boolean)
      .join(' ');

    if (decision === 'pending' || !notice.decision) {
      notifications.push({
        id: `inventory-returned-${notice.id}`,
        type: 'inventory_returned',
        title: 'Inventory return requested',
        message: `Installer ${who} requested return of ${itemLabel}${serial}`,
        href: '/inventory/issuances',
        timestamp: notice.created_at,
        priority: 'high',
        metaId: notice.id,
        metaIssuanceId: notice.issuance_id,
        serverRead: false,
        persistent: true,
        searchText,
      });
    } else if (decision === 'accepted') {
      notifications.push({
        id: `inventory-returned-${notice.id}`,
        type: 'inventory_return_accepted',
        title: 'Return accepted (admin)',
        message: `Accepted return of ${itemLabel}${serial} from ${who}`,
        href: '/inventory/issuances',
        timestamp: notice.decided_at || notice.created_at,
        priority: 'low',
        metaId: notice.id,
        metaIssuanceId: notice.issuance_id,
        serverRead: true,
        persistent: true,
        searchText,
      });
    } else if (decision === 'rejected') {
      notifications.push({
        id: `inventory-returned-${notice.id}`,
        type: 'inventory_return_rejected',
        title: 'Return rejected (admin)',
        message: `Rejected return of ${itemLabel}${serial} from ${who}`,
        href: '/inventory/issuances',
        timestamp: notice.decided_at || notice.created_at,
        priority: 'low',
        metaId: notice.id,
        metaIssuanceId: notice.issuance_id,
        serverRead: true,
        persistent: true,
        searchText,
      });
    }
  }

  for (const notice of inventoryInstallerNotices) {
    const itemLabel =
      notice.inventory_name ||
      notice.part_number ||
      (notice.inventory_id != null ? `Inventory #${notice.inventory_id}` : 'inventory item');
    const serial = notice.serial_number ? ` (${notice.serial_number})` : '';
    const recipient = notice.user_name || `User #${notice.user_id}`;
    const isRead = Boolean(notice.read_at);
    const searchText = [
      itemLabel,
      recipient,
      notice.message,
      notice.notes,
      notice.serial_number,
      notice.part_number,
      notice.notice_type,
    ]
      .filter(Boolean)
      .join(' ');

    if (notice.notice_type === 'issued') {
      notifications.push({
        id: `inventory-issued-${notice.id}`,
        type: 'inventory_issued',
        title: 'Inventory issued',
        message:
          notice.message ||
          `${itemLabel}${serial} issued to ${recipient}`,
        href: '/inventory/issuances',
        timestamp: notice.created_at,
        priority: isRead ? 'low' : 'high',
        metaId: notice.id,
        metaIssuanceId: notice.issuance_id ?? undefined,
        serverRead: isRead,
        persistent: true,
        searchText,
      });
    } else if (notice.notice_type === 'return_accepted') {
      notifications.push({
        id: `inventory-return-accepted-${notice.id}`,
        type: 'inventory_return_accepted',
        title: 'Return accepted',
        message:
          notice.message ||
          `Return of ${itemLabel}${serial} accepted for ${recipient}`,
        href: '/inventory/issuances',
        timestamp: notice.created_at,
        priority: isRead ? 'low' : 'medium',
        metaId: notice.id,
        metaIssuanceId: notice.issuance_id ?? undefined,
        serverRead: isRead,
        persistent: true,
        searchText,
      });
    } else if (notice.notice_type === 'return_rejected') {
      notifications.push({
        id: `inventory-return-rejected-${notice.id}`,
        type: 'inventory_return_rejected',
        title: 'Return rejected',
        message:
          notice.message ||
          `Return of ${itemLabel}${serial} rejected for ${recipient}`,
        href: '/inventory/issuances',
        timestamp: notice.created_at,
        priority: isRead ? 'low' : 'high',
        metaId: notice.id,
        metaIssuanceId: notice.issuance_id ?? undefined,
        serverRead: isRead,
        persistent: true,
        searchText,
      });
    }
  }

  for (const notice of inventoryShortageNotices) {
    const flight = notice.flight_code || notice.flight_name || 'Flight';
    const sdls = notice.sdls_code || notice.sdls_name || 'SDLS';
    const lru = notice.lru_name || 'item';
    const pn = notice.part_number || '—';
    const href = notice.project_id ? `/projects/${notice.project_id}` : '/shortages';
    const isRead = Boolean(notice.read_at);
    const searchText = [
      pn,
      notice.qty,
      flight,
      sdls,
      lru,
      notice.project_name,
      notice.message,
      notice.notice_type,
    ]
      .filter(Boolean)
      .join(' ');
    const message =
      notice.message ||
      `PN ${pn}, Qty ${notice.qty}, Flight ${flight}, SDLS ${sdls}, LRU ${lru}`;

    if (notice.notice_type === 'shortage_fulfilled') {
      notifications.push({
        id: `shortage-notice-${notice.id}`,
        type: 'inventory_shortage_fulfilled',
        title: 'Shortage fulfilled — auto-reserved',
        message,
        href,
        timestamp: notice.created_at,
        priority: isRead ? 'low' : 'medium',
        metaId: notice.id,
        serverRead: isRead,
        persistent: true,
        searchText,
      });
    } else if (notice.notice_type === 'shortage_partial') {
      notifications.push({
        id: `shortage-notice-${notice.id}`,
        type: 'inventory_shortage_partial',
        title: 'Shortage partially fulfilled',
        message,
        href,
        timestamp: notice.created_at,
        priority: isRead ? 'low' : 'medium',
        metaId: notice.id,
        serverRead: isRead,
        persistent: true,
        searchText,
      });
    } else {
      notifications.push({
        id: `shortage-notice-${notice.id}`,
        type: 'inventory_shortage',
        title: 'Inventory shortage',
        message,
        href,
        timestamp: notice.created_at,
        priority: isRead ? 'low' : 'high',
        metaId: notice.id,
        serverRead: isRead,
        persistent: true,
        searchText,
      });
    }
  }

  return notifications.sort(
    (a, b) => parseApiDate(b.timestamp).getTime() - parseApiDate(a.timestamp).getTime()
  );
}

/** Client-side filter for notification history search. */
export function filterAppNotifications(
  items: AppNotification[],
  query: string
): AppNotification[] {
  const q = query.trim().toLowerCase();
  if (!q) return items;
  return items.filter((item) => {
    const haystack = [
      item.title,
      item.message,
      item.type,
      item.searchText,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return haystack.includes(q);
  });
}

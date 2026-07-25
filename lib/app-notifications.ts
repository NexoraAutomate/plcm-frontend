import { CaseStatus, FaultyEntityStatus } from '@/lib/models';
import { getCaseStatusMeta, mapCaseStatusFromApi } from '@/lib/maintenance-workflow';
import type { Customer, FaultyEntity, InventoryReturnNotice, MaintenanceCase, Project } from '@/lib/models';

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
  | 'inventory_returned';

export interface AppNotification {
  id: string;
  type: AppNotificationType;
  title: string;
  message: string;
  href: string;
  timestamp: string;
  priority: 'high' | 'medium' | 'low';
  /** Backend notice id for inventory returns (optional). */
  metaId?: number;
}

const OPEN_CASE_STATUSES: string[] = [
  CaseStatus.Open,
  CaseStatus.UnderInspection,
  CaseStatus.UnderRepair,
];

const RECENT_MS = 7 * 24 * 60 * 60 * 1000;

function isRecent(isoDate?: string | null): boolean {
  if (!isoDate) return false;
  const ts = new Date(isoDate).getTime();
  return Date.now() - ts <= RECENT_MS;
}

export function buildAppNotifications(input: {
  maintenanceCases: MaintenanceCase[];
  faultyEntities: FaultyEntity[];
  projects: Project[];
  customers: Customer[];
  inventoryReturnNotices?: InventoryReturnNotice[];
}): AppNotification[] {
  const {
    maintenanceCases,
    faultyEntities,
    projects,
    customers,
    inventoryReturnNotices = [],
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
    if (notice.read_at) continue;
    const itemLabel =
      notice.inventory_name ||
      notice.part_number ||
      (notice.inventory_id != null ? `Inventory #${notice.inventory_id}` : 'inventory item');
    const who = notice.returned_by_name || `User #${notice.returned_by_user_id}`;
    notifications.push({
      id: `inventory-returned-${notice.id}`,
      type: 'inventory_returned',
      title: 'Inventory returned',
      message: `Installer ${who} has returned ${itemLabel}${
        notice.serial_number ? ` (${notice.serial_number})` : ''
      }`,
      href: '/inventory/issuances',
      timestamp: notice.created_at,
      priority: 'high',
      metaId: notice.id,
    });
  }

  return notifications.sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
}

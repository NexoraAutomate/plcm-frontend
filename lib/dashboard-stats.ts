import { resolveStatusName } from './entity-status';
import {
  CaseStatus,
  FaultyEntityStatus,
} from './models';
import { resolveEntityTypeLabel } from '@/lib/app-definitions';
import type {
  Customer,
  Order,
  Project,
  Status,
  MaintenanceCase,
  FaultyEntity,
  System,
  Subsystem,
  Module,
  Unit,
  Component,
  Inventory,
} from './models';

const PROJECT_STATUS_KEYS = [
  'Initiation',
  'Planning',
  'Execution',
  'Monitoring',
  'Completed',
  'On Hold',
] as const;

const CUSTOMER_STATUS_KEYS = ['Active', 'Inactive', 'Prospect', 'Blacklisted'] as const;

const ORDER_STATUS_KEYS = [
  'Created',
  'Confirmed',
  'Processing',
  'Shipped',
  'Delivered',
  'Cancelled',
] as const;

const MAINTENANCE_STATUS_KEYS: CaseStatus[] = [
  CaseStatus.Open,
  CaseStatus.UnderInspection,
  CaseStatus.UnderRepair,
  CaseStatus.Resolved,
  CaseStatus.Closed,
];

const ACTIVE_FAULT_STATUSES: FaultyEntityStatus[] = [
  FaultyEntityStatus.IDENTIFIED,
  FaultyEntityStatus.SUSPECTED,
  FaultyEntityStatus.UNDER_INSPECTION,
  FaultyEntityStatus.CONFIRMED_FAULTY,
];

function normalizeFaultStatusForStats(status: FaultyEntityStatus | string): string {
  if (status === FaultyEntityStatus.SUSPECTED || status === 'suspected') {
    return FaultyEntityStatus.IDENTIFIED;
  }
  if (
    status === FaultyEntityStatus.HEALTHY ||
    status === FaultyEntityStatus.FALSEPOSITIVE
  ) {
    return FaultyEntityStatus.NO_FAULT_FOUND;
  }
  return String(status);
}

export function countByField<T>(
  items: T[],
  getKey: (item: T) => string,
  knownKeys?: readonly string[]
): Record<string, number> {
  const counts: Record<string, number> = {};

  if (knownKeys) {
    for (const key of knownKeys) {
      counts[key] = 0;
    }
  }

  for (const item of items) {
    const key = getKey(item);
    counts[key] = (counts[key] ?? 0) + 1;
  }

  return counts;
}

export function resolveEntityStatus(
  entity: { status_id?: number | null; status_name?: string; status?: { status_name?: string } },
  statuses: Status[]
): string {
  return resolveStatusName(
    { ...entity, status_id: entity.status_id ?? undefined },
    statuses
  );
}

export function getProjectStatusCounts(projects: Project[]): Record<string, number> {
  return countByField(projects, (p) => p.status_name ?? 'Unknown', PROJECT_STATUS_KEYS);
}

export function getInProgressProjectCount(projects: Project[]): number {
  return projects.filter(
    (p) => p.status_name === 'Execution' || p.status_name === 'Monitoring'
  ).length;
}

export function getCompletedProjectCount(projects: Project[]): number {
  return projects.filter((p) => p.status_name === 'Completed').length;
}

export function getActiveProjectCount(projects: Project[]): number {
  return projects.filter(
    (p) => p.status_name !== 'Completed' && p.status_name !== 'On Hold'
  ).length;
}

export function getMaintenanceStatusCounts(
  cases: MaintenanceCase[]
): Record<string, number> {
  return countByField(cases, (c) => c.status, MAINTENANCE_STATUS_KEYS);
}

export function getOpenMaintenanceCaseCount(cases: MaintenanceCase[]): number {
  return cases.filter(
    (c) =>
      c.status === CaseStatus.Open ||
      c.status === CaseStatus.UnderInspection ||
      c.status === CaseStatus.UnderRepair
  ).length;
}

export function getCustomerStatusCounts(
  customers: Customer[],
  statuses: Status[]
): Record<string, number> {
  return countByField(
    customers,
    (c) => resolveEntityStatus(c, statuses),
    CUSTOMER_STATUS_KEYS
  );
}

export function getActiveCustomerCount(
  customers: Customer[],
  statuses: Status[]
): number {
  return customers.filter((c) => resolveEntityStatus(c, statuses) === 'Active').length;
}

export function getOrderStatusCounts(
  orders: Order[],
  statuses: Status[]
): Record<string, number> {
  return countByField(
    orders,
    (o) => resolveEntityStatus(o, statuses),
    ORDER_STATUS_KEYS
  );
}

export function getActiveFaultyEntityCount(faultyEntities: FaultyEntity[]): number {
  return faultyEntities.filter((f) =>
    ACTIVE_FAULT_STATUSES.includes(f.status)
  ).length;
}

export function getInventoryTotal(inventory: Inventory[]): number {
  return inventory.reduce((sum, item) => sum + item.quantity, 0);
}

export function getHardwareFleetCounts(data: {
  systems: System[];
  subsystems: Subsystem[];
  modules: Module[];
  units: Unit[];
  components: Component[];
}): { name: string; count: number }[] {
  return [
    { name: resolveEntityTypeLabel('system', true), count: data.systems.length },
    { name: resolveEntityTypeLabel('subsystem', true), count: data.subsystems.length },
    { name: resolveEntityTypeLabel('module', true), count: data.modules.length },
    { name: resolveEntityTypeLabel('unit', true), count: data.units.length },
    { name: resolveEntityTypeLabel('component', true), count: data.components.length },
  ];
}

export function projectStatusToChartData(
  projectStatuses: Record<string, number>
): { name: string; value: number }[] {
  return PROJECT_STATUS_KEYS.map((name) => ({
    name,
    value: projectStatuses[name] ?? 0,
  })).filter((d) => d.value > 0);
}

export function maintenanceStatusToChartData(
  maintenanceStatuses: Record<string, number>
): { name: string; value: number; label: string }[] {
  return MAINTENANCE_STATUS_KEYS.map((status) => ({
    name: status,
    label: status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
    value: maintenanceStatuses[status] ?? 0,
  })).filter((d) => d.value > 0);
}

export function groupOrdersByMonth(
  orders: Order[],
  months = 6
): { month: string; orders: number }[] {
  const now = new Date();
  const buckets: { month: string; orders: number; sortKey: number }[] = [];

  for (let i = months - 1; i >= 0; i--) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const label = date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
    buckets.push({ month: label, orders: 0, sortKey: date.getTime() });
  }

  for (const order of orders) {
    if (!order.order_date) continue;
    const orderDate = new Date(order.order_date);
    if (Number.isNaN(orderDate.getTime())) continue;

    const bucketStart = new Date(orderDate.getFullYear(), orderDate.getMonth(), 1).getTime();
    const bucket = buckets.find((b) => b.sortKey === bucketStart);
    if (bucket) {
      bucket.orders += 1;
    }
  }

  return buckets.map(({ month, orders: count }) => ({ month, orders: count }));
}

export function getRecentMaintenanceCases(
  cases: MaintenanceCase[],
  limit = 5
): MaintenanceCase[] {
  return [...cases]
    .sort(
      (a, b) =>
        new Date(b.reported_at || b.created_at).getTime() -
        new Date(a.reported_at || a.created_at).getTime()
    )
    .slice(0, limit);
}

export function getRecentOrders(
  orders: Order[],
  limit = 5
): Order[] {
  return [...orders]
    .sort(
      (a, b) =>
        new Date(b.order_date || b.created_at).getTime() -
        new Date(a.order_date || a.created_at).getTime()
    )
    .slice(0, limit);
}

export function formatMaintenanceStatus(status: string): string {
  return status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

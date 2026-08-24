import { cn } from '@/lib/utils';
import { ItemStatus } from '@/lib/workflow-status';
import type { HierarchyAssignmentStatus, InventoryReservation, InventoryShortage } from '@/lib/models';

/** Visual lifecycle for hierarchy entity cards / install panels. */
export type EntityLifecycleTone =
  | 'short'
  | 'reserved'
  | 'assigned'
  | 'issued'
  | 'installing'
  | 'testing'
  | 'verified'
  | 'defect'
  | 'neutral';

export type EntityLifecycleInput = {
  hasShortage?: boolean;
  hasActiveReservation?: boolean;
  assignedDeveloperId?: number | null;
  assignment?: Pick<
    HierarchyAssignmentStatus,
    'issued' | 'item_status' | 'defect_pending' | 'verified' | 'assigned_developer_id'
  > | null;
  /** Entity / inventory status label when assignment status is unavailable */
  statusName?: string | null;
};

function normalizeStatus(value?: string | null): string {
  return (value || '').trim().toUpperCase().replace(/\s+/g, '_').replace(/\//g, '_');
}

/**
 * Priority: defect → verified → testing → installing → issued → assigned → reserved → short.
 * Shortage only colors when nothing further along the lifecycle has started.
 */
export function resolveEntityLifecycleTone(input: EntityLifecycleInput): EntityLifecycleTone {
  const assignment = input.assignment;
  const itemStatus = normalizeStatus(assignment?.item_status || input.statusName);
  const issued = Boolean(assignment?.issued) || itemStatus === ItemStatus.ISSUED;
  const assignedId =
    assignment?.assigned_developer_id ?? input.assignedDeveloperId ?? null;

  if (assignment?.defect_pending || itemStatus === 'FAILED' || itemStatus.includes('DEFECT')) {
    return 'defect';
  }
  if (
    assignment?.verified ||
    itemStatus === ItemStatus.INSTALLED_VERIFIED ||
    itemStatus === 'INSTALLED_VERIFIED'
  ) {
    return 'verified';
  }
  if (
    itemStatus === ItemStatus.UNDER_TESTING_REVIEW ||
    itemStatus === 'UNDER_TESTING_REVIEW' ||
    itemStatus.includes('TESTING')
  ) {
    return 'testing';
  }
  if (
    itemStatus === ItemStatus.INSTALLATION_IN_PROGRESS ||
    itemStatus === 'INSTALLATION_IN_PROGRESS' ||
    itemStatus.includes('INSTALLATION')
  ) {
    return 'installing';
  }
  if (issued || itemStatus === ItemStatus.ISSUED) {
    return 'issued';
  }
  if (assignedId && !issued) {
    return 'assigned';
  }
  if (input.hasActiveReservation || itemStatus === ItemStatus.RESERVED) {
    return 'reserved';
  }
  if (input.hasShortage) {
    return 'short';
  }
  return 'neutral';
}

/** Darker border + lighter same-tone background for cards. */
export const ENTITY_LIFECYCLE_CARD_CLASS: Record<EntityLifecycleTone, string> = {
  short:
    'border-red-600 bg-red-50/80 ring-1 ring-red-600/25 dark:border-red-500 dark:bg-red-950/40 dark:ring-red-500/30',
  reserved:
    'border-blue-600 bg-blue-50/80 ring-1 ring-blue-600/25 dark:border-blue-500 dark:bg-blue-950/40 dark:ring-blue-500/30',
  assigned:
    'border-purple-600 bg-purple-50/80 ring-1 ring-purple-600/25 dark:border-purple-500 dark:bg-purple-950/40 dark:ring-purple-500/30',
  issued:
    'border-indigo-600 bg-indigo-50/80 ring-1 ring-indigo-600/25 dark:border-indigo-500 dark:bg-indigo-950/40 dark:ring-indigo-500/30',
  installing:
    'border-sky-600 bg-sky-50/80 ring-1 ring-sky-600/25 dark:border-sky-500 dark:bg-sky-950/40 dark:ring-sky-500/30',
  testing:
    'border-amber-600 bg-amber-50/80 ring-1 ring-amber-600/25 dark:border-amber-500 dark:bg-amber-950/40 dark:ring-amber-500/30',
  verified:
    'border-emerald-600 bg-emerald-50/80 ring-1 ring-emerald-600/25 dark:border-emerald-500 dark:bg-emerald-950/40 dark:ring-emerald-500/30',
  defect:
    'border-rose-700 bg-rose-50/80 ring-1 ring-rose-700/25 dark:border-rose-500 dark:bg-rose-950/40 dark:ring-rose-500/30',
  neutral: '',
};

export const ENTITY_LIFECYCLE_LABEL: Record<EntityLifecycleTone, string | null> = {
  short: 'Shortage',
  reserved: 'Reserved',
  assigned: 'Assigned',
  issued: 'Issued',
  installing: 'Installing',
  testing: 'Under testing',
  verified: 'Installed verified',
  defect: 'Defect / rework',
  neutral: null,
};

export function entityLifecycleCardClass(tone: EntityLifecycleTone, extra?: string) {
  return cn(ENTITY_LIFECYCLE_CARD_CLASS[tone], extra);
}

export function reservationDisplayFields(
  reservation?: InventoryReservation | null,
  entity?: { part_number?: string | null; serial_number?: string | null }
) {
  return {
    partNumber: entity?.part_number?.trim() || reservation?.part_number?.trim() || null,
    serialNumber: entity?.serial_number?.trim() || reservation?.serial_number?.trim() || null,
    inventoryName: reservation?.inventory_name?.trim() || null,
    reservedBy: reservation?.reserved_by_name?.trim() || null,
    reservedAt: reservation?.reserved_at || null,
    expiresAt: reservation?.expires_at || null,
    flight: reservation?.flight_name || reservation?.flight_code || null,
    sdls: reservation?.sdls_name || reservation?.sdls_code || null,
  };
}

export function shortageDisplayFields(shortage?: InventoryShortage | null) {
  if (!shortage) return null;
  return {
    partNumber: shortage.part_number?.trim() || null,
    qtyShort: shortage.qty_short,
    lruName: shortage.lru_name?.trim() || null,
  };
}

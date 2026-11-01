import type { Inventory, InventoryInstance } from '@/lib/models';
import { ItemStatus } from '@/lib/workflow-status';

export const INVENTORY_EXPIRY_WARN_DAYS = 30;
export const INVENTORY_EXPIRY_WEEK_DAYS = 7;

export type InventoryExpiryLevel = 'ok' | 'expiring' | 'expired';

export type InventoryLifeCycleSummary = {
  /** Warehouse units that still count toward attention. */
  countable: number;
  expired: number;
  /** Not yet expired, but ends within the next 7 days. */
  expiringThisWeek: number;
  /** Countable units that are neither expired nor expiring this week. */
  reliable: number;
};

/** @deprecated Prefer InventoryLifeCycleSummary */
export type InventoryShelfLifeSummary = InventoryLifeCycleSummary;

export type InventoryExpiryKind = 'shelf_life' | 'warranty';

export type InventoryExpiryHit = {
  kind: InventoryExpiryKind;
  level: Exclude<InventoryExpiryLevel, 'ok'>;
  expiresAt: string;
  label: string;
};

const EXCLUDED_SHELF_LIFE_STATUSES = new Set(
  [
    ItemStatus.ISSUED,
    ItemStatus.INSTALLATION_IN_PROGRESS,
    ItemStatus.UNDER_TESTING_REVIEW,
    ItemStatus.INSTALLED_VERIFIED,
  ].map((status) => status.toUpperCase())
);

function parseExpiryDate(value?: string | null): Date | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function normalizeStatusName(value?: string | null): string {
  return (value || '').trim().toUpperCase().replace(/[\s-]+/g, '_');
}

/**
 * Issued / install-in-progress / testing / installed-verified units
 * are outside warehouse shelf-life attention.
 */
export function instanceCountsTowardShelfLifeExpiry(
  instance?: InventoryInstance | null
): boolean {
  if (!instance?.id) return false;
  if (instance.is_reserved) return false;
  if (instance.open_issuance_id != null) return false;
  const status = normalizeStatusName(instance.status_name);
  if (status && EXCLUDED_SHELF_LIFE_STATUSES.has(status)) return false;
  return true;
}

export function classifyExpiryDate(
  value?: string | null,
  options?: { now?: Date; warnDays?: number }
): InventoryExpiryLevel {
  const now = options?.now ?? new Date();
  const warnDays = options?.warnDays ?? INVENTORY_EXPIRY_WARN_DAYS;
  const date = parseExpiryDate(value);
  if (!date) return 'ok';
  if (date.getTime() < now.getTime()) return 'expired';
  const horizon = new Date(now);
  horizon.setDate(horizon.getDate() + Math.max(0, warnDays));
  if (date.getTime() <= horizon.getTime()) return 'expiring';
  return 'ok';
}

function collectHits(
  shelfLife?: string | null,
  warranty?: string | null,
  now = new Date()
): InventoryExpiryHit[] {
  const hits: InventoryExpiryHit[] = [];
  const shelfLevel = classifyExpiryDate(shelfLife, { now });
  if (shelfLevel !== 'ok' && shelfLife) {
    hits.push({
      kind: 'shelf_life',
      level: shelfLevel,
      expiresAt: shelfLife,
      label: shelfLevel === 'expired' ? 'Expired' : 'Shelf life expiring',
    });
  }
  const warrantyLevel = classifyExpiryDate(warranty, { now });
  if (warrantyLevel !== 'ok' && warranty) {
    hits.push({
      kind: 'warranty',
      level: warrantyLevel,
      expiresAt: warranty,
      label: warrantyLevel === 'expired' ? 'Warranty expired' : 'Warranty expiring',
    });
  }
  return hits;
}

function worstLevel(hits: InventoryExpiryHit[]): InventoryExpiryLevel {
  if (hits.some((hit) => hit.level === 'expired')) return 'expired';
  if (hits.some((hit) => hit.level === 'expiring')) return 'expiring';
  return 'ok';
}

function countableShelfLifeInstances(item: Inventory): InventoryInstance[] {
  return (item.instances ?? []).filter((instance) =>
    instanceCountsTowardShelfLifeExpiry(instance)
  );
}

function lifeCycleSummaryForField(
  item: Inventory,
  field: 'shelf_life' | 'warranty',
  options?: { now?: Date; weekDays?: number }
): InventoryLifeCycleSummary {
  const now = options?.now ?? new Date();
  const weekDays = options?.weekDays ?? INVENTORY_EXPIRY_WEEK_DAYS;
  const instances = countableShelfLifeInstances(item);

  let expired = 0;
  let expiringThisWeek = 0;
  let reliable = 0;

  for (const instance of instances) {
    const value =
      field === 'shelf_life'
        ? instance.shelf_life_expires_at
        : instance.warranty_expires_at;
    const level = classifyExpiryDate(value, {
      now,
      warnDays: weekDays,
    });
    if (level === 'expired') expired += 1;
    else if (level === 'expiring') expiringThisWeek += 1;
    else reliable += 1;
  }

  return {
    countable: instances.length,
    expired,
    expiringThisWeek,
    reliable,
  };
}

/**
 * Per-catalog shelf-life counts for warehouse units:
 * expired / expiring this week / reliable.
 */
export function getInventoryShelfLifeSummary(
  item: Inventory,
  options?: { now?: Date; weekDays?: number }
): InventoryLifeCycleSummary {
  return lifeCycleSummaryForField(item, 'shelf_life', options);
}

/** Per-catalog warranty counts for warehouse units. */
export function getInventoryWarrantySummary(
  item: Inventory,
  options?: { now?: Date; weekDays?: number }
): InventoryLifeCycleSummary {
  return lifeCycleSummaryForField(item, 'warranty', options);
}

export function formatInventoryShelfLifeSummary(
  summary: InventoryLifeCycleSummary
): string | null {
  if (summary.countable <= 0) return null;
  if (summary.expired === 0 && summary.expiringThisWeek === 0) return null;
  const parts = [
    `${summary.expired} expired`,
    `${summary.expiringThisWeek} expiring this week`,
    `${summary.reliable} reliable`,
  ];
  return parts.join(' · ');
}

/** Worst expiry signal across stocked units that still count for shelf life. */
export function getInventoryExpiryAttention(
  item: Inventory,
  options?: { now?: Date }
): {
  level: InventoryExpiryLevel;
  hits: InventoryExpiryHit[];
} {
  const now = options?.now ?? new Date();
  const instances = countableShelfLifeInstances(item);
  const hits =
    instances.length > 0
      ? instances.flatMap((instance) =>
          collectHits(instance.shelf_life_expires_at, instance.warranty_expires_at, now)
        )
      : // Legacy catalog-only dates when no countable units exist.
        collectHits(item.shelf_life_expires_at, item.warranty_expires_at, now);

  return { level: worstLevel(hits), hits };
}

export function getInstanceExpiryAttention(
  instance: InventoryInstance,
  options?: { now?: Date }
) {
  const now = options?.now ?? new Date();
  if (!instanceCountsTowardShelfLifeExpiry(instance)) {
    return { level: 'ok' as const, hits: [] as InventoryExpiryHit[] };
  }
  const hits = collectHits(
    instance.shelf_life_expires_at,
    instance.warranty_expires_at,
    now
  );
  return { level: worstLevel(hits), hits };
}

export function formatExpiryDate(value?: string | null): string {
  const date = parseExpiryDate(value);
  if (!date) return '—';
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

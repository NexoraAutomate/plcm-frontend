import type { Inventory, InventoryInstance } from '@/lib/models';

export const INVENTORY_EXPIRY_WARN_DAYS = 30;

export type InventoryExpiryLevel = 'ok' | 'expiring' | 'expired';

export type InventoryExpiryKind = 'shelf_life' | 'warranty';

export type InventoryExpiryHit = {
  kind: InventoryExpiryKind;
  level: Exclude<InventoryExpiryLevel, 'ok'>;
  expiresAt: string;
  label: string;
};

function parseExpiryDate(value?: string | null): Date | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date;
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
      label: shelfLevel === 'expired' ? 'Shelf life expired' : 'Shelf life expiring',
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

/** Worst expiry signal across catalog row and its stocked units. */
export function getInventoryExpiryAttention(
  item: Inventory,
  options?: { now?: Date }
): {
  level: InventoryExpiryLevel;
  hits: InventoryExpiryHit[];
} {
  const now = options?.now ?? new Date();
  const hits = [
    ...collectHits(item.shelf_life_expires_at, item.warranty_expires_at, now),
    ...(item.instances ?? []).flatMap((instance) =>
      collectHits(instance.shelf_life_expires_at, instance.warranty_expires_at, now)
    ),
  ];

  if (hits.some((hit) => hit.level === 'expired')) {
    return { level: 'expired', hits };
  }
  if (hits.some((hit) => hit.level === 'expiring')) {
    return { level: 'expiring', hits };
  }
  return { level: 'ok', hits: [] };
}

export function getInstanceExpiryAttention(
  instance: InventoryInstance,
  options?: { now?: Date }
) {
  const now = options?.now ?? new Date();
  const hits = collectHits(
    instance.shelf_life_expires_at,
    instance.warranty_expires_at,
    now
  );
  if (hits.some((hit) => hit.level === 'expired')) {
    return { level: 'expired' as const, hits };
  }
  if (hits.some((hit) => hit.level === 'expiring')) {
    return { level: 'expiring' as const, hits };
  }
  return { level: 'ok' as const, hits: [] };
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

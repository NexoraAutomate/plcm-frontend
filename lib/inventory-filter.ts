import type { EntityType, Inventory } from '@/lib/models';
import { inventoryPartNumber } from '@/lib/inventory-entity-fields';
import {
  inventoryUsesInstances,
  type HierarchyEntityType,
} from '@/lib/entity-hierarchy';

/** True when the inventory catalog has units available for install/replacement. */
export function isInventoryInStock(item: Inventory): boolean {
  const type = item.inventory_type as HierarchyEntityType;
  if (inventoryUsesInstances(type)) {
    // Instance-based stock is defined by remaining instance rows.
    // Ignore a stale positive quantity when no instances remain.
    return (item.instances ?? []).some((instance) => Boolean(instance?.id));
  }
  return Number(item.quantity) > 0;
}

function normalizePartNumber(value?: string | null): string {
  return (value ?? '').trim().toLowerCase();
}

export function filterInventoryForReplacement(
  items: Inventory[],
  entityType: EntityType | string,
  entityName: string
): Inventory[] {
  const normalizedType = entityType.toLowerCase();
  const normalizedName = entityName.trim().toLowerCase();

  if (!normalizedName) return [];

  return items
    .filter(
      (item) =>
        item.inventory_type?.toLowerCase() === normalizedType &&
        item.name?.trim().toLowerCase() === normalizedName &&
        isInventoryInStock(item)
    )
    .sort((a, b) => {
      const partA = inventoryPartNumber(a) || a.name || '';
      const partB = inventoryPartNumber(b) || b.name || '';
      return partA.localeCompare(partB);
    });
}

/**
 * In-stock inventory of the same type whose catalog part number matches
 * the faulty entity's part number (serials are unique; part numbers are shared).
 */
export function filterInventoryForReplacementByPartNumber(
  items: Inventory[],
  entityType: EntityType | string,
  partNumber: string
): Inventory[] {
  const normalizedType = entityType.toLowerCase();
  const normalizedPart = normalizePartNumber(partNumber);

  if (!normalizedPart) return [];

  return items
    .filter(
      (item) =>
        item.inventory_type?.toLowerCase() === normalizedType &&
        normalizePartNumber(inventoryPartNumber(item)) === normalizedPart &&
        isInventoryInStock(item)
    )
    .sort((a, b) => {
      const nameA = a.name || '';
      const nameB = b.name || '';
      return nameA.localeCompare(nameB);
    });
}

export function inventoryPartNumberLabel(item: Inventory): string {
  return (
    inventoryPartNumber(item) ||
    item.serial_number?.trim() ||
    item.name?.trim() ||
    `Item #${item.id}`
  );
}

import type { EntityType, Inventory } from '@/lib/models';
import { inventoryPartNumber } from '@/lib/inventory-entity-fields';
import {
  inventoryUsesInstances,
  type HierarchyEntityType,
} from '@/lib/entity-hierarchy';
import {
  getReturnPendingInstances,
  getSelectableInstances,
} from '@/lib/inventory-install';

/**
 * True when the catalog has units available to install/replace
 * (excludes return_pending serials).
 */
export function isInventoryInStock(item: Inventory): boolean {
  const type = item.inventory_type as HierarchyEntityType;
  if (inventoryUsesInstances(type)) {
    const installable = getSelectableInstances(item);
    if (installable.length > 0) return true;
    // Instances hydrated but none installable
    if ((item.instances ?? []).some((instance) => Boolean(instance?.id))) return false;
    // Fallback when instance rows were not hydrated on the list payload.
    return Number(item.available_quantity ?? item.quantity) > 0;
  }
  return Number(item.available_quantity ?? item.quantity) > 0;
}

/** Held stock is only awaiting admin return acceptance (nothing installable). */
export function isInventoryReturnPendingOnly(item: Inventory): boolean {
  const type = item.inventory_type as HierarchyEntityType;
  if (inventoryUsesInstances(type)) {
    const installable = getSelectableInstances(item).length;
    const pending = getReturnPendingInstances(item).length;
    if (installable === 0 && pending > 0) return true;
    // Hydrated empty installable with pending reserved qty from API
    if (
      installable === 0 &&
      Number(item.available_quantity ?? 0) <= 0 &&
      Number(item.reserved_quantity ?? 0) > 0 &&
      Number(item.quantity ?? 0) > 0
    ) {
      return true;
    }
    return false;
  }
  return (
    Number(item.available_quantity ?? 0) <= 0 &&
    Number(item.quantity ?? 0) > 0 &&
    Number(item.reserved_quantity ?? 0) > 0
  );
}

/** Show on entity install lists: installable stock or return-pending-only groups. */
export function isInventoryVisibleForInstall(item: Inventory): boolean {
  return isInventoryInStock(item) || isInventoryReturnPendingOnly(item);
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

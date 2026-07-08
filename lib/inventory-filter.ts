import type { EntityType, Inventory } from '@/lib/models';
import { inventoryPartNumber } from '@/lib/inventory-entity-fields';

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
        item.quantity > 0
    )
    .sort((a, b) => {
      const partA = inventoryPartNumber(a) || a.name || '';
      const partB = inventoryPartNumber(b) || b.name || '';
      return partA.localeCompare(partB);
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

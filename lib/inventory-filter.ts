import type { EntityType, Inventory } from '@/lib/models';

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
      const partA = a.manufacturer_part_number ?? a.name ?? '';
      const partB = b.manufacturer_part_number ?? b.name ?? '';
      return partA.localeCompare(partB);
    });
}

export function inventoryPartNumberLabel(item: Inventory): string {
  return (
    item.manufacturer_part_number?.trim() ||
    item.serial_number?.trim() ||
    item.name?.trim() ||
    `Item #${item.id}`
  );
}

import type { Inventory, InventoryInstance } from '@/lib/models';
import { inventoryPartNumber } from '@/lib/inventory-entity-fields';

export type HierarchyEntityType = 'system' | 'subsystem' | 'module' | 'unit' | 'component';

export const CHILD_INVENTORY_TYPE: Record<
  Exclude<HierarchyEntityType, 'component'>,
  HierarchyEntityType
> = {
  system: 'subsystem',
  subsystem: 'module',
  module: 'unit',
  unit: 'component',
};

export function getChildInventoryType(
  parentType: Exclude<HierarchyEntityType, 'component'>
): HierarchyEntityType {
  return CHILD_INVENTORY_TYPE[parentType];
}

export function getInventoryTypeLabel(type: HierarchyEntityType | undefined): string {
  if (!type) return 'Item';
  return type.charAt(0).toUpperCase() + type.slice(1);
}

/** Components accept a bulk quantity when receiving stock. */
export function inventorySupportsQuantity(type: HierarchyEntityType): boolean {
  return type === 'component';
}

export function resolveInventoryQuantity(type: HierarchyEntityType, quantity: number): number {
  return inventorySupportsQuantity(type) ? quantity : quantity;
}

export function inventoryUsesInstances(type: HierarchyEntityType): boolean {
  return true;
}

export function getInventorySerialNumbers(item: Inventory): string[] {
  const serials = (item.instances ?? [])
    .map(
      (instance) =>
        instance.original_serial_number?.trim() || instance.serial_number?.trim()
    )
    .filter((serial): serial is string => Boolean(serial));
  if (serials.length > 0) return serials;
  const fallback =
    item.original_serial_number?.trim() || item.serial_number?.trim();
  return fallback ? [fallback] : [];
}

export function formatInventorySerialNumbers(item: Inventory): string {
  const serials = getInventorySerialNumbers(item);
  return serials.length > 0 ? serials[0] : '—';
}

export function serialNumberFromInventory(
  item: Inventory,
  instance?: InventoryInstance | null,
  fallbackInstance = 1
): string {
  const fromInstance =
    instance?.original_serial_number?.trim() || instance?.serial_number?.trim();
  if (fromInstance) return fromInstance;

  const fromItem =
    item.original_serial_number?.trim() || item.serial_number?.trim();
  if (fromItem) {
    return fallbackInstance > 1 ? `${fromItem}-${fallbackInstance}` : fromItem;
  }

  let base: string;
  if (inventoryPartNumber(item)) {
    base = `${item.name}-${inventoryPartNumber(item)}`;
  } else {
    base = item.name;
  }
  return fallbackInstance > 1 ? `${base}-${fallbackInstance}` : base;
}

export function nextSerialNumberFromInventory(
  item: Inventory,
  existingChildren: { name: string }[]
): string {
  const existing =
    item.original_serial_number?.trim() || item.serial_number?.trim();
  if (existing) {
    return existing;
  }
  const sameNameCount = existingChildren.filter(
    (child) => child.name.toLowerCase() === item.name.toLowerCase()
  ).length;
  return serialNumberFromInventory(item, undefined, sameNameCount + 1);
}

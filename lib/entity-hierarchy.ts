import type { Inventory, InventoryInstance } from '@/lib/models';

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

/** Only component inventory supports bulk quantity; other types use accumulated instances. */
export function inventorySupportsQuantity(type: HierarchyEntityType): boolean {
  return type === 'component';
}

export function resolveInventoryQuantity(type: HierarchyEntityType, quantity: number): number {
  return inventorySupportsQuantity(type) ? quantity : quantity;
}

export function inventoryUsesInstances(type: HierarchyEntityType): boolean {
  return !inventorySupportsQuantity(type);
}

export function formatInventorySerialNumbers(item: Inventory): string {
  if (inventorySupportsQuantity(item.inventory_type as HierarchyEntityType)) {
    return item.serial_number?.trim() || '—';
  }
  const serials = (item.instances ?? [])
    .map((instance) => instance.serial_number?.trim())
    .filter((serial): serial is string => Boolean(serial));
  if (serials.length > 0) {
    return serials.join(', ');
  }
  return item.serial_number?.trim() || '—';
}

export function serialNumberFromInventory(
  item: Inventory,
  instance?: InventoryInstance | null,
  fallbackInstance = 1
): string {
  if (instance?.serial_number?.trim()) {
    return instance.serial_number.trim();
  }
  let base: string;
  if (item.serial_number?.trim()) {
    base = item.serial_number;
  } else if (item.manufacturer_part_number?.trim()) {
    base = `${item.name}-${item.manufacturer_part_number}`;
  } else {
    base = item.name;
  }
  return fallbackInstance > 1 ? `${base}-${fallbackInstance}` : base;
}

export function nextSerialNumberFromInventory(
  item: Inventory,
  existingChildren: { name: string }[]
): string {
  if (item.serial_number?.trim()) {
    return item.serial_number.trim();
  }
  const sameNameCount = existingChildren.filter(
    (child) => child.name.toLowerCase() === item.name.toLowerCase()
  ).length;
  return serialNumberFromInventory(item, undefined, sameNameCount + 1);
}

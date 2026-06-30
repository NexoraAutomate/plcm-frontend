import type { Inventory } from '@/lib/models';

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

export function serialNumberFromInventory(item: Inventory, instance = 1): string {
  let base: string;
  if (item.serial_number?.trim()) {
    base = item.serial_number;
  } else if (item.manufacturer_part_number?.trim()) {
    base = `${item.name}-${item.manufacturer_part_number}`;
  } else {
    base = item.name;
  }
  return instance > 1 ? `${base}-${instance}` : base;
}

export function nextSerialNumberFromInventory(
  item: Inventory,
  existingChildren: { name: string }[]
): string {
  const sameNameCount = existingChildren.filter(
    (child) => child.name.toLowerCase() === item.name.toLowerCase()
  ).length;
  return serialNumberFromInventory(item, sameNameCount + 1);
}

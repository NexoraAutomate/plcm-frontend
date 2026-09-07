import { inventoryPartNumber } from '@/lib/inventory-entity-fields';
import {
  inventoryUsesInstances,
  type HierarchyEntityType,
} from '@/lib/entity-hierarchy';
import type { Inventory } from '@/lib/models';

type PartNumberEntity = {
  part_number?: string | null;
  original_part_number?: string | null;
  serial_number?: string | null;
  original_serial_number?: string | null;
  is_current_install?: boolean | null;
};

function normalizePartNumber(value?: string | null): string {
  return (value ?? '').trim().toLowerCase();
}

/** Parse the trailing numeric segment of a serial (e.g. …-00003 → 3). */
export function extractTrailingSerialSequence(
  serial: string
): { prefix: string; sequence: number; width: number } | null {
  const trimmed = serial.trim();
  if (!trimmed) return null;
  const match = trimmed.match(/^(.*?)(\d+)$/);
  if (!match) return null;
  return {
    prefix: match[1],
    sequence: Number.parseInt(match[2], 10),
    width: match[2].length,
  };
}

/** Increment the trailing numeric segment, preserving zero-padding width. */
export function incrementSerialNumber(serial: string): string {
  const parsed = extractTrailingSerialSequence(serial);
  if (!parsed) {
    return serial.trim() ? `${serial.trim()}-00001` : '00001';
  }
  const next = parsed.sequence + 1;
  return `${parsed.prefix}${String(next).padStart(parsed.width, '0')}`;
}

function entitySerial(entity: PartNumberEntity): string {
  return entity.serial_number?.trim() || entity.original_serial_number?.trim() || '';
}

function instanceIdentityValues(item: Inventory): string[] {
  const values: string[] = [];
  for (const instance of item.instances ?? []) {
    const serial = instance.serial_number?.trim();
    const original = instance.original_serial_number?.trim();
    if (serial) values.push(serial);
    if (original) values.push(original);
  }
  const fallbackSerial = item.serial_number?.trim();
  const fallbackOriginal = item.original_serial_number?.trim();
  if (values.length === 0 && fallbackSerial) values.push(fallbackSerial);
  if (values.length === 0 && fallbackOriginal) values.push(fallbackOriginal);
  return values;
}

function occupiedInventorySerials(
  item: Inventory,
  entities: PartNumberEntity[] = []
): Set<string> {
  const occupied = new Set<string>();
  for (const serial of instanceIdentityValues(item)) {
    occupied.add(serial.toLowerCase());
  }
  for (const serial of getUsedEntitySerials(item, entities)) {
    occupied.add(serial.toLowerCase());
  }
  return occupied;
}

function nextUnusedSerial(start: string, occupied: Set<string>): string {
  let candidate = start.trim();
  if (!candidate) return '';
  if (!occupied.has(candidate.toLowerCase())) return candidate;
  candidate = incrementSerialNumber(candidate);
  while (occupied.has(candidate.toLowerCase())) {
    candidate = incrementSerialNumber(candidate);
  }
  return candidate;
}

function entityMatchesPart(entity: PartNumberEntity, partNumber: string): boolean {
  if (!partNumber) return false;
  return (
    normalizePartNumber(entity.part_number) === partNumber ||
    normalizePartNumber(entity.original_part_number) === partNumber
  );
}

/**
 * Serials already installed as hierarchy entities for this inventory's part number.
 * These are units that left inventory after being used.
 */
export function getUsedEntitySerials(
  item: Inventory,
  entities: PartNumberEntity[]
): string[] {
  const part = normalizePartNumber(inventoryPartNumber(item));
  if (!part) return [];
  return entities
    .filter((entity) => entity.is_current_install !== false)
    .filter((entity) => entityMatchesPart(entity, part))
    .map(entitySerial)
    .filter(Boolean);
}

/**
 * Count of serials removed from inventory after install into any entity
 * (matched by part number on the frontend).
 */
export function calculateInventoryTotalUsed(
  item: Inventory,
  entities: PartNumberEntity[]
): number {
  return getUsedEntitySerials(item, entities).length;
}

/**
 * Next serial for a new unit: one greater than the highest existing serial
 * among remaining inventory instances and already-used entity serials.
 * Occupied identities (serial_number and original_serial_number) are skipped
 * so a copied original cannot cause a 409 on the unique serial column.
 */
export function suggestNextInventorySerial(
  item: Inventory,
  entities: PartNumberEntity[] = []
): string {
  const occupied = occupiedInventorySerials(item, entities);
  const candidates = [
    ...instanceIdentityValues(item),
    ...getUsedEntitySerials(item, entities),
  ];

  let bestSerial = '';
  let bestSequence = -1;
  for (const serial of candidates) {
    const parsed = extractTrailingSerialSequence(serial);
    if (!parsed) continue;
    if (parsed.sequence > bestSequence) {
      bestSequence = parsed.sequence;
      bestSerial = serial;
    }
  }

  if (!bestSerial) {
    const fallback =
      item.serial_number?.trim() || item.original_serial_number?.trim() || '';
    if (fallback) return nextUnusedSerial(incrementSerialNumber(fallback), occupied);
    return '';
  }

  return nextUnusedSerial(incrementSerialNumber(bestSerial), occupied);
}

/** Sequential unique identities for restocking `count` units. */
export function allocateInventorySerials(
  item: Inventory,
  count: number,
  entities: PartNumberEntity[] = []
): string[] {
  const quantity = Math.max(0, Math.floor(count));
  if (quantity === 0) return [];

  const occupied = occupiedInventorySerials(item, entities);
  const serials: string[] = [];
  let next = suggestNextInventorySerial(item, entities);
  for (let index = 0; index < quantity; index += 1) {
    if (!next) break;
    const serial = nextUnusedSerial(next, occupied);
    if (!serial) break;
    serials.push(serial);
    occupied.add(serial.toLowerCase());
    next = incrementSerialNumber(serial);
  }
  return serials;
}

export function inventoryEntitiesForType(
  inventoryType: string,
  pools: {
    systems: PartNumberEntity[];
    subsystems: PartNumberEntity[];
    modules: PartNumberEntity[];
    units: PartNumberEntity[];
    components: PartNumberEntity[];
  }
): PartNumberEntity[] {
  const type = inventoryType as HierarchyEntityType;
  switch (type) {
    case 'system':
      return pools.systems;
    case 'subsystem':
      return pools.subsystems;
    case 'module':
      return pools.modules;
    case 'unit':
      return pools.units;
    case 'component':
      return pools.components;
    default:
      return [];
  }
}

export function canSuggestInventorySerial(item: Inventory): boolean {
  return inventoryUsesInstances(item.inventory_type as HierarchyEntityType);
}

import * as api from '@/lib/api';
import {
  canAddInventoryChildren,
  resolveInventoryInstanceSerial,
} from '@/lib/inventory-child-install';
import { inventoryPartNumber } from '@/lib/inventory-entity-fields';
import {
  inventoryUsesInstances,
  type HierarchyEntityType,
} from '@/lib/entity-hierarchy';
import type { Inventory, InventoryInstance } from '@/lib/models';

export interface DuplicateInventoryResult {
  inventoryId: number;
  instanceId?: number;
  serial?: string;
}

export interface DuplicateInventoryOverrides {
  serialNumber: string;
  holderUserId: number;
  location: string;
  locationRoom?: string;
  locationCabinet?: string;
  locationRack?: string;
}

function resolveInstance(
  item: Inventory,
  instanceId?: number | null,
  instanceSerial?: string | null
): InventoryInstance | null {
  const instances = item.instances ?? [];
  if (instanceId != null) {
    return instances.find((entry) => entry.id === instanceId) ?? null;
  }
  const normalized = instanceSerial?.trim().toLowerCase();
  if (normalized) {
    return (
      instances.find((entry) => {
        const serial =
          entry.original_serial_number?.trim().toLowerCase() ||
          entry.serial_number?.trim().toLowerCase();
        return serial === normalized;
      }) ?? null
    );
  }
  if (instances.length === 1) return instances[0];
  return null;
}

export function suggestCopySerial(serial?: string | null): string {
  const base = serial?.trim() || 'UNIT';
  const suffix = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`
    .toUpperCase()
    .slice(-8);
  return `${base}-COPY-${suffix}`;
}

function instanceCreatePayload(
  source: Inventory,
  instance: InventoryInstance | null,
  newSerial: string,
  overrides?: DuplicateInventoryOverrides
) {
  const location =
    overrides?.location.trim() ||
    instance?.location?.trim() ||
    source.location?.trim() ||
    'Warehouse';
  return {
    serial_number: newSerial,
    original_serial_number: newSerial,
    configuration_item:
      instance?.configuration_item || source.configuration_item || undefined,
    status_id: instance?.status_id ?? source.status_id,
    holder_user_id: overrides?.holderUserId ?? instance?.holder_user_id ?? source.holder_user_id,
    location,
    location_room:
      overrides?.locationRoom?.trim() ||
      instance?.location_room ||
      source.location_room ||
      undefined,
    location_cabinet:
      overrides?.locationCabinet?.trim() ||
      instance?.location_cabinet ||
      source.location_cabinet ||
      undefined,
    location_rack:
      overrides?.locationRack?.trim() ||
      instance?.location_rack ||
      source.location_rack ||
      undefined,
    shelf_life_expires_at:
      instance?.shelf_life_expires_at ?? source.shelf_life_expires_at,
    original_part_number:
      instance?.original_part_number || source.original_part_number || undefined,
  };
}

async function createClonedUnit(
  source: Inventory,
  options: {
    instanceId?: number | null;
    instanceSerial?: string | null;
    overrides?: DuplicateInventoryOverrides;
  }
): Promise<DuplicateInventoryResult> {
  const sourceSerial =
    options.instanceSerial?.trim() ||
    resolveInventoryInstanceSerial(source, options.instanceId ?? null);
  const newSerial =
    options.overrides?.serialNumber.trim() || suggestCopySerial(sourceSerial);
  const usesInstances = inventoryUsesInstances(
    source.inventory_type as HierarchyEntityType
  );

  if (!usesInstances) {
    const created = await api.inventory.create({
      name: source.name,
      inventory_type: source.inventory_type,
      description: source.description,
      oem_name: source.oem_name,
      part_number: inventoryPartNumber(source) || source.part_number,
      configuration_item: source.configuration_item,
      status_id: source.status_id,
      sku: source.sku,
      quantity: Math.max(1, source.quantity || 1),
      serial_number: newSerial,
      holder_user_id:
        options.overrides?.holderUserId ?? source.holder_user_id,
      location:
        options.overrides?.location.trim() ||
        source.location?.trim() ||
        'Warehouse',
      location_room: options.overrides?.locationRoom || source.location_room || undefined,
      location_cabinet:
        options.overrides?.locationCabinet || source.location_cabinet || undefined,
      location_rack: options.overrides?.locationRack || source.location_rack || undefined,
      original_part_number: source.original_part_number,
      original_serial_number: newSerial,
    });
    return {
      inventoryId: created.data.id,
      serial: newSerial,
    };
  }

  const instance = resolveInstance(source, options.instanceId, sourceSerial);
  const createdInstance = await api.inventory.createInstance(
    source.id,
    instanceCreatePayload(source, instance, newSerial, options.overrides)
  );

  return {
    inventoryId: source.id,
    instanceId: createdInstance.data.id,
    serial: newSerial,
  };
}

/**
 * Deep-clone an inventory unit (optional serial/instance) including composed
 * children. Root unit uses provided serial/holder/location when given; child
 * nodes get auto-generated serials. Children are re-linked under the clone.
 */
export async function duplicateInventoryEntity(
  item: Inventory,
  options?: {
    instanceId?: number | null;
    instanceSerial?: string | null;
    overrides?: DuplicateInventoryOverrides;
  }
): Promise<DuplicateInventoryResult> {
  const freshRes = await api.inventory.get(item.id);
  const source = freshRes.data ?? item;
  const instanceId = options?.instanceId;
  const instanceSerial =
    options?.instanceSerial?.trim() ||
    resolveInventoryInstanceSerial(source, instanceId ?? null);

  const childLinks = canAddInventoryChildren(source.inventory_type)
    ? (
        await api.inventory.getChildren(source.id, {
          parentInstanceId: instanceId ?? undefined,
          parentInstanceSerial: instanceSerial,
        })
      ).data ?? []
    : [];

  const duplicatedChildren: Array<{
    child_category_name: string;
    child_inventory_id: number;
    child_instance_id?: number;
    child_instance_serial?: string;
  }> = [];

  for (const link of childLinks) {
    const childRes = await api.inventory.get(link.child_inventory_id);
    const childStock = childRes.data;
    if (!childStock) continue;

    // Children keep auto-generated serials; only the root uses form overrides.
    const duplicatedChild = await duplicateInventoryEntity(childStock, {
      instanceId: link.child_instance_id ?? undefined,
      instanceSerial: link.child_instance_serial,
    });

    duplicatedChildren.push({
      child_category_name: link.child_category_name,
      child_inventory_id: duplicatedChild.inventoryId,
      child_instance_id: duplicatedChild.instanceId,
      child_instance_serial: duplicatedChild.serial,
    });
  }

  const clone = await createClonedUnit(source, {
    instanceId,
    instanceSerial,
    overrides: options?.overrides,
  });

  if (duplicatedChildren.length > 0) {
    await api.inventory.replaceChildren(clone.inventoryId, {
      parent_instance_id: clone.instanceId,
      parent_instance_serial: clone.serial,
      children: duplicatedChildren,
    });
  }

  return clone;
}

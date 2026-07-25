import * as api from '@/lib/api';
import {
  inventoryUsesInstances,
  nextSerialNumberFromInventory,
  serialNumberFromInventory,
  type HierarchyEntityType,
} from '@/lib/entity-hierarchy';
import { inventoryToHierarchyCreatePayload } from '@/lib/hierarchy-install-fields';
import { mergeInventoryWithInstance } from '@/lib/inventory-entity-fields';
import type { Inventory, InventoryInstance, Status } from '@/lib/models';

export function isValidEntityId(id: unknown): id is number {
  return typeof id === 'number' && Number.isFinite(id) && id > 0;
}

export function parseEntityId(value: unknown, label: string): number {
  const id = typeof value === 'number' ? value : Number(value);
  if (!isValidEntityId(id)) {
    throw new Error(`Select a valid ${label}`);
  }
  return id;
}

export interface InventoryAssetSource {
  ownerType: 'inventory' | 'inventory_instance';
  ownerId: number;
}

export function needsSerialSelection(item: Inventory): boolean {
  const usesInstances = inventoryUsesInstances(item.inventory_type as HierarchyEntityType);
  if (!usesInstances) return false;
  // Prefer live instance rows over catalog quantity (multi-unit groups must open serial pickers).
  const selectableCount = getSelectableInstances(item).length;
  if (selectableCount > 0) return selectableCount > 1;
  return Number(item.quantity) > 1;
}

export function getSelectableInstances(item: Inventory): InventoryInstance[] {
  return (item.instances ?? []).filter((instance) => instance.id);
}

export function getAvailableInstances(item: Inventory): InventoryInstance[] {
  return (item.instances ?? []).filter((instance) => instance.id && !instance.is_reserved);
}

export function getSelectableInstancesIncludingReserved(
  item: Inventory,
  options?: { allowIssuanceIds?: number[] }
): InventoryInstance[] {
  const allow = new Set(options?.allowIssuanceIds ?? []);
  return (item.instances ?? []).filter((instance) => {
    if (!instance.id) return false;
    if (!instance.is_reserved) return true;
    return instance.open_issuance_id != null && allow.has(instance.open_issuance_id);
  });
}

export function buildInventoryAssetSources(
  inventoryItem: Inventory,
  consumedInstance?: InventoryInstance | null
): InventoryAssetSource[] {
  const sources: InventoryAssetSource[] = [{ ownerType: 'inventory', ownerId: inventoryItem.id }];
  if (consumedInstance?.id) {
    sources.push({ ownerType: 'inventory_instance', ownerId: consumedInstance.id });
  }
  return sources;
}

export async function copyInventoryAssetsToEntity(
  entityType: HierarchyEntityType,
  entityId: number,
  sources: InventoryAssetSource[]
) {
  const uniqueSources = sources.filter(
    (source, index, all) =>
      all.findIndex(
        (entry) => entry.ownerType === source.ownerType && entry.ownerId === source.ownerId
      ) === index
  );

  for (const source of uniqueSources) {
    await api.attachments.copy(
      source.ownerType,
      source.ownerId,
      entityType,
      entityId
    );

    try {
      await api.pictures.copy(source.ownerType, source.ownerId, entityType, entityId);
    } catch {
      // Source may not have a picture — ignore.
    }
  }
}

export async function installEntityFromInventory({
  inventoryItem,
  instanceId,
  issuanceId,
  entityType,
  parentEntityId,
  parentField,
  existingChildren,
  defaultStatus,
  createEntity,
  /** When true, child stock was already removed at compose time — create entity only. */
  skipConsume = false,
  composedSerialNumber,
}: {
  inventoryItem: Inventory;
  instanceId?: number;
  issuanceId?: number | null;
  entityType: HierarchyEntityType;
  parentEntityId: number;
  parentField: string;
  existingChildren: { name: string; serial_number?: string }[];
  defaultStatus: Status;
  createEntity: (data: Record<string, unknown>) => Promise<{ id: number }>;
  skipConsume?: boolean;
  composedSerialNumber?: string | null;
}): Promise<{ entityId: number; updatedInventory: Inventory }> {
  if (!isValidEntityId(parentEntityId)) {
    throw new Error(`Invalid parent entity for ${entityType} install`);
  }

  let consumedInstance: InventoryInstance | null = null;
  let updatedInventory = inventoryItem;
  let linkedIssuanceId: number | null = issuanceId ?? null;

  if (!skipConsume) {
    // Prefer open issuance on the selected instance when not explicitly provided
    if (linkedIssuanceId == null && instanceId != null) {
      const inst = (inventoryItem.instances ?? []).find((i) => i.id === instanceId);
      if (inst?.open_issuance_id) linkedIssuanceId = inst.open_issuance_id;
    }
    const consumeRes = await api.inventory.consume(inventoryItem.id, instanceId, {
      issuanceId: linkedIssuanceId,
    });
    consumedInstance = consumeRes.data?.consumed_instance ?? null;
    updatedInventory = consumeRes.data?.inventory ?? inventoryItem;
    if (consumeRes.data?.issuance?.id) {
      linkedIssuanceId = consumeRes.data.issuance.id;
    }
  }

  const merged = mergeInventoryWithInstance(
    { ...inventoryItem, ...updatedInventory },
    consumedInstance
  );

  const composedSerial = composedSerialNumber?.trim();
  if (composedSerial) {
    merged.serial_number = composedSerial;
    merged.original_serial_number = merged.original_serial_number || composedSerial;
  }

  const serialNumber = serialNumberFromInventory(
    merged,
    consumedInstance,
    existingChildren.filter((child) => child.name.toLowerCase() === merged.name.toLowerCase()).length + 1
  );

  const created = await createEntity({
    name: merged.name,
    description: merged.description || '',
    status_id: defaultStatus.id,
    ...inventoryToHierarchyCreatePayload(merged, serialNumber || nextSerialNumberFromInventory(merged, existingChildren)),
    [parentField]: parentEntityId,
  });

  if (linkedIssuanceId) {
    try {
      await api.inventory.linkIssuanceInstall(linkedIssuanceId, entityType, created.id);
    } catch {
      // Install already succeeded; linking is best-effort for the ledger.
    }
  }

  await copyInventoryAssetsToEntity(
    entityType,
    created.id,
    buildInventoryAssetSources(inventoryItem, consumedInstance)
  );

  return { entityId: created.id, updatedInventory };
}

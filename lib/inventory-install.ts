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
  if (item.quantity <= 1) return false;
  const selectableCount = (item.instances ?? []).filter((instance) => Boolean(instance?.id)).length;
  return selectableCount > 1;
}

export function getSelectableInstances(item: Inventory): InventoryInstance[] {
  return (item.instances ?? []).filter((instance) => instance.id);
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
  entityType,
  parentEntityId,
  parentField,
  existingChildren,
  defaultStatus,
  createEntity,
}: {
  inventoryItem: Inventory;
  instanceId?: number;
  entityType: HierarchyEntityType;
  parentEntityId: number;
  parentField: string;
  existingChildren: { name: string; serial_number?: string }[];
  defaultStatus: Status;
  createEntity: (data: Record<string, unknown>) => Promise<{ id: number }>;
}): Promise<{ entityId: number; updatedInventory: Inventory }> {
  if (!isValidEntityId(parentEntityId)) {
    throw new Error(`Invalid parent entity for ${entityType} install`);
  }

  const consumeRes = await api.inventory.consume(inventoryItem.id, instanceId);
  const consumedInstance = consumeRes.data?.consumed_instance ?? null;
  const updatedInventory = consumeRes.data?.inventory ?? inventoryItem;
  const merged = mergeInventoryWithInstance(
    { ...inventoryItem, ...updatedInventory },
    consumedInstance
  );

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

  await copyInventoryAssetsToEntity(
    entityType,
    created.id,
    buildInventoryAssetSources(inventoryItem, consumedInstance)
  );

  return { entityId: created.id, updatedInventory };
}

import * as api from '@/lib/api';
import { inventoryUsesInstances } from '@/lib/entity-hierarchy';
import type { HierarchyEntityType } from '@/lib/entity-hierarchy';
import { createHierarchyEntityFromForm } from '@/lib/hierarchy-create-form';
import type { CreateEntityByTypeFn } from '@/lib/inventory-child-install';
import type { PendingAttachmentUpload } from '@/components/entity-attachments-section';
import type { Inventory } from '@/lib/models';

function getLatestInstanceId(item: Inventory): number | undefined {
  const instances = item.instances ?? [];
  return instances[instances.length - 1]?.id;
}

async function syncInventoryMedia(
  ownerType: 'inventory' | 'inventory_instance',
  ownerId: number,
  options: {
    removePicture: boolean;
    pendingPictureFile?: File | null;
    pendingAttachments?: PendingAttachmentUpload[];
  }
) {
  if (options.removePicture) {
    await api.pictures.remove(ownerType, ownerId);
  } else if (options.pendingPictureFile) {
    await api.pictures.upload(ownerType, ownerId, options.pendingPictureFile);
  }
  if (options.pendingAttachments?.length) {
    for (const attachment of options.pendingAttachments) {
      await api.attachments.upload(ownerType, ownerId, attachment.file, {
        attachment_type: attachment.attachment_type,
        description: attachment.description,
      });
    }
  }
}

export async function createHierarchyEntityWithInventoryForm(options: {
  entityType: HierarchyEntityType;
  parentId: number;
  buildInventoryPayload: () => Record<string, unknown>;
  selectedEntityType: HierarchyEntityType;
  createEntityByType: CreateEntityByTypeFn;
  updateEntityByType?: CreateEntityByTypeFn;
  existingEntityId?: number;
  extraPayload?: Record<string, unknown>;
  removePicture?: boolean;
  pendingPictureFile?: File | null;
  pendingAttachments?: PendingAttachmentUpload[];
  formData: {
    name: string;
    description: string;
    part_number: string;
    status_id: string;
    sku: string;
    installed_by_id: string;
    installation_date: string;
  };
}) {
  const usesInstances = inventoryUsesInstances(options.selectedEntityType);
  const createdRes = await api.inventory.create(options.buildInventoryPayload());
  const createdInventory = createdRes.data;
  if (!createdInventory?.id) {
    throw new Error('Failed to create inventory item');
  }

  const mediaOwnerType = usesInstances ? 'inventory_instance' : 'inventory';
  const mediaOwnerId = usesInstances
    ? getLatestInstanceId(createdInventory)
    : createdInventory.id;
  if (mediaOwnerId) {
    await syncInventoryMedia(mediaOwnerType, mediaOwnerId, {
      removePicture: options.removePicture ?? false,
      pendingPictureFile: options.pendingPictureFile,
      pendingAttachments: options.pendingAttachments,
    });
  }

  const inventoryDetail = await api.inventory.get(createdInventory.id);
  const inventoryItem = inventoryDetail.data;
  const instanceId = usesInstances ? getLatestInstanceId(inventoryItem) : undefined;

  const hierarchyFormData: Record<string, unknown> = {
    name: options.formData.name,
    description: options.formData.description,
    partnumber: options.formData.part_number,
    status_id: options.formData.status_id,
    sku: options.formData.sku,
    installed_by_id: options.formData.installed_by_id,
    installation_date: options.formData.installation_date,
    ...(instanceId != null ? { inventory_instance_id: String(instanceId) } : {}),
  };

  const mergedExtraPayload = {
    ...options.extraPayload,
    ...(options.entityType === 'component'
      ? { sku: options.formData.sku || '' }
      : {}),
  };

  return createHierarchyEntityFromForm({
    entityType: options.entityType,
    parentId: options.parentId,
    formData: hierarchyFormData,
    inventoryItems: [inventoryItem],
    createEntity: (data) => {
      if (options.existingEntityId != null) {
        const updater = options.updateEntityByType ?? options.createEntityByType;
        return updater(options.entityType, {
          ...data,
          id: options.existingEntityId,
        }).then(() => ({ id: options.existingEntityId! }));
      }
      return options.createEntityByType(options.entityType, data);
    },
    createEntityByType: options.createEntityByType,
    extraPayload: mergedExtraPayload,
  });
}

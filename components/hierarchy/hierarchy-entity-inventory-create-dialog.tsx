'use client';

import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  InventoryEntityFormTabs,
  hierarchyEntityDialogClassName,
} from '@/components/inventory/inventory-entity-form-tabs';
import { useInventoryEntityForm } from '@/hooks/use-inventory-entity-form';
import type { HierarchyEntityType } from '@/lib/entity-hierarchy';
import {
  buildCreateEntityByType,
  buildUpdateEntityByType,
} from '@/lib/inventory-child-install';
import { createHierarchyEntityWithInventoryForm } from '@/lib/hierarchy-inventory-create';
import { hierarchyEntityToFormData } from '@/lib/inventory-entity-fields';
import { useDataStore } from '@/lib/data-store';
import { useAppDefinitions } from '@/lib/app-definitions-context';
import type { Inventory } from '@/lib/models';
import * as api from '@/lib/api';

export interface HierarchyEntityInventoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entityType: HierarchyEntityType;
  parentId: number;
  /** When set, inventory is installed into this existing hierarchy shell. */
  entityId?: number;
  entity?: {
    name: string;
    description?: string | null;
    part_number?: string | null;
    serial_number?: string | null;
    status_id?: number | null;
    oem_name?: string | null;
    original_part_number?: string | null;
    original_serial_number?: string | null;
    installation_date?: string | null;
    installed_by_id?: number | null;
    picture_url?: string | null;
  };
  title: string;
  description?: string;
  onSaved?: (entityId: number) => void | Promise<void>;
  extraPayload?: Record<string, unknown>;
}

type LinkedInventoryExtras = {
  original_part_number?: string;
  original_serial_number?: string;
  serial_number?: string;
  warranty_expires_at?: string | null;
  inventoryId?: number;
  instanceId?: number;
};

function pickLinkedInventoryExtras(items: Inventory[]): LinkedInventoryExtras {
  if (!items.length) return {};

  const withWarranty =
    items.find((item) => item.warranty_expires_at) ||
    items.find((item) =>
      (item.instances ?? []).some((instance) => instance.warranty_expires_at)
    ) ||
    items[0];

  const instanceWithWarranty = (withWarranty.instances ?? []).find(
    (instance) => instance.warranty_expires_at
  );
  const firstInstance = withWarranty.instances?.[0];
  const warrantySource = instanceWithWarranty || firstInstance || withWarranty;

  return {
    original_part_number:
      withWarranty.original_part_number?.trim() ||
      firstInstance?.original_part_number?.trim() ||
      undefined,
    original_serial_number:
      withWarranty.original_serial_number?.trim() ||
      firstInstance?.original_serial_number?.trim() ||
      undefined,
    serial_number:
      withWarranty.serial_number?.trim() ||
      firstInstance?.serial_number?.trim() ||
      undefined,
    warranty_expires_at: warrantySource.warranty_expires_at ?? null,
    inventoryId: withWarranty.id,
    instanceId: instanceWithWarranty?.id ?? firstInstance?.id,
  };
}

export function HierarchyEntityInventoryDialog({
  open,
  onOpenChange,
  entityType,
  parentId,
  entityId,
  entity,
  title,
  description,
  onSaved,
  extraPayload,
}: HierarchyEntityInventoryDialogProps) {
  const { entityLabel } = useAppDefinitions();
  const {
    users,
    createSystem,
    createSubsystem,
    createModule,
    createUnit,
    createComponent,
    updateSystem,
    updateSubsystem,
    updateModule,
    updateUnit,
    updateComponent,
    runSilentEntityBatch,
  } = useDataStore();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [linkedExtras, setLinkedExtras] = useState<LinkedInventoryExtras>({});

  useEffect(() => {
    if (!open || !entityId) {
      setLinkedExtras({});
      return;
    }

    let cancelled = false;
    void api.inventory
      .listByEntity(entityId)
      .then((res) => {
        if (cancelled) return;
        setLinkedExtras(pickLinkedInventoryExtras(res.data ?? []));
      })
      .catch(() => {
        if (!cancelled) setLinkedExtras({});
      });

    return () => {
      cancelled = true;
    };
  }, [open, entityId]);

  const initialFormData = useMemo(() => {
    if (!open || !entity) return undefined;
    const base = hierarchyEntityToFormData(entity, entityType);
    return {
      ...base,
      original_part_number:
        base.original_part_number || linkedExtras.original_part_number || '',
      original_serial_number:
        base.original_serial_number || linkedExtras.original_serial_number || '',
      serial_number: base.serial_number || linkedExtras.serial_number || '',
      warranty_provided: Boolean(
        base.warranty_expires_at || linkedExtras.warranty_expires_at
      ),
      warranty_expires_at: base.warranty_expires_at
        ? base.warranty_expires_at
        : linkedExtras.warranty_expires_at
          ? linkedExtras.warranty_expires_at.slice(0, 10)
          : '',
    };
  }, [open, entity, entityType, linkedExtras]);

  const form = useInventoryEntityForm({
    entityType,
    allowTypeChange: false,
    open,
    context: 'hierarchy',
    initialFormData,
    lockEntityName: Boolean(entityId && entity?.name),
  });

  async function syncLinkedInventoryWarranty() {
    if (!linkedExtras.inventoryId) return;

    const warrantyExpiresAt =
      form.formData.warranty_provided && form.formData.warranty_expires_at
        ? new Date(form.formData.warranty_expires_at).toISOString()
        : null;

    await api.inventory.update(linkedExtras.inventoryId, {
      warranty_expires_at: warrantyExpiresAt,
      original_part_number: form.formData.original_part_number.trim() || undefined,
      oem_name: form.formData.oem_name.trim() || undefined,
    });

    if (linkedExtras.instanceId) {
      await api.inventory.updateInstance(linkedExtras.instanceId, {
        warranty_expires_at: warrantyExpiresAt,
        original_part_number: form.formData.original_part_number.trim() || undefined,
        original_serial_number:
          form.formData.serial_number.trim() ||
          form.formData.original_serial_number.trim() ||
          undefined,
        serial_number: form.formData.serial_number.trim() || undefined,
      });
    }
  }

  async function updateExistingEntity() {
    if (entityId == null) return entityId;

    const updateEntityByType = buildUpdateEntityByType({
      updateSystem,
      updateSubsystem,
      updateModule,
      updateUnit,
      updateComponent,
    });

    const serialNumber = form.formData.serial_number.trim();
    const oemPartNumber = form.formData.original_part_number.trim();
    const partNumber = form.formData.part_number.trim() || oemPartNumber;

    await updateEntityByType(entityType, {
      id: entityId,
      description: form.formData.description,
      oem_name: form.formData.oem_name.trim() || null,
      part_number: partNumber || null,
      configuration_item:
        form.formData.configuration_item.trim() || partNumber || null,
      original_part_number: oemPartNumber || null,
      serial_number: serialNumber || null,
      original_serial_number: serialNumber || form.formData.original_serial_number.trim() || null,
      installation_date: form.formData.installation_date
        ? new Date(form.formData.installation_date).toISOString()
        : null,
      installed_by_id: form.formData.installed_by_id
        ? Number(form.formData.installed_by_id)
        : null,
      ...extraPayload,
    });

    try {
      await syncLinkedInventoryWarranty();
    } catch (error) {
      console.warn('Failed to sync linked inventory warranty/OEM refs:', error);
    }

    return entityId;
  }

  async function handleSubmit() {
    const validationError = form.validateCreate();
    if (validationError) {
      toast.error(validationError);
      return;
    }

    setIsSubmitting(true);
    try {
      let targetId: number;

      if (entityId != null) {
        targetId = await runSilentEntityBatch(async () => updateExistingEntity());
      } else {
        const createEntityByType = buildCreateEntityByType(
          {
            createSystem,
            createSubsystem,
            createModule,
            createUnit,
            createComponent,
          },
          { silent: true }
        );
        const updateEntityByType = buildUpdateEntityByType({
          updateSystem,
          updateSubsystem,
          updateModule,
          updateUnit,
          updateComponent,
        });

        const saved = await runSilentEntityBatch(async () =>
          createHierarchyEntityWithInventoryForm({
            entityType,
            parentId,
            selectedEntityType: form.selectedEntityType,
            buildInventoryPayload: form.buildInventoryPayload,
            createEntityByType,
            updateEntityByType,
            extraPayload,
            removePicture: form.removePicture,
            pendingPictureFile: form.pendingPictureFile,
            pendingPictureFiles: form.pendingPictureFiles,
            pendingAttachments: form.pendingAttachments,
            formData: form.formData,
          })
        );
        targetId = saved.id;
      }

      const pictureFiles =
        form.pendingPictureFiles.length > 0
          ? form.pendingPictureFiles
          : form.pendingPictureFile
            ? [form.pendingPictureFile]
            : [];
      if (form.removePicture) {
        await api.pictures.remove(entityType, targetId);
      } else if (pictureFiles.length > 0) {
        await api.pictures.upload(entityType, targetId, pictureFiles[0]);
        for (const file of pictureFiles.slice(1)) {
          await api.attachments.upload(entityType, targetId, file, {
            attachment_type: 'photo',
            description: file.name,
          });
        }
      }

      toast.success(
        entityId
          ? `${entityLabel(entityType)} updated successfully`
          : `${entityLabel(entityType)} added successfully`
      );
      onOpenChange(false);
      form.resetForm();
      await onSaved?.(targetId);
    } catch (error) {
      console.error('Hierarchy entity save error:', error);
      let message = entityId
        ? `Failed to update ${entityType}`
        : `Failed to add ${entityType}`;
      if (axios.isAxiosError(error)) {
        const detail = error.response?.data?.detail;
        if (typeof detail === 'string') message = detail;
        else if (Array.isArray(detail)) {
          message = detail.map((item) => item.msg || JSON.stringify(item)).join(', ');
        }
      } else if (error instanceof Error) {
        message = error.message;
      }
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={hierarchyEntityDialogClassName}>
        <DialogHeader className="space-y-1 border-b px-5 py-4 text-left">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {description ??
              `Register an existing ${entityLabel(entityType).toLowerCase()} for monitoring and maintenance`}
          </DialogDescription>
        </DialogHeader>
        <div>
          <InventoryEntityFormTabs
            mode="create"
            context="hierarchy"
            lockEntityName={form.lockEntityName}
            formTab={form.formTab}
            onFormTabChange={form.setFormTab}
            selectedEntityType={form.selectedEntityType}
            allowTypeChange={false}
            formData={form.formData}
            onFormDataChange={(next) => form.setFormData(next)}
            entityListNames={form.entityListNames}
            entityLabel={form.entityLabel}
            inventoryHolderLabel={form.inventoryHolderLabel}
            pendingAttachments={form.pendingAttachments}
            onPendingAttachmentsChange={form.setPendingAttachments}
            pendingPictureFile={form.pendingPictureFile}
            onPendingPictureFileChange={form.setPendingPictureFile}
            pendingPictureFiles={form.pendingPictureFiles}
            onPendingPictureFilesChange={form.setPendingPictureFiles}
            removePicture={form.removePicture}
            onRemovePictureChange={form.setRemovePicture}
            onApplyDefinitionIdentifiers={form.applyDefinitionIdentifiers}
            users={users}
            entityId={entityId}
          />

          <div className="flex justify-end gap-3 border-t px-5 py-3">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button onClick={() => void handleSubmit()} disabled={isSubmitting}>
              {isSubmitting ? 'Saving…' : entityId ? 'Save' : 'Add'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** @deprecated Use HierarchyEntityInventoryDialog */
export const HierarchyEntityInventoryCreateDialog = HierarchyEntityInventoryDialog;

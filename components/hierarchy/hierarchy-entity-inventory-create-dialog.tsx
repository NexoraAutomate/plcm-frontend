'use client';

import { useMemo, useState } from 'react';
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
  inventoryEntityDialogClassName,
} from '@/components/inventory/inventory-entity-form-tabs';
import { useInventoryEntityForm } from '@/hooks/use-inventory-entity-form';
import type { HierarchyEntityType } from '@/lib/entity-hierarchy';
import {
  buildCreateEntityByType,
  buildUpdateEntityByType,
} from '@/lib/inventory-child-install';
import { createHierarchyEntityWithInventoryForm } from '@/lib/hierarchy-inventory-create';
import { hierarchyEntityToFormData } from '@/lib/inventory-entity-fields';
import { syncEntityPicture } from '@/lib/entity-picture-upload';
import { useDataStore } from '@/lib/data-store';
import { useAppDefinitions } from '@/lib/app-definitions-context';

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
  };
  title: string;
  description?: string;
  onSaved?: (entityId: number) => void | Promise<void>;
  extraPayload?: Record<string, unknown>;
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

  const initialFormData = useMemo(
    () => (entity ? hierarchyEntityToFormData(entity, entityType) : undefined),
    [entity, entityType]
  );

  const form = useInventoryEntityForm({
    entityType,
    allowTypeChange: false,
    open,
    context: 'hierarchy',
    initialFormData,
    lockEntityName: Boolean(entityId && entity?.name),
  });

  async function handleSubmit() {
    const validationError = form.validateCreate();
    if (validationError) {
      toast.error(validationError);
      return;
    }

    setIsSubmitting(true);
    try {
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
          existingEntityId: entityId,
          extraPayload,
          removePicture: form.removePicture,
          pendingPictureFile: form.pendingPictureFile,
          pendingAttachments: form.pendingAttachments,
          formData: form.formData,
        })
      );

      const targetId = entityId ?? saved.id;
      if (entityType === 'system') {
        await syncEntityPicture('system', targetId, form.formData);
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
      <DialogContent className={inventoryEntityDialogClassName}>
        <DialogHeader className="space-y-1.5 border-b px-6 py-5 text-left">
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
            removePicture={form.removePicture}
            onRemovePictureChange={form.setRemovePicture}
            onApplyDefinitionIdentifiers={form.applyDefinitionIdentifiers}
          />

          <div className="flex justify-end gap-3 border-t px-6 py-4">
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

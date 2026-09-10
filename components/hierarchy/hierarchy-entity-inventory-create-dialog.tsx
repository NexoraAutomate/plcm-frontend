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
    installation_date?: string | null;
    installed_by_id?: number | null;
    picture_url?: string | null;
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

  const initialFormData = useMemo(() => {
    if (!open || !entity) return undefined;
    return hierarchyEntityToFormData(entity, entityType);
  }, [open, entity, entityType]);

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
          pendingPictureFiles: form.pendingPictureFiles,
          pendingAttachments: form.pendingAttachments,
          formData: form.formData,
        })
      );

      const targetId = entityId ?? saved.id;
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

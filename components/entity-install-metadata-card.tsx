'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Pencil, Upload, Trash2, Replace, Network } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { AttachmentUploadDialog } from '@/components/attachment-upload-dialog';
import { EntityForm } from '@/components/entity-form';
import { useDataStore } from '@/lib/data-store';
import { hierarchyInstallFormFields, parseHierarchyInstallPayload, hierarchyInstallInitialValues } from '@/lib/hierarchy-install-fields';
import { syncEntityPicture } from '@/lib/entity-picture-upload';
import { attachmentDisplayTitle, attachmentTypeLabel } from '@/lib/attachment-types';
import type { EntityAttachment, HierarchyInstallFields } from '@/lib/models';
import * as api from '@/lib/api';
import { formatUserRef } from '@/lib/user-display';
import { toast } from 'sonner';
import { EntityPicture } from '@/components/entity-picture';
import {
  ReplaceFromInventoryDialog,
  type ReplaceFromInventoryTarget,
} from '@/components/replace-from-inventory-dialog';
import type { HierarchyEntityType } from '@/lib/entity-hierarchy';
import { HARDWARE_ENTITY_DETAIL_PATH } from '@/lib/entity-replacement';
import { useAuth } from '@/lib/auth-context';
import { P } from '@/lib/permission-codes';
import { RevertToInventoryButton } from '@/components/revert-to-inventory-button';
import { canManageInstall, isOwnInstall } from '@/lib/install-ownership';
import { cn } from '@/lib/utils';
import { ProjectWorkflowStatus } from '@/lib/workflow-status';

type HardwareOwnerType = 'system' | 'subsystem' | 'module' | 'unit' | 'component';

const EDIT_PERMISSION_BY_OWNER_TYPE: Record<HardwareOwnerType, string> = {
  system: P.edit_systems,
  subsystem: P.edit_subsystems,
  module: P.edit_modules,
  unit: P.edit_units,
  component: P.edit_components,
};

function MetadataField({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium">{value?.trim() || '—'}</p>
    </div>
  );
}

interface EntityInstallMetadataCardProps {
  ownerType: HardwareOwnerType;
  entity: HierarchyInstallFields & {
    id: number;
    name: string;
    part_number?: string;
    serial_number?: string;
    configuration_item?: string;
    oem_name?: string;
    sku?: string;
    replacement_sequence?: number;
    is_current_install?: boolean;
  };
  onUpdate: (data: Partial<HierarchyInstallFields>) => Promise<void>;
  projectId?: number;
  allowReplace?: boolean;
  hierarchyHref?: string;
  onReverted?: () => void;
}

function normalizeInstallPayload(data: Record<string, unknown>) {
  return parseHierarchyInstallPayload(data);
}

export function EntityInstallMetadataCard({
  ownerType,
  entity,
  onUpdate,
  projectId,
  allowReplace = false,
  hierarchyHref,
  onReverted,
}: EntityInstallMetadataCardProps) {
  const { users, projects } = useDataStore();
  const { can, user, isInventoryManager } = useAuth();
  const inventoryManager = isInventoryManager();
  const cancelled =
    projectId != null &&
    projects.find((p) => p.id === projectId)?.status_name === ProjectWorkflowStatus.CANCELLED;
  const ownsInstall = canManageInstall({
    isInventoryManager: inventoryManager,
    currentUserId: user?.id,
    installedById: entity.installed_by_id,
  });
  const mine = isOwnInstall({
    currentUserId: user?.id,
    installedById: entity.installed_by_id,
  });
  const canEdit =
    can(EDIT_PERMISSION_BY_OWNER_TYPE[ownerType]) && ownsInstall && !cancelled;
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [replaceOpen, setReplaceOpen] = useState(false);
  const [attachments, setAttachments] = useState<EntityAttachment[]>([]);
  const [linkedOemName, setLinkedOemName] = useState<string | undefined>();
  const [uploadOpen, setUploadOpen] = useState(false);
  const [editingAttachment, setEditingAttachment] = useState<EntityAttachment | null>(null);

  const oemName = entity.oem_name?.trim() || linkedOemName;

  const installerLabel = useMemo(() => {
    if (!entity.installed_by_id) return undefined;
    const user = users.find((item) => item.id === entity.installed_by_id);
    return user ? formatUserRef(user) : `User #${entity.installed_by_id}`;
  }, [entity.installed_by_id, users]);

  const formFields = useMemo(
    () => hierarchyInstallFormFields({ users, ownerType, ownerId: entity.id }),
    [users, ownerType, entity.id]
  );

  const loadAttachments = useCallback(async () => {
    try {
      const res = await api.attachments.list(ownerType, entity.id);
      setAttachments(res.data ?? []);
    } catch {
      setAttachments([]);
    }
  }, [ownerType, entity.id]);

  useEffect(() => {
    void loadAttachments();
  }, [loadAttachments]);

  useEffect(() => {
    if (entity.oem_name?.trim()) {
      setLinkedOemName(undefined);
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        const res = await api.inventory.listByEntity(entity.id);
        const match = (res.data ?? []).find((item) => item.oem_name?.trim());
        if (!cancelled) {
          setLinkedOemName(match?.oem_name?.trim() || undefined);
        }
      } catch {
        if (!cancelled) {
          setLinkedOemName(undefined);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [entity.id, entity.oem_name]);

  const handleSave = async (data: Record<string, unknown>) => {
    try {
      const payload = normalizeInstallPayload(data);
      const pictureResult = await syncEntityPicture(ownerType, entity.id, data);
      if (pictureResult === null) {
        payload.picture_url = null;
      } else if (typeof pictureResult === 'string') {
        payload.picture_url = pictureResult;
      }
      await onUpdate(payload);
      toast.success('Installation metadata saved');
      setEditOpen(false);
    } catch {
      toast.error('Failed to save installation metadata');
    }
  };

  const handleRemovePicture = async () => {
    try {
      await api.pictures.remove(ownerType, entity.id);
      await onUpdate({ picture_url: null });
      toast.success('Photo removed');
    } catch {
      toast.error('Failed to remove photo');
    }
  };

  const handleUpload = async (payload: {
    attachment_type: string;
    description?: string;
    file?: File;
  }) => {
    if (!payload.file) return;

    try {
      await api.attachments.upload(ownerType, entity.id, payload.file, {
        attachment_type: payload.attachment_type,
        description: payload.description,
      });
      await loadAttachments();
      toast.success('Attachment uploaded');
    } catch {
      toast.error('Failed to upload attachment');
      throw new Error('upload failed');
    }
  };

  const handleUpdateAttachment = async (payload: {
    attachment_type: string;
    description?: string;
  }) => {
    if (!editingAttachment) return;

    try {
      await api.attachments.update(editingAttachment.id, {
        attachment_type: payload.attachment_type,
        description: payload.description,
      });
      await loadAttachments();
      toast.success('Attachment updated');
    } catch {
      toast.error('Failed to update attachment');
      throw new Error('update failed');
    }
  };

  const handleDeleteAttachment = async (attachmentId: number) => {
    try {
      await api.attachments.delete(attachmentId);
      setAttachments((prev) => prev.filter((item) => item.id !== attachmentId));
      toast.success('Attachment removed');
    } catch {
      toast.error('Failed to remove attachment');
    }
  };

  const replaceTarget = useMemo<ReplaceFromInventoryTarget | null>(() => {
    if (!allowReplace || !projectId || cancelled) return null;
    return {
      entityType: ownerType as HierarchyEntityType,
      entityId: entity.id,
      entityName: entity.name,
      partNumber: entity.part_number,
      serialNumber: entity.serial_number,
      replacementSequence: entity.replacement_sequence,
    };
  }, [allowReplace, projectId, ownerType, entity, cancelled]);

  return (
    <>
      <Card
        className={cn(
          'shadow-sm',
          !inventoryManager &&
            mine &&
            entity.is_current_install !== false &&
            'border-emerald-500/70 bg-emerald-50/40 ring-1 ring-emerald-500/25 dark:bg-emerald-950/25 dark:border-emerald-500/50'
        )}
      >
        <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3">
          <div>
            <CardTitle className="text-base">Installation & Media</CardTitle>
            <CardDescription>
              Install date, custodian, original identifiers, and attachments for {entity.name}
              {!inventoryManager && mine && entity.is_current_install !== false
                ? ' — installed by you'
                : ''}
            </CardDescription>
          </div>
          <div className="flex gap-2">
            {hierarchyHref ? (
              <Button type="button" variant="outline" size="sm" asChild>
                <Link href={hierarchyHref}>
                  <Network className="mr-2 h-4 w-4" />
                  Hierarchy
                </Link>
              </Button>
            ) : null}
            {allowReplace && projectId && canEdit ? (
              <Button type="button" variant="outline" size="sm" onClick={() => setReplaceOpen(true)}>
                <Replace className="mr-2 h-4 w-4" />
                Replace
              </Button>
            ) : null}
            {!cancelled && entity.part_number ? (
              <RevertToInventoryButton
                entityType={ownerType}
                entityId={entity.id}
                partNumber={entity.part_number}
                serialNumber={entity.serial_number}
                installedById={entity.installed_by_id}
                isCurrentInstall={entity.is_current_install !== false}
                onReverted={() => {
                  onReverted?.();
                  router.refresh();
                }}
              />
            ) : null}
            {canEdit ? (
              <Button type="button" variant="outline" size="sm" onClick={() => setEditOpen(true)}>
                <Pencil className="mr-2 h-4 w-4" />
                Edit
              </Button>
            ) : null}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <p className="text-sm font-medium">Hardware Identification</p>
            <div className="grid grid-cols-1 gap-3 text-sm md:grid-cols-2">
              <MetadataField label="Part Number" value={entity.part_number} />
              <MetadataField label="Serial Number" value={entity.serial_number} />
              <MetadataField label="Configuration Item" value={entity.configuration_item} />
              <MetadataField label="OEM Name" value={oemName} />
              {ownerType === 'component' || entity.sku?.trim() ? (
                <MetadataField label="SKU" value={entity.sku} />
              ) : null}
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-sm font-medium">Installation Details</p>
            <div className="grid grid-cols-1 gap-3 text-sm md:grid-cols-2">
              <MetadataField
                label="Installation Date"
                value={
                  entity.installation_date
                    ? new Date(entity.installation_date).toLocaleDateString()
                    : undefined
                }
              />
              <MetadataField label="Installed By" value={installerLabel} />
              <MetadataField label="Original Part #" value={entity.original_part_number} />
              <MetadataField label="Original Serial #" value={entity.original_serial_number} />
              {(entity.replacement_sequence ?? 0) > 0 ? (
                <div>
                  <p className="text-xs text-muted-foreground">Install Generation</p>
                  <p className="font-medium text-primary">
                    Current replacement #{entity.replacement_sequence}
                  </p>
                </div>
              ) : null}
            </div>
          </div>

          {entity.picture_url ? (
            <div>
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-xs text-muted-foreground">Primary Photo</p>
                {canEdit ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => void handleRemovePicture()}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Remove
                  </Button>
                ) : null}
              </div>
              <EntityPicture
                src={entity.picture_url}
                ownerType={ownerType}
                ownerId={entity.id}
                alt={`${entity.name} photo`}
                className="max-h-40 rounded-md border object-cover"
              />
            </div>
          ) : null}

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium">Attachments</p>
              {!cancelled ? (
              <Button type="button" variant="outline" size="sm" onClick={() => setUploadOpen(true)}>
                <Upload className="mr-2 h-4 w-4" />
                Upload
              </Button>
              ) : null}
            </div>
            {attachments.length === 0 ? (
              <p className="text-sm text-muted-foreground">No attachments yet.</p>
            ) : (
              <ul className="space-y-2">
                {attachments.map((attachment) => (
                  <li
                    key={attachment.id}
                    className="flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm"
                  >
                    <div className="min-w-0 flex-1">
                      <button
                        type="button"
                        className="truncate text-left font-medium text-primary hover:underline"
                        onClick={() =>
                          void api.attachments.download(attachment.id, attachment.file_name)
                        }
                      >
                        {attachmentDisplayTitle(attachment)}
                      </button>
                      <p className="truncate text-xs text-muted-foreground">
                        {attachmentTypeLabel(attachment.attachment_type)} · {attachment.file_name}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      {!cancelled ? (
                        <>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => setEditingAttachment(attachment)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => void handleDeleteAttachment(attachment.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                        </>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </CardContent>
      </Card>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Installation Metadata</DialogTitle>
            <DialogDescription>Update install details for {entity.name}</DialogDescription>
          </DialogHeader>
          <EntityForm
            fields={formFields}
            initialValues={{
              ...hierarchyInstallInitialValues(entity),
            }}
            onSubmit={handleSave}
            onCancel={() => setEditOpen(false)}
            submitLabel="Save"
          />
        </DialogContent>
      </Dialog>

      <AttachmentUploadDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        onSubmit={handleUpload}
      />

      <AttachmentUploadDialog
        open={editingAttachment !== null}
        onOpenChange={(open) => {
          if (!open) setEditingAttachment(null);
        }}
        title="Edit Attachment"
        description="Update the attachment type or descriptive name."
        requireFile={false}
        attachment={editingAttachment ?? undefined}
        onSubmit={handleUpdateAttachment}
      />

      {projectId ? (
        <ReplaceFromInventoryDialog
          open={replaceOpen}
          onOpenChange={setReplaceOpen}
          projectId={projectId}
          target={replaceTarget}
          onCompleted={(result) => {
            if (result.new_entity_id && result.new_entity_id !== entity.id) {
              router.replace(HARDWARE_ENTITY_DETAIL_PATH[ownerType](result.new_entity_id));
            }
          }}
        />
      ) : null}
    </>
  );
}

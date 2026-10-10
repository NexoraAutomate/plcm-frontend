'use client';

import { useCallback, useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AttachmentUploadDialog } from '@/components/attachment-upload-dialog';
import { FileDropZone, UploadedFileRow } from '@/components/ui/file-drop-zone';
import { attachmentDisplayTitle, attachmentTypeLabel } from '@/lib/attachment-types';
import type { EntityAttachment } from '@/lib/models';
import * as api from '@/lib/api';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth-context';
import { P } from '@/lib/permission-codes';

type AttachmentOwnerType =
  | 'system'
  | 'subsystem'
  | 'module'
  | 'unit'
  | 'component'
  | 'inventory'
  | 'inventory_instance';

export interface PendingAttachmentUpload {
  id: string;
  file: File;
  attachment_type: string;
  description?: string;
}

interface EntityAttachmentsSectionProps {
  ownerType: AttachmentOwnerType;
  ownerId?: number | null;
  /** Queued uploads for create flows before an owner id exists */
  pendingAttachments?: PendingAttachmentUpload[];
  onPendingAttachmentsChange?: (attachments: PendingAttachmentUpload[]) => void;
}

function pendingLabel(item: PendingAttachmentUpload): string {
  return item.description?.trim() || item.file.name;
}

function openLocalFile(file: File) {
  const url = URL.createObjectURL(file);
  window.open(url, '_blank', 'noopener,noreferrer');
  // Revoke after the tab has a chance to load the blob.
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export function EntityAttachmentsSection({
  ownerType,
  ownerId,
  pendingAttachments = [],
  onPendingAttachmentsChange,
}: EntityAttachmentsSectionProps) {
  const { can } = useAuth();
  const canUpload = can(P.upload_attachments);
  const canDelete = can(P.delete_attachments);
  const canDownload = can(P.download_attachments);
  const [attachments, setAttachments] = useState<EntityAttachment[]>([]);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [queueOpen, setQueueOpen] = useState(false);
  const [seedFile, setSeedFile] = useState<File | null>(null);
  const [editingAttachment, setEditingAttachment] = useState<EntityAttachment | null>(null);
  const canManage = Boolean(ownerId);

  function openUploadWithFile(file: File | null, queued: boolean) {
    setSeedFile(file);
    if (queued) setQueueOpen(true);
    else setUploadOpen(true);
  }

  const loadAttachments = useCallback(async () => {
    if (!ownerId) {
      setAttachments([]);
      return;
    }
    try {
      const res = await api.attachments.list(ownerType, ownerId);
      setAttachments(res.data ?? []);
    } catch {
      setAttachments([]);
    }
  }, [ownerType, ownerId]);

  useEffect(() => {
    void loadAttachments();
  }, [loadAttachments]);

  const handleUpload = async (payload: {
    attachment_type: string;
    description?: string;
    file?: File;
  }) => {
    if (!ownerId || !payload.file) return;

    try {
      await api.attachments.upload(ownerType, ownerId, payload.file, {
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

  const handleQueueUpload = async (payload: {
    attachment_type: string;
    description?: string;
    file?: File;
  }) => {
    if (!payload.file || !onPendingAttachmentsChange) return;

    onPendingAttachmentsChange([
      ...pendingAttachments,
      {
        id: crypto.randomUUID(),
        file: payload.file,
        attachment_type: payload.attachment_type,
        description: payload.description,
      },
    ]);
    toast.success('Attachment queued');
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

  const removePending = (id: string) => {
    onPendingAttachmentsChange?.(pendingAttachments.filter((item) => item.id !== id));
  };

  if (!canManage) {
    return (
      <div className="space-y-3 rounded-lg border bg-muted/40 p-4">
        <p className="text-sm font-medium">Upload</p>
        {onPendingAttachmentsChange && canUpload ? (
          <FileDropZone
            multiple
            hint="(docx, pdf, images, etc)"
            onFiles={(files) => openUploadWithFile(files[0] ?? null, true)}
          />
        ) : (
          <p className="text-sm text-muted-foreground">
            No attachments queued. They will upload when you save the item.
          </p>
        )}
        {pendingAttachments.length > 0 ? (
          <div className="space-y-2">
            {pendingAttachments.map((item) => (
              <UploadedFileRow
                key={item.id}
                name={pendingLabel(item)}
                subtitle={`${attachmentTypeLabel(item.attachment_type)} · ${item.file.name}`}
                onView={() => openLocalFile(item.file)}
                onDelete={() => removePending(item.id)}
              />
            ))}
          </div>
        ) : null}

        <AttachmentUploadDialog
          open={queueOpen}
          onOpenChange={(open) => {
            setQueueOpen(open);
            if (!open) setSeedFile(null);
          }}
          initialFile={seedFile}
          onSubmit={handleQueueUpload}
        />
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-lg border bg-muted/40 p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium">Upload</p>
        {canUpload && attachments.length > 0 ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => openUploadWithFile(null, false)}
          >
            <Plus className="mr-2 h-4 w-4" />
            Add
          </Button>
        ) : null}
      </div>
      {canUpload ? (
        <FileDropZone
          multiple
          hint="(docx, pdf, images, etc)"
          onFiles={(files) => openUploadWithFile(files[0] ?? null, false)}
        />
      ) : null}
      {attachments.length === 0 ? (
        <p className="text-sm text-muted-foreground">No attachments yet.</p>
      ) : (
        <div className="space-y-2">
          {attachments.map((attachment) => (
            <UploadedFileRow
              key={attachment.id}
              name={attachmentDisplayTitle(attachment)}
              subtitle={`${attachmentTypeLabel(attachment.attachment_type)} · ${attachment.file_name}`}
              onView={
                canDownload
                  ? () =>
                      void api.attachments.download(attachment.id, attachment.file_name)
                  : undefined
              }
              onEdit={canUpload ? () => setEditingAttachment(attachment) : undefined}
              onDelete={
                canDelete
                  ? () => void handleDeleteAttachment(attachment.id)
                  : undefined
              }
            />
          ))}
        </div>
      )}

      <AttachmentUploadDialog
        open={uploadOpen}
        onOpenChange={(open) => {
          setUploadOpen(open);
          if (!open) setSeedFile(null);
        }}
        initialFile={seedFile}
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
    </div>
  );
}

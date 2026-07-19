'use client';

import { useCallback, useEffect, useState } from 'react';
import { Pencil, Plus, Trash2, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AttachmentUploadDialog } from '@/components/attachment-upload-dialog';
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
  const [editingAttachment, setEditingAttachment] = useState<EntityAttachment | null>(null);
  const canManage = Boolean(ownerId);

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
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-medium">Attachments</p>
          {onPendingAttachmentsChange && canUpload ? (
            <Button type="button" variant="outline" size="sm" onClick={() => setQueueOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add
            </Button>
          ) : null}
        </div>
        <p className="text-sm text-muted-foreground">
          Queue attachments now — they will upload when you save the item.
        </p>
        {pendingAttachments.length === 0 ? (
          <p className="text-sm text-muted-foreground">No attachments queued.</p>
        ) : (
          <ul className="space-y-2">
            {pendingAttachments.map((item) => (
              <li
                key={item.id}
                className="flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{pendingLabel(item)}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {attachmentTypeLabel(item.attachment_type)} · {item.file.name}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  onClick={() => removePending(item.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}

        <AttachmentUploadDialog
          open={queueOpen}
          onOpenChange={setQueueOpen}
          onSubmit={handleQueueUpload}
        />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium">Attachments</p>
        {canUpload ? (
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
                {canDownload ? (
                  <button
                    type="button"
                    className="truncate text-left font-medium text-primary hover:underline"
                    onClick={() => void api.attachments.download(attachment.id, attachment.file_name)}
                  >
                    {attachmentDisplayTitle(attachment)}
                  </button>
                ) : (
                  <p className="truncate font-medium">{attachmentDisplayTitle(attachment)}</p>
                )}
                <p className="truncate text-xs text-muted-foreground">
                  {attachmentTypeLabel(attachment.attachment_type)} · {attachment.file_name}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                {canUpload ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setEditingAttachment(attachment)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                ) : null}
                {canDelete ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => void handleDeleteAttachment(attachment.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}

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
    </div>
  );
}

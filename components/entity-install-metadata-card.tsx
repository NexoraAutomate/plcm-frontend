'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pencil, Upload, Trash2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { EntityForm } from '@/components/entity-form';
import { useDataStore } from '@/lib/data-store';
import { hierarchyInstallFormFields, parseHierarchyInstallPayload, hierarchyInstallInitialValues } from '@/lib/hierarchy-install-fields';
import type { EntityAttachment, HierarchyInstallFields } from '@/lib/models';
import * as api from '@/lib/api';
import { formatUserRef } from '@/lib/user-display';
import { toast } from 'sonner';

type HardwareOwnerType = 'system' | 'subsystem' | 'module' | 'unit' | 'component';

interface EntityInstallMetadataCardProps {
  ownerType: HardwareOwnerType;
  entity: HierarchyInstallFields & { id: number; name: string };
  onUpdate: (data: Partial<HierarchyInstallFields>) => Promise<void>;
}

function normalizeInstallPayload(data: Record<string, unknown>) {
  return parseHierarchyInstallPayload(data);
}

export function EntityInstallMetadataCard({
  ownerType,
  entity,
  onUpdate,
}: EntityInstallMetadataCardProps) {
  const { users } = useDataStore();
  const [editOpen, setEditOpen] = useState(false);
  const [attachments, setAttachments] = useState<EntityAttachment[]>([]);
  const [uploading, setUploading] = useState(false);

  const installerLabel = useMemo(() => {
    if (!entity.installed_by_id) return undefined;
    const user = users.find((item) => item.id === entity.installed_by_id);
    return user ? formatUserRef(user) : `User #${entity.installed_by_id}`;
  }, [entity.installed_by_id, users]);

  const formFields = useMemo(
    () => hierarchyInstallFormFields({ users }),
    [users]
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

  const handleSave = async (data: Record<string, unknown>) => {
    try {
      await onUpdate(normalizeInstallPayload(data));
      toast.success('Installation metadata saved');
      setEditOpen(false);
    } catch {
      toast.error('Failed to save installation metadata');
    }
  };

  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      await api.attachments.upload(ownerType, entity.id, file);
      await loadAttachments();
      toast.success('Attachment uploaded');
    } catch {
      toast.error('Failed to upload attachment');
    } finally {
      setUploading(false);
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

  return (
    <>
      <Card className="shadow-sm">
        <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3">
          <div>
            <CardTitle className="text-base">Installation & Media</CardTitle>
            <CardDescription>
              Install date, custodian, original identifiers, and attachments for {entity.name}
            </CardDescription>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={() => setEditOpen(true)}>
            <Pencil className="mr-2 h-4 w-4" />
            Edit
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-3 text-sm md:grid-cols-2">
            <div>
              <p className="text-xs text-muted-foreground">Installation Date</p>
              <p className="font-medium">
                {entity.installation_date
                  ? new Date(entity.installation_date).toLocaleDateString()
                  : '—'}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Installed By</p>
              <p className="font-medium">{installerLabel ?? '—'}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Original Part #</p>
              <p className="font-medium">{entity.original_part_number || '—'}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Original Serial #</p>
              <p className="font-medium">{entity.original_serial_number || '—'}</p>
            </div>
          </div>

          {entity.picture_url ? (
            <div>
              <p className="mb-2 text-xs text-muted-foreground">Primary Photo</p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={entity.picture_url}
                alt={`${entity.name} photo`}
                className="max-h-40 rounded-md border object-cover"
              />
            </div>
          ) : null}

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium">Attachments</p>
              <label className="inline-flex cursor-pointer items-center">
                <input
                  type="file"
                  className="hidden"
                  disabled={uploading}
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) void handleUpload(file);
                    event.target.value = '';
                  }}
                />
                <Button type="button" variant="outline" size="sm" disabled={uploading} asChild>
                  <span>
                    <Upload className="mr-2 h-4 w-4" />
                    {uploading ? 'Uploading…' : 'Upload'}
                  </span>
                </Button>
              </label>
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
                    <button
                      type="button"
                      className="truncate text-left text-primary hover:underline"
                      onClick={() =>
                        void api.attachments.download(attachment.id, attachment.file_name)
                      }
                    >
                      {attachment.file_name}
                    </button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0"
                      onClick={() => void handleDeleteAttachment(attachment.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
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
    </>
  );
}

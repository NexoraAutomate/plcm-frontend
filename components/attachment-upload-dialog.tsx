'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ATTACHMENT_TYPES, type AttachmentType } from '@/lib/attachment-types';
import type { EntityAttachment, EntityAttachmentMetadata } from '@/lib/models';

interface AttachmentUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
  submitLabel?: string;
  initialValues?: Partial<EntityAttachmentMetadata>;
  attachment?: EntityAttachment;
  requireFile?: boolean;
  onSubmit: (payload: EntityAttachmentMetadata & { file?: File }) => Promise<void>;
}

export function AttachmentUploadDialog({
  open,
  onOpenChange,
  title = 'Add Attachment',
  description = 'Choose the attachment type, add a descriptive name, and select a file.',
  submitLabel = 'Upload',
  initialValues,
  attachment,
  requireFile = true,
  onSubmit,
}: AttachmentUploadDialogProps) {
  const [attachmentType, setAttachmentType] = useState<AttachmentType>('other');
  const [label, setLabel] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setAttachmentType((initialValues?.attachment_type as AttachmentType) ?? attachment?.attachment_type ?? 'other');
    setLabel(initialValues?.description ?? attachment?.description ?? '');
    setFile(null);
    setSubmitting(false);
  }, [open, initialValues, attachment]);

  const handleSubmit = async () => {
    if (requireFile && !file) return;

    setSubmitting(true);
    try {
      await onSubmit({
        attachment_type: attachmentType,
        description: label.trim() || undefined,
        file: file ?? undefined,
      });
      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  };

  const isEditMode = !requireFile;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="attachment-type">Attachment Type</Label>
            <Select
              value={attachmentType}
              onValueChange={(value) => setAttachmentType(value as AttachmentType)}
            >
              <SelectTrigger id="attachment-type">
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                {ATTACHMENT_TYPES.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="attachment-label">Name / Description</Label>
            <Input
              id="attachment-label"
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              placeholder="e.g. Test Report for VSWR"
            />
          </div>

          {requireFile ? (
            <div className="space-y-2">
              <Label htmlFor="attachment-file">File</Label>
              <Input
                id="attachment-file"
                type="file"
                onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              />
            </div>
          ) : attachment ? (
            <div className="rounded-md border px-3 py-2 text-sm text-muted-foreground">
              File: {attachment.file_name}
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={submitting || (requireFile && !file)}
          >
            {submitting ? 'Saving…' : isEditMode ? 'Save' : submitLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

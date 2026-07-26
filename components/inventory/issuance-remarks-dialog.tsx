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
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

export type IssuanceRemarksAction = 'return' | 'accept' | 'reject';

interface IssuanceRemarksDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  action: IssuanceRemarksAction | null;
  itemLabel?: string;
  busy?: boolean;
  onConfirm: (notes: string) => void | Promise<void>;
}

const COPY: Record<
  IssuanceRemarksAction,
  { title: string; description: string; confirm: string; placeholder: string }
> = {
  return: {
    title: 'Return inventory',
    description: 'Provide a reason for returning this item to Admin.',
    confirm: 'Submit return',
    placeholder: 'Why is this item being returned?',
  },
  accept: {
    title: 'Accept return',
    description: 'Add admin remarks before accepting this return into warehouse stock.',
    confirm: 'Accept return',
    placeholder: 'Admin remarks…',
  },
  reject: {
    title: 'Reject return',
    description: 'Add admin remarks explaining why the return is rejected (item stays with installer).',
    confirm: 'Reject return',
    placeholder: 'Admin remarks…',
  },
};

export function IssuanceRemarksDialog({
  open,
  onOpenChange,
  action,
  itemLabel,
  busy = false,
  onConfirm,
}: IssuanceRemarksDialogProps) {
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (open) setNotes('');
  }, [open, action]);

  if (!action) return null;
  const copy = COPY[action];

  const submit = async () => {
    const cleaned = notes.trim();
    if (!cleaned) return;
    await onConfirm(cleaned);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && busy) return;
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{copy.title}</DialogTitle>
          <DialogDescription>
            {copy.description}
            {itemLabel ? ` (${itemLabel})` : ''}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="issuance-remarks">Remarks *</Label>
          <Textarea
            id="issuance-remarks"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={copy.placeholder}
            rows={4}
            disabled={busy}
            required
          />
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" disabled={busy} onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={busy || !notes.trim()} onClick={() => void submit()}>
            {busy ? 'Saving…' : copy.confirm}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

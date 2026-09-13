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
import { validateIssuanceRemarks } from '@/lib/form-validation';

interface RejectInstallationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  itemLabel?: string;
  busy?: boolean;
  onConfirm: (reason: string) => void | Promise<void>;
}

export function RejectInstallationDialog({
  open,
  onOpenChange,
  itemLabel,
  busy = false,
  onConfirm,
}: RejectInstallationDialogProps) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setReason('');
      setError(null);
    }
  }, [open]);

  const submit = async () => {
    const cleaned = reason.trim();
    const validationError = validateIssuanceRemarks(cleaned);
    if (validationError) {
      setError(validationError);
      return;
    }
    setError(null);
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
          <DialogTitle>Reject Installation</DialogTitle>
          <DialogDescription>
            Explain why this installation is rejected. The developer will see this reason and
            must re-test before reporting complete again.
            {itemLabel ? ` (${itemLabel})` : ''}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="reject-installation-reason">Description *</Label>
          <Textarea
            id="reject-installation-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Reasons for rejection…"
            rows={4}
            disabled={busy}
            required
          />
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" disabled={busy} onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            disabled={busy || !reason.trim()}
            onClick={() => void submit()}
          >
            {busy ? 'Rejecting…' : 'Confirm reject'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

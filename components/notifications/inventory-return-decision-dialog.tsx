'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import * as api from '@/lib/api';
import type { InventoryReturnNotice } from '@/lib/models';
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

interface InventoryReturnDecisionDialogProps {
  notice: InventoryReturnNotice | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDecided?: () => void;
}

export function InventoryReturnDecisionDialog({
  notice,
  open,
  onOpenChange,
  onDecided,
}: InventoryReturnDecisionDialogProps) {
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState<'accept' | 'reject' | null>(null);

  const itemLabel =
    notice?.inventory_name ||
    notice?.part_number ||
    (notice?.inventory_id != null ? `Inventory #${notice.inventory_id}` : 'inventory item');
  const who = notice?.returned_by_name || (notice ? `User #${notice.returned_by_user_id}` : '');

  const resetAndClose = () => {
    setNotes('');
    setBusy(null);
    onOpenChange(false);
  };

  const handleDecide = async (action: 'accept' | 'reject') => {
    if (!notice) return;
    setBusy(action);
    try {
      if (action === 'accept') {
        await api.inventory.acceptReturn(notice.issuance_id, notes.trim() || undefined);
        toast.success('Return accepted — stock restored to warehouse');
      } else {
        await api.inventory.rejectReturn(notice.issuance_id, notes.trim() || undefined);
        toast.success('Return rejected — item reissued to installer');
      }
      onDecided?.();
      resetAndClose();
    } catch (err: unknown) {
      const detail =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        `Failed to ${action} return`;
      toast.error(typeof detail === 'string' ? detail : `Failed to ${action} return`);
      setBusy(null);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && busy) return;
        if (!next) {
          setNotes('');
          setBusy(null);
        }
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Inventory return request</DialogTitle>
          <DialogDescription>
            Installer {who} requested return of {itemLabel}
            {notice?.serial_number ? ` (${notice.serial_number})` : ''}. Accept to restore
            warehouse stock, or reject to keep it issued to the installer.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="return-decision-notes">Notes (optional)</Label>
          <Textarea
            id="return-decision-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Reason or remarks…"
            rows={3}
            disabled={busy != null}
          />
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            disabled={busy != null}
            onClick={() => void handleDecide('reject')}
          >
            {busy === 'reject' ? 'Rejecting…' : 'Reject (reissue)'}
          </Button>
          <Button disabled={busy != null} onClick={() => void handleDecide('accept')}>
            {busy === 'accept' ? 'Accepting…' : 'Accept return'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

'use client';

import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import * as api from '@/lib/api';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export interface ReworkWizardTarget {
  entityType: string;
  entityId: number;
  name?: string | null;
  serialNumber?: string | null;
  reworkId?: number | null;
  needsFail?: boolean;
  canRemove?: boolean;
  canReturn?: boolean;
  attemptCount?: number | null;
  stage?: string | null;
}

interface ReworkWizardDialogProps {
  target: ReworkWizardTarget | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
}

function apiError(error: unknown, fallback: string) {
  const detail =
    (error as { response?: { data?: { detail?: string } } })?.response?.data?.detail || fallback;
  return typeof detail === 'string' ? detail : fallback;
}

export function ReworkWizardDialog({
  target,
  open,
  onOpenChange,
  onDone,
}: ReworkWizardDialogProps) {
  const [submitting, setSubmitting] = useState(false);
  const [reworkId, setReworkId] = useState<number | null>(null);
  const [failed, setFailed] = useState(false);
  const [removed, setRemoved] = useState(false);
  const [notes, setNotes] = useState('');

  const step = useMemo(() => {
    if (!target) return 'fail';
    const id = reworkId ?? target.reworkId ?? null;
    if (target.needsFail && !failed) return 'fail';
    if ((target.canRemove || failed) && !removed && !target.canReturn) return 'remove';
    if (target.canReturn || removed || id) return 'return';
    return 'fail';
  }, [target, failed, removed, reworkId]);

  function reset() {
    setSubmitting(false);
    setReworkId(null);
    setFailed(false);
    setRemoved(false);
    setNotes('');
  }

  async function handleNext() {
    if (!target) return;
    setSubmitting(true);
    try {
      if (step === 'fail') {
        const result = await api.inventory.submitItemTest(target.entityType, target.entityId, {
          result: 'fail',
          notes: notes || null,
        });
        setFailed(true);
        if (result.data?.rework_id) setReworkId(result.data.rework_id);
        toast.success('Fail recorded — continue rework');
        setNotes('');
        return;
      }
      const id = reworkId ?? target.reworkId;
      if (!id) {
        toast.error('Rework case is not open yet');
        return;
      }
      if (step === 'remove') {
        await api.inventory.removeReworkItem(id, notes || null);
        setRemoved(true);
        toast.success('Item marked removed');
        setNotes('');
        return;
      }
      await api.inventory.returnReworkItem(id, notes || null);
      toast.success('Item returned to Inventory Manager');
      reset();
      onOpenChange(false);
      onDone();
    } catch (error: unknown) {
      toast.error(apiError(error, 'Rework step failed'));
    } finally {
      setSubmitting(false);
    }
  }

  const title =
    step === 'fail'
      ? 'Record fail and open rework'
      : step === 'remove'
        ? 'Remove the failed item'
        : 'Return to Inventory Manager';
  const description =
    step === 'fail'
      ? 'Fail cannot stay verified. This opens a rework case for the hierarchy node and serial.'
      : step === 'remove'
        ? 'Confirm the unit has been physically removed from the install location.'
        : 'Hand the unit back to IM for inspection. Status becomes RETURNED.';
  const action =
    step === 'fail' ? 'Record fail' : step === 'remove' ? 'Confirm removed' : 'Return to IM';

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {target ? (
          <div className="space-y-3">
            <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm">
              <div className="font-medium">
                {target.name || `${target.entityType} #${target.entityId}`}
              </div>
              <div className="text-muted-foreground">
                {target.serialNumber || 'No serial'}
                {target.attemptCount ? ` · attempt ${target.attemptCount}` : ''}
                {target.stage ? ` · ${target.stage}` : ''}
              </div>
            </div>
            <textarea
              className="min-h-20 w-full rounded-md border bg-background px-3 py-2 text-sm"
              placeholder="Notes (optional)"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              disabled={submitting}
            />
          </div>
        ) : null}
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              reset();
              onOpenChange(false);
            }}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button variant={step === 'fail' ? 'destructive' : 'default'} onClick={() => void handleNext()} disabled={submitting || !target}>
            {submitting ? 'Saving…' : action}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

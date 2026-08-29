'use client';

import { useEffect, useState } from 'react';
import { FileDown, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import * as api from '@/lib/api';
import type { InventoryLabel } from '@/lib/models';
import {
  type InventoryPrintCode,
  saveInventoryLabelsPdf,
} from '@/lib/inventory-label-pdf';
import { useAppDefinitions } from '@/lib/app-definitions-context';

interface InventoryBulkLabelDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function errorDetail(error: unknown) {
  const detail = (error as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
  return typeof detail === 'string' ? detail : 'Unable to generate inventory labels';
}

export function InventoryBulkLabelDialog({
  open,
  onOpenChange,
}: InventoryBulkLabelDialogProps) {
  const { definitions } = useAppDefinitions();
  const [labels, setLabels] = useState<InventoryLabel[]>([]);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const printCode: InventoryPrintCode =
    definitions.inventory_label_code_type === 'barcode' ? 'barcode' : 'qr';

  async function generateAll() {
    setBusy(true);
    try {
      const result = await api.inventory.generateAllLabels();
      setLabels(result.data);
      toast.success(
        `Ready: ${result.data.length} inventory label${result.data.length === 1 ? '' : 's'}`,
      );
    } catch (error: unknown) {
      toast.error(errorDetail(error));
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (open) {
      setReason('');
      void generateAll();
    } else {
      setLabels([]);
    }
    // Generate once whenever the bulk dialog is opened.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function printAll() {
    const activeLabels = labels.filter((label) => label.status === 'active');
    if (activeLabels.length === 0) {
      toast.error(`No active ${printCode} labels are available`);
      return;
    }
    if (activeLabels.some((label) => label.print_count > 0) && !reason.trim()) {
      toast.error('Enter a reason before reprinting labels');
      return;
    }

    setBusy(true);
    try {
      await api.inventory.printLabels({
        label_ids: activeLabels.map((label) => label.label_id),
        label_format: printCode,
        reason: reason.trim() || undefined,
      });
      await saveInventoryLabelsPdf(activeLabels, printCode, definitions);
      toast.success(`Saved ${activeLabels.length} ${printCode.toUpperCase()} labels as PDF`);
    } catch (error: unknown) {
      toast.error(errorDetail(error).replace('generate inventory labels', 'save PDF'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !busy && onOpenChange(nextOpen)}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>All inventory labels</DialogTitle>
          <DialogDescription>
            One permanent label is maintained for every current inventory unit. Reprinting
            creates a PDF copy and never regenerates the label. Each printed cell identifies
            the product name, part number, and serial number.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-wrap items-end gap-3 border-b pb-4">
          <div className="min-w-40">
            <Label>Admin print format</Label>
            <p className="mt-1 h-9 rounded-md border bg-muted px-2 py-2 text-sm">
              {printCode === 'qr' ? 'QR code' : 'Bar code'}
            </p>
          </div>
          <div className="min-w-64 flex-1">
            <Label htmlFor="bulk-reprint-reason">Reprint reason (required for copies)</Label>
            <Input
              id="bulk-reprint-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Damaged, wasted, unreadable…"
              maxLength={500}
              disabled={busy}
            />
          </div>
          <Button onClick={() => void printAll()} disabled={busy || labels.length === 0}>
            <FileDown className="mr-2 h-4 w-4" />
            {busy ? 'Preparing PDF…' : `Save all ${printCode.toUpperCase()} as PDF`}
          </Button>
        </div>
        <div className="flex items-center justify-between rounded-md border bg-muted/20 p-4 text-sm">
          <span>
            {labels.length === 0
              ? busy
                ? 'Generating labels…'
                : 'No inventory labels available'
              : `${labels.length} permanent label${labels.length === 1 ? '' : 's'} ready`}
          </span>
          <Button variant="outline" size="sm" onClick={() => void generateAll()} disabled={busy}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Generate missing labels
          </Button>
        </div>
        {labels.length > 0 ? (
          <div className="grid gap-2 sm:grid-cols-2">
            {labels.map((label) => (
              <div key={label.label_id} className="rounded-md border p-3 text-sm">
                <div className="font-medium">{label.inventory_name || 'Inventory item'}</div>
                <div className="font-mono text-xs text-muted-foreground">
                  {label.serial_number || label.part_number || 'Unserialized stock'}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {label.label_type} · {label.print_count} printed
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

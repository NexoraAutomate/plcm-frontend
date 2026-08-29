'use client';

import { useEffect, useMemo, useState } from 'react';
import { FileDown, History, RefreshCw, ShieldAlert, Tag } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import * as api from '@/lib/api';
import type { Inventory, InventoryInstance, InventoryLabel, InventoryLabelHistory } from '@/lib/models';
import { qrDataUrl } from '@/components/reporting/ReportQRCode';
import { code128Bars } from '@/lib/code128';
import {
  type InventoryPrintCode,
  saveInventoryLabelsPdf,
} from '@/lib/inventory-label-pdf';
import { useAppDefinitions } from '@/lib/app-definitions-context';

interface InventoryLabelDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: Inventory;
  instance?: InventoryInstance;
}

function Code128Barcode({ value }: { value: string }) {
  const bars = code128Bars(value);
  const scale = 2;
  let cursor = 4;
  return (
    <svg
      role="img"
      aria-label="Barcode"
      viewBox={`0 0 ${bars.reduce((total, bar) => total + bar.width * scale, 8)} 54`}
      className="h-14 w-full max-w-70 bg-white"
    >
      {bars.map((bar, index) => {
        const x = cursor;
        cursor += bar.width * scale;
        return bar.dark ? (
          <rect key={`${index}-${x}`} x={x} y="2" width={bar.width * scale} height="38" fill="black" />
        ) : null;
      })}
      <text x="50%" y="51" textAnchor="middle" fontSize="8" fill="black">
        {value}
      </text>
    </svg>
  );
}

function LabelPreview({ label, code }: { label: InventoryLabel; code: InventoryPrintCode }) {
  const [qr, setQr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (code !== 'qr') {
      setQr(null);
      return () => {
        cancelled = true;
      };
    }
    void qrDataUrl(label.signed_payload, 144).then((url) => {
      if (!cancelled) setQr(url);
    });
    return () => {
      cancelled = true;
    };
  }, [code, label.signed_payload]);

  return (
    <div className="label-print-card flex min-w-0 flex-col gap-3 rounded-lg border bg-white p-4 text-black">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-semibold">{label.inventory_name || 'Inventory item'}</p>
          <p className="font-mono text-xs">{label.serial_number || label.part_number || 'Unserialized stock'}</p>
        </div>
        <Badge variant="outline">{code === 'qr' ? 'QR code' : 'Bar code'}</Badge>
      </div>
      <div className="flex flex-wrap items-center gap-4">
        {code === 'qr' ? (
          qr ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={qr} alt={`QR code for ${label.serial_number || label.label_id}`} className="h-28 w-28" />
          ) : (
            <div className="h-28 w-28 animate-pulse rounded bg-muted" />
          )
        ) : (
          <Code128Barcode value={label.barcode_payload || label.signed_payload} />
        )}
      </div>
      <p className="break-all font-mono text-[10px] text-slate-500">{label.label_id}</p>
    </div>
  );
}

export function InventoryLabelDialog({
  open,
  onOpenChange,
  item,
  instance,
}: InventoryLabelDialogProps) {
  const { definitions } = useAppDefinitions();
  const [labels, setLabels] = useState<InventoryLabel[]>([]);
  const [history, setHistory] = useState<InventoryLabelHistory | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const printCode: InventoryPrintCode =
    definitions.inventory_label_code_type === 'barcode' ? 'barcode' : 'qr';

  const targets = useMemo(() => {
    if (instance?.id) {
      return [{ inventory_id: item.id, inventory_instance_id: instance.id, serial_number: instance.serial_number }];
    }
    const instances = (item.instances ?? []).filter((entry) => entry.id);
    if (instances.length > 0) {
      return instances.map((entry) => ({
        inventory_id: item.id,
        inventory_instance_id: entry.id,
        serial_number: entry.serial_number,
      }));
    }
    return [{ inventory_id: item.id }];
  }, [instance, item]);

  async function refresh() {
    try {
      const result = await api.inventory.listLabels({
        inventoryId: item.id,
        inventoryInstanceId: instance?.id,
        includeInactive: true,
      });
      setLabels(result.data);
    } catch {
      toast.error('Unable to load label history');
    }
  }

  useEffect(() => {
    if (open) {
      setHistory(null);
      void refresh();
    }
    // refresh intentionally tracks dialog visibility and selected instance.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, item.id, instance?.id]);

  async function generate() {
    setBusy(true);
    try {
      const result = await api.inventory.generateLabels(targets, printCode);
      setLabels(result.data);
      toast.success(`Ready: ${result.data.length} label${result.data.length === 1 ? '' : 's'}`);
    } catch (error: unknown) {
      const detail = (error as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      toast.error(typeof detail === 'string' ? detail : 'Unable to generate labels');
    } finally {
      setBusy(false);
    }
  }

  async function print(label: InventoryLabel) {
    if (label.print_count > 0 && !reason.trim()) {
      toast.error('Enter a reason before reprinting this label');
      return;
    }
    setBusy(true);
    try {
      await api.inventory.printLabels({
        label_ids: [label.label_id],
        label_format: printCode,
        reason: reason.trim() || undefined,
      });
      await saveInventoryLabelsPdf([label], printCode, definitions);
      await refresh();
      toast.success(`Saved ${printCode.toUpperCase()} label as PDF`);
    } catch (error: unknown) {
      const detail = (error as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      toast.error(typeof detail === 'string' ? detail : 'Unable to record print');
    } finally {
      setBusy(false);
    }
  }

  async function printAll() {
    const activeLabels = labels.filter((label) => label.status === 'active');
    if (activeLabels.length === 0) return;
    if (activeLabels.some((label) => label.print_count > 0) && !reason.trim()) {
      toast.error('Enter a reason before bulk reprinting labels');
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
      await refresh();
      toast.success(`Saved ${activeLabels.length} ${printCode.toUpperCase()} labels as PDF`);
    } catch (error: unknown) {
      const detail = (error as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      toast.error(typeof detail === 'string' ? detail : 'Unable to record bulk print');
    } finally {
      setBusy(false);
    }
  }

  async function viewHistory(label: InventoryLabel) {
    try {
      const result = await api.inventory.getLabelHistory(label.label_id);
      setHistory(result.data);
    } catch {
      toast.error('Unable to load label history');
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Tag className="h-4 w-4" />
            Inventory labels
          </DialogTitle>
          <DialogDescription>
            Signed labels resolve through the server. The printable label also shows the
            product name, part number, and serial number for correct placement.
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
            <Label htmlFor="reprint-reason">Reprint reason (required for copies)</Label>
            <Input
              id="reprint-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Damaged, wasted, unreadable…"
              maxLength={500}
            />
          </div>
          <Button onClick={() => void generate()} disabled={busy}>
            <RefreshCw className="mr-2 h-4 w-4" />
            {busy
              ? 'Working…'
              : `Generate missing ${targets.length > 1 ? 'labels' : 'label'}`}
          </Button>
          {labels.some((label) => label.status === 'active') ? (
            <Button variant="outline" onClick={() => void printAll()} disabled={busy}>
              <FileDown className="mr-2 h-4 w-4" />
              Save all as PDF
            </Button>
          ) : null}
        </div>
        {labels.length === 0 ? (
          <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
            No labels have been generated for this inventory target.
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {labels.map((label) => (
              <div key={label.label_id} className={label.status === 'active' ? '' : 'opacity-60'}>
              <LabelPreview label={label} code={printCode} />
                <div className="mt-2 flex items-center justify-between gap-2">
                  <span className="text-xs text-muted-foreground">
                    {label.status} · {label.print_count} printed
                  </span>
                  <div className="flex gap-1">
                    <Button size="sm" variant="outline" onClick={() => void print(label)} disabled={busy || label.status !== 'active'}>
                      <FileDown className="mr-1 h-3.5 w-3.5" />
                      {label.print_count ? 'Save copy' : 'Save PDF'}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => void viewHistory(label)}>
                      <History className="mr-1 h-3.5 w-3.5" />
                      History
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        {history ? (
          <div className="rounded-md border bg-muted/20 p-4">
            <div className="flex items-center gap-2 font-medium">
              <ShieldAlert className="h-4 w-4" />
              Print and scan history
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {history.label.label_id} · {history.label.print_count} total copies
            </p>
            <div className="mt-3 space-y-2 text-sm">
              {history.print_events.length === 0 && history.scan_events.length === 0 ? (
                <p className="text-muted-foreground">No events recorded.</p>
              ) : (
                <>
                  {history.print_events.map((event) => (
                    <div key={`print-${event.id}`} className="rounded border bg-background p-2">
                      {event.is_first_print ? 'First print' : 'Reprint'} · {event.quantity} · {event.printed_at}
                      {event.reason ? ` · ${event.reason}` : ''}
                    </div>
                  ))}
                  {history.scan_events.map((event, index) => (
                    <div key={`scan-${event.id ?? index}`} className="rounded border bg-background p-2">
                      Scan · {event.valid ? 'valid' : 'rejected'} · {event.scanned_at}
                      {event.reason ? ` · ${event.reason}` : ''}
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

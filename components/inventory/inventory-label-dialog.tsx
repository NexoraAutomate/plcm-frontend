'use client';

import { useEffect, useMemo, useState } from 'react';
import { History, Printer, RefreshCw, ShieldAlert, Tag } from 'lucide-react';
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

function downloadBarcode(label: InventoryLabel) {
  const bars = code128Bars(label.signed_payload);
  const scale = 2;
  let cursor = 4;
  const width = bars.reduce((total, bar) => total + bar.width * scale, 8);
  const rectangles = bars.map((bar) => {
    const x = cursor;
    cursor += bar.width * scale;
    return bar.dark ? `<rect x="${x}" y="2" width="${bar.width * scale}" height="38" />` : '';
  }).join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="54" viewBox="0 0 ${width} 54"><rect width="100%" height="100%" fill="white"/>${rectangles}<text x="50%" y="51" text-anchor="middle" font-size="8">${label.signed_payload}</text></svg>`;
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `label-${label.label_id}.svg`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function LabelPreview({ label }: { label: InventoryLabel }) {
  const [qr, setQr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void qrDataUrl(label.signed_payload, 144).then((url) => {
      if (!cancelled) setQr(url);
    });
    return () => {
      cancelled = true;
    };
  }, [label.signed_payload]);

  return (
    <div className="label-print-card flex min-w-0 flex-col gap-3 rounded-lg border bg-white p-4 text-black">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-semibold">{label.inventory_name || 'Inventory item'}</p>
          <p className="font-mono text-xs">{label.serial_number || label.part_number || 'Unserialized stock'}</p>
        </div>
        <Badge variant="outline">{label.label_type}</Badge>
      </div>
      <div className="flex flex-wrap items-center gap-4">
        {label.label_type !== 'barcode' ? (
          qr ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={qr} alt={`QR code for ${label.serial_number || label.label_id}`} className="h-28 w-28" />
          ) : (
            <div className="h-28 w-28 animate-pulse rounded bg-muted" />
          )
        ) : null}
        {label.label_type !== 'qr' ? <Code128Barcode value={label.signed_payload} /> : null}
      </div>
      <div className="flex gap-2 text-xs">
        {qr && label.label_type !== 'barcode' ? (
          <a
            href={qr}
            download={`label-${label.label_id}.png`}
            className="underline underline-offset-2"
          >
            Download QR
          </a>
        ) : null}
        {label.label_type !== 'qr' ? (
          <button type="button" className="underline underline-offset-2" onClick={() => downloadBarcode(label)}>
            Download barcode
          </button>
        ) : null}
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
  const [labels, setLabels] = useState<InventoryLabel[]>([]);
  const [history, setHistory] = useState<InventoryLabelHistory | null>(null);
  const [labelType, setLabelType] = useState<'qr' | 'barcode' | 'both'>('both');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

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
    return [{ inventory_id: item.id, serial_number: item.serial_number }];
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
      const result = await api.inventory.generateLabels(targets, labelType);
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
        label_format: 'standard',
        reason: reason.trim() || undefined,
      });
      await refresh();
      toast.success(label.print_count > 0 ? 'Reprint recorded' : 'First print recorded');
      window.setTimeout(() => window.print(), 0);
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
        label_format: 'standard',
        reason: reason.trim() || undefined,
      });
      await refresh();
      toast.success(`Recorded ${activeLabels.length} label prints`);
      window.setTimeout(() => window.print(), 0);
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
            Signed labels resolve through the server and never contain sensitive inventory data.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-wrap items-end gap-3 border-b pb-4">
          <div className="min-w-40">
            <Label htmlFor="label-type">Label type</Label>
            <select
              id="label-type"
              value={labelType}
              onChange={(event) => setLabelType(event.target.value as typeof labelType)}
              className="mt-1 h-9 w-full rounded-md border bg-background px-2 text-sm"
            >
              <option value="both">QR + barcode</option>
              <option value="qr">QR only</option>
              <option value="barcode">Barcode only</option>
            </select>
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
            {busy ? 'Working…' : `Generate ${targets.length > 1 ? 'bulk ' : ''}label${targets.length > 1 ? 's' : ''}`}
          </Button>
          {labels.some((label) => label.status === 'active') ? (
            <Button variant="outline" onClick={() => void printAll()} disabled={busy}>
              <Printer className="mr-2 h-4 w-4" />
              Print all
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
                <LabelPreview label={label} />
                <div className="mt-2 flex items-center justify-between gap-2">
                  <span className="text-xs text-muted-foreground">
                    {label.status} · {label.print_count} printed
                  </span>
                  <div className="flex gap-1">
                    <Button size="sm" variant="outline" onClick={() => void print(label)} disabled={busy || label.status !== 'active'}>
                      <Printer className="mr-1 h-3.5 w-3.5" />
                      {label.print_count ? 'Reprint' : 'Print'}
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

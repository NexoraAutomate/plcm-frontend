'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { AlertTriangle, Ban, PackagePlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Can } from '@/components/auth';
import { P } from '@/lib/permission-codes';
import * as api from '@/lib/api';
import type { InventoryShortage } from '@/lib/models';
import { parseApiDate } from '@/lib/parse-api-date';
import { usePageDataRefresh } from '@/components/page-data-refresh';

type Props = {
  projectId?: number;
  /** IM all-open list when true */
  inventoryScope?: boolean;
  pollMs?: number;
};

function apiError(error: unknown, fallback: string): string {
  const detail = (error as { response?: { data?: { detail?: string } } })?.response
    ?.data?.detail;
  return typeof detail === 'string' ? detail : fallback;
}

function statusVariant(status: string) {
  switch (status) {
    case 'OPEN':
      return 'destructive' as const;
    case 'PARTIAL':
      return 'secondary' as const;
    case 'FULFILLED':
      return 'outline' as const;
    default:
      return 'outline' as const;
  }
}

export function ShortageListPanel({
  projectId,
  inventoryScope = false,
  pollMs = 12_000,
}: Props) {
  const [rows, setRows] = useState<InventoryShortage[]>([]);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [receiveTarget, setReceiveTarget] = useState<InventoryShortage | null>(null);
  const [receiveQuantity, setReceiveQuantity] = useState('1');
  const [receivePartNumber, setReceivePartNumber] = useState('');
  const [receiveSerialNumber, setReceiveSerialNumber] = useState('');
  const [receiveLocation, setReceiveLocation] = useState('');

  const refresh = useCallback(async () => {
    if (inventoryScope) {
      const res = await api.inventory.listShortages({ activeOnly: true });
      setRows(res.data ?? []);
      return;
    }
    if (projectId == null) return;
    const res = await api.projects.listShortages(projectId, true);
    setRows(res.data ?? []);
  }, [inventoryScope, projectId]);

  usePageDataRefresh(refresh);

  useEffect(() => {
    void refresh().catch(() => {
      toast.error('Failed to load shortages');
    });
  }, [refresh]);

  useEffect(() => {
    if (!pollMs) return;
    const id = window.setInterval(() => {
      void refresh().catch(() => undefined);
    }, pollMs);
    const onFocus = () => {
      void refresh().catch(() => undefined);
    };
    window.addEventListener('focus', onFocus);
    return () => {
      window.clearInterval(id);
      window.removeEventListener('focus', onFocus);
    };
  }, [pollMs, refresh]);

  async function handleCancel(row: InventoryShortage) {
    setBusyId(row.id);
    try {
      await api.projects.cancelShortage(row.project_id, row.id);
      toast.success('Shortage cancelled — will not auto-reserve');
      await refresh();
    } catch (error: unknown) {
      toast.error(apiError(error, 'Cancel failed'));
    } finally {
      setBusyId(null);
    }
  }

  function openReceive(row: InventoryShortage) {
    setReceiveTarget(row);
    setReceiveQuantity('1');
    setReceivePartNumber(row.suggested_part_number || row.part_number || '');
    setReceiveSerialNumber(row.suggested_serial_number || '');
    setReceiveLocation('');
  }

  async function handleReceive() {
    if (!receiveTarget) return;
    const quantity = Number(receiveQuantity);
    const serialized = receiveTarget.target_entity_type !== 'component';
    if (!Number.isInteger(quantity) || quantity < 1 || (serialized && quantity !== 1)) {
      toast.error(serialized ? 'Receive one serialized unit at a time' : 'Enter a quantity of at least 1');
      return;
    }
    if (serialized && (!receivePartNumber.trim() || !receiveSerialNumber.trim() || !receiveLocation.trim())) {
      toast.error('Part number, serial number, and location are required');
      return;
    }

    setBusyId(receiveTarget.id);
    try {
      const res = await api.inventory.receiveShortage(receiveTarget.id, {
        quantity,
        part_number: receivePartNumber.trim() || undefined,
        serial_numbers: serialized ? [receiveSerialNumber.trim()] : undefined,
        location: serialized ? receiveLocation.trim() : undefined,
      });
      const fulfilled = res.data.fcfs_fulfillments?.length ?? 0;
      toast.success(
        fulfilled > 0
          ? `Stock received and ${fulfilled} shortage item${fulfilled === 1 ? '' : 's'} auto-reserved`
          : 'Stock received'
      );
      setReceiveTarget(null);
      await refresh();
    } catch (error: unknown) {
      toast.error(apiError(error, 'Failed to receive shortage stock'));
    } finally {
      setBusyId(null);
    }
  }

  if (rows.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">No open shortages.</p>
    );
  }

  return (
    <>
      <ul className="space-y-2 text-sm">
        {rows.map((row) => (
          <li
            key={row.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-muted/20 px-3 py-2"
          >
            <div>
              <div className="flex flex-wrap items-center gap-2 font-medium">
                <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
                {row.lru_name || row.target_entity_type}
                <Badge variant={statusVariant(row.status)}>{row.status}</Badge>
              </div>
              <div className="text-xs text-muted-foreground">
                PN {row.part_number || '—'} · Qty {row.qty_short}
                {row.qty_original !== row.qty_short ? ` of ${row.qty_original}` : ''}
                {' · '}
                {row.flight_name || row.flight_code || `Flight #${row.flight_id}`}
                {' / '}
                {row.sdls_name || row.sdls_code || `SDLS #${row.sdls_id}`}
                {inventoryScope && row.project_name ? (
                  <>
                    {' · '}
                    <Link className="underline" href={`/projects/${row.project_id}`}>
                      {row.project_name}
                    </Link>
                  </>
                ) : null}
                {' · '}
                requested {parseApiDate(row.requested_at).toLocaleString()}
                {row.requested_by_name ? ` by ${row.requested_by_name}` : ''}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {inventoryScope && (row.status === 'OPEN' || row.status === 'PARTIAL') ? (
                <Can permission={P.inventory_receive}>
                  <Button
                    size="sm"
                    disabled={busyId === row.id}
                    onClick={() => openReceive(row)}
                  >
                    <PackagePlus className="mr-1 h-3.5 w-3.5" />
                    Add stock
                  </Button>
                </Can>
              ) : null}
              {row.status === 'OPEN' || row.status === 'PARTIAL' ? (
                <Can permission={P.inventory_reserve}>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busyId === row.id}
                    onClick={() => void handleCancel(row)}
                  >
                    <Ban className="mr-1 h-3.5 w-3.5" />
                    Cancel
                  </Button>
                </Can>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
      <Dialog
        open={receiveTarget != null}
        onOpenChange={(open) => {
          if (!open && busyId == null) setReceiveTarget(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add stock for shortage</DialogTitle>
            <DialogDescription>
              Receive {receiveTarget?.lru_name || 'this item'} directly from the shortage queue.
              Matching stock is auto-reserved FCFS.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="shortage-receive-part-number">Part number (generated)</Label>
              <Input
                id="shortage-receive-part-number"
                value={receivePartNumber}
                placeholder="Generated from entity"
                disabled={busyId != null}
                readOnly
              />
            </div>
            <div>
              <Label htmlFor="shortage-receive-quantity">Quantity (new unit)</Label>
              <Input
                id="shortage-receive-quantity"
                type="number"
                value="1"
                disabled={busyId != null}
                readOnly
              />
            </div>
            {receiveTarget?.target_entity_type !== 'component' ? (
              <>
                <div>
                  <Label htmlFor="shortage-receive-serial">Serial number (generated)</Label>
                  <Input
                    id="shortage-receive-serial"
                    value={receiveSerialNumber}
                    placeholder="Generated from entity sequence"
                    disabled={busyId != null}
                    readOnly
                  />
                </div>
                <div>
                  <Label htmlFor="shortage-receive-location">Location</Label>
                  <Input
                    id="shortage-receive-location"
                    value={receiveLocation}
                    onChange={(event) => setReceiveLocation(event.target.value)}
                    placeholder="Warehouse location"
                    disabled={busyId != null}
                  />
                </div>
              </>
            ) : null}
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setReceiveTarget(null)}
                disabled={busyId != null}
              >
                Cancel
              </Button>
              <Button onClick={() => void handleReceive()} disabled={busyId != null}>
                {busyId != null ? 'Receiving…' : 'Receive stock'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

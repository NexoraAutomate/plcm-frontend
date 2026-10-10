'use client';

import { WORKFLOW_POLL_MS } from '@/lib/data-loading';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { validateShortageReceiveForm } from '@/lib/form-validation';
import { AlertTriangle, Ban, PackagePlus, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CascadingLocationSelects } from '@/components/inventory/cascading-location-selects';
import {
  costTabToPayload,
  InventoryCostTab,
  validateInventoryCostTab,
  type InventoryCostTabValue,
} from '@/components/inventory/inventory-cost-tab';
import { Can } from '@/components/auth';
import { P } from '@/lib/permission-codes';
import { useAuth } from '@/lib/auth-context';
import { useAppDefinitions } from '@/lib/app-definitions-context';
import { composeInventoryLocation } from '@/lib/inventory-entity-fields';
import { canUseProjectDetail } from '@/lib/notification-href';
import { cn } from '@/lib/utils';
import * as api from '@/lib/api';
import type { InventoryShortage } from '@/lib/models';
import { parseApiDate } from '@/lib/parse-api-date';
import { usePageDataRefresh } from '@/components/page-data-refresh';

function shortageMatchesSearch(row: InventoryShortage, query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const haystack = [
    row.lru_name,
    row.target_entity_type,
    row.target_entity_id != null ? String(row.target_entity_id) : '',
    row.part_number,
    row.suggested_part_number,
    row.suggested_serial_number,
    row.status,
    row.project_name,
    row.project_id != null ? String(row.project_id) : '',
    row.flight_name,
    row.flight_code,
    row.flight_id != null ? String(row.flight_id) : '',
    row.sdls_name,
    row.sdls_code,
    row.sdls_id != null ? String(row.sdls_id) : '',
    row.requested_by_name,
    row.notes,
    row.qty_short != null ? String(row.qty_short) : '',
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return haystack.includes(q);
}

type Props = {
  projectId?: number;
  /** IM all-open list when true */
  inventoryScope?: boolean;
  pollMs?: number;
  highlightId?: number;
  onRowsChange?: (rows: InventoryShortage[]) => void;
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
  pollMs = WORKFLOW_POLL_MS,
  highlightId,
  onRowsChange,
}: Props) {
  const { can, user } = useAuth();
  const { definitions } = useAppDefinitions();
  const showProjectLink = canUseProjectDetail(user?.roles) && can(P.view_projects);
  const [rows, setRows] = useState<InventoryShortage[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [busyId, setBusyId] = useState<number | null>(null);
  const [receiveTarget, setReceiveTarget] = useState<InventoryShortage | null>(null);
  const [receivePartNumber, setReceivePartNumber] = useState('');
  const [receiveSerialNumber, setReceiveSerialNumber] = useState('');
  const [receiveLocationRoom, setReceiveLocationRoom] = useState('');
  const [receiveLocationCabinet, setReceiveLocationCabinet] = useState('');
  const [receiveLocationRack, setReceiveLocationRack] = useState('');
  const [receiveTab, setReceiveTab] = useState('details');
  const [receiveCost, setReceiveCost] = useState<InventoryCostTabValue>({
    currency: 'PKR',
    costMode: 'batch',
    bulkQuoteCost: '',
    unitCost: '',
    unitCosts: [''],
  });

  const filteredRows = useMemo(
    () => rows.filter((row) => shortageMatchesSearch(row, searchQuery)),
    [rows, searchQuery]
  );

  const refresh = useCallback(async () => {
    if (inventoryScope) {
      const res = await api.inventory.listShortages({ activeOnly: true });
      const nextRows = res.data ?? [];
      setRows(nextRows);
      onRowsChange?.(nextRows);
      return;
    }
    if (projectId == null) return;
    const res = await api.projects.listShortages(projectId, true);
    const nextRows = res.data ?? [];
    setRows(nextRows);
    onRowsChange?.(nextRows);
  }, [inventoryScope, onRowsChange, projectId]);

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

  useEffect(() => {
    if (highlightId == null) return;
    const el = document.getElementById(`shortage-${highlightId}`);
    el?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [highlightId, rows]);

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
    setReceivePartNumber(row.suggested_part_number || row.part_number || '');
    setReceiveSerialNumber(row.suggested_serial_number || '');
    setReceiveLocationRoom('');
    setReceiveLocationCabinet('');
    setReceiveLocationRack('');
    setReceiveTab('details');
    setReceiveCost({
      currency: 'PKR',
      costMode: 'batch',
      bulkQuoteCost: '',
      unitCost: '',
      unitCosts: [''],
    });
  }

  async function handleReceive() {
    if (!receiveTarget) return;
    const needsLocation = receiveTarget.target_entity_type !== 'component';
    const location = composeInventoryLocation(
      receiveLocationRoom,
      receiveLocationCabinet,
      receiveLocationRack
    );
    const validationError = validateShortageReceiveForm({
      quantity: 1,
      partNumber: receivePartNumber,
      requireLocation: needsLocation,
      location,
    });
    if (validationError) {
      toast.error(validationError);
      setReceiveTab('details');
      return;
    }
    const costError = validateInventoryCostTab(receiveCost, 1);
    if (costError) {
      toast.error(costError);
      setReceiveTab('cost');
      return;
    }

    setBusyId(receiveTarget.id);
    try {
      const costPayload = costTabToPayload(receiveCost, 1);
      const res = await api.inventory.receiveShortage(receiveTarget.id, {
        quantity: 1,
        part_number: receivePartNumber.trim() || undefined,
        serial_numbers: receiveSerialNumber.trim()
          ? [receiveSerialNumber.trim()]
          : undefined,
        location: location || undefined,
        location_room: receiveLocationRoom.trim() || undefined,
        location_cabinet: receiveLocationCabinet.trim() || undefined,
        location_rack: receiveLocationRack.trim() || undefined,
        ...costPayload,
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
      <div className="mb-3 relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          id="shortage-list-search"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search by item, type, PN, serial, project, flight, SDLS…"
          className="pl-9"
          aria-label="Search shortages"
        />
      </div>
      {searchQuery.trim() && filteredRows.length !== rows.length ? (
        <p className="mb-2 text-xs text-muted-foreground">
          Showing {filteredRows.length} of {rows.length} shortage
          {rows.length === 1 ? '' : 's'}
        </p>
      ) : null}
      {filteredRows.length === 0 ? (
        <p className="text-xs text-muted-foreground">No shortages match your search.</p>
      ) : (
        <ul className="space-y-2 text-sm">
          {filteredRows.map((row) => (
            <li
              key={row.id}
              id={`shortage-${row.id}`}
              className={cn(
                'flex flex-wrap items-center justify-between gap-2 rounded-md border bg-muted/20 px-3 py-2',
                highlightId === row.id && 'border-primary ring-2 ring-primary/30'
              )}
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
                      {showProjectLink && row.project_id != null ? (
                        <Link className="underline" href={`/projects/${row.project_id}?tab=reservations`}>
                          {row.project_name}
                        </Link>
                      ) : (
                        row.project_name
                      )}
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
      )}
      <Dialog
        open={receiveTarget != null}
        onOpenChange={(open) => {
          if (!open && busyId == null) setReceiveTarget(null);
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add stock for shortage</DialogTitle>
            <DialogDescription>
              Receive {receiveTarget?.lru_name || 'this item'} directly from the shortage queue.
              Matching stock is auto-reserved FCFS.
            </DialogDescription>
          </DialogHeader>
          <Tabs value={receiveTab} onValueChange={setReceiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="details">Details</TabsTrigger>
              <TabsTrigger value="cost">Cost</TabsTrigger>
            </TabsList>
            <TabsContent value="details" className="mt-4 space-y-4">
              <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm space-y-1">
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground">Part number</span>
                  <span className="font-mono text-right">
                    {receivePartNumber || '—'}
                  </span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground">Quantity</span>
                  <span>1</span>
                </div>
                {receiveTarget?.target_entity_type !== 'component' ? (
                  <div className="flex justify-between gap-3">
                    <span className="text-muted-foreground">Serial number</span>
                    <span className="font-mono text-right">
                      {receiveSerialNumber || 'Generated on receive'}
                    </span>
                  </div>
                ) : null}
              </div>
              {receiveTarget?.target_entity_type !== 'component' ? (
                <CascadingLocationSelects
                  tree={definitions.inventory_location_tree}
                  required
                  disabled={busyId != null}
                  value={{
                    location_room: receiveLocationRoom,
                    location_cabinet: receiveLocationCabinet,
                    location_rack: receiveLocationRack,
                  }}
                  onChange={(next) => {
                    setReceiveLocationRoom(next.location_room);
                    setReceiveLocationCabinet(next.location_cabinet);
                    setReceiveLocationRack(next.location_rack);
                  }}
                />
              ) : null}
            </TabsContent>
            <TabsContent value="cost" className="mt-4">
              <InventoryCostTab
                quantity={1}
                value={receiveCost}
                onChange={setReceiveCost}
                disabled={busyId != null}
              />
            </TabsContent>
          </Tabs>
          <div className="flex justify-end gap-2 pt-2">
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
        </DialogContent>
      </Dialog>
    </>
  );
}

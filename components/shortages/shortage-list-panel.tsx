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
import {
  costTabToPayload,
  validateInventoryCostTab,
  type InventoryCostTabValue,
} from '@/components/inventory/inventory-cost-tab';
import { InventoryPictureThumb } from '@/components/inventory/inventory-picture-thumb';
import {
  InventoryStockFormTabs,
  inventoryStockDialogClassName,
  type InventoryStockFormData,
} from '@/components/inventory/inventory-stock-form-tabs';
import type { PendingAttachmentUpload } from '@/components/entity-attachments-section';
import { Can } from '@/components/auth';
import { P } from '@/lib/permission-codes';
import { useAuth } from '@/lib/auth-context';
import { useAppDefinitions } from '@/lib/app-definitions-context';
import { inventoryUsesInstances, type HierarchyEntityType } from '@/lib/entity-hierarchy';
import { composeInventoryLocation, emptyInventoryEntityForm } from '@/lib/inventory-entity-fields';
import {
  extractTrailingSerialSequence,
  incrementSerialNumber,
  suggestNextInventorySerial,
} from '@/lib/inventory-serial';
import { formatUserRef } from '@/lib/user-display';
import { canUseProjectDetail } from '@/lib/notification-href';
import { cn } from '@/lib/utils';
import * as api from '@/lib/api';
import type { Inventory, InventoryShortage } from '@/lib/models';
import { parseApiDate } from '@/lib/parse-api-date';
import { usePageDataRefresh } from '@/components/page-data-refresh';

function occupiedSerialsFromInventory(item: Inventory | null | undefined): string[] {
  if (!item) return [];
  const values: string[] = [];
  for (const instance of item.instances ?? []) {
    if (instance.serial_number?.trim()) values.push(instance.serial_number.trim());
    if (instance.original_serial_number?.trim()) {
      values.push(instance.original_serial_number.trim());
    }
  }
  if (item.serial_number?.trim()) values.push(item.serial_number.trim());
  if (item.original_serial_number?.trim()) values.push(item.original_serial_number.trim());
  return values;
}

function suggestNextSupplierSerial(item: Inventory | null | undefined, fallback: string): string {
  const candidates = [
    ...(item?.instances ?? []).map((instance) => instance.original_serial_number?.trim() || ''),
    item?.original_serial_number?.trim() || '',
  ].filter(Boolean);

  let bestSerial = '';
  let bestSequence = -1;
  for (const serial of candidates) {
    const parsed = extractTrailingSerialSequence(serial);
    if (!parsed) continue;
    if (parsed.sequence > bestSequence) {
      bestSequence = parsed.sequence;
      bestSerial = serial;
    }
  }

  if (bestSerial) return incrementSerialNumber(bestSerial);
  if (fallback.trim()) return fallback.trim();
  return '';
}

function ensureSerialDiffersFromPart(serial: string, partNumber: string): string {
  const next = serial.trim();
  const part = partNumber.trim();
  if (!next) return part ? incrementSerialNumber(part) : '';
  if (!part || next.toLowerCase() !== part.toLowerCase()) return next;
  return incrementSerialNumber(next);
}

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

const EMPTY_RECEIVE_COST: InventoryCostTabValue = {
  currency: 'PKR',
  costMode: 'batch',
  bulkQuoteCost: '',
  unitCost: '',
  unitCosts: [''],
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
  const { entityLabel } = useAppDefinitions();
  const showProjectLink = canUseProjectDetail(user?.roles) && can(P.view_projects);
  const [rows, setRows] = useState<InventoryShortage[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [busyId, setBusyId] = useState<number | null>(null);
  const [receiveTarget, setReceiveTarget] = useState<InventoryShortage | null>(null);
  const [receiveForm, setReceiveForm] = useState<InventoryStockFormData>({
    ...emptyInventoryEntityForm,
  });
  const [receiveTab, setReceiveTab] = useState('general');
  const [receiveCost, setReceiveCost] = useState<InventoryCostTabValue>(EMPTY_RECEIVE_COST);
  const [receiveAttachments, setReceiveAttachments] = useState<PendingAttachmentUpload[]>([]);
  const [receivePictureFile, setReceivePictureFile] = useState<File | null>(null);
  const [receiveRemovePicture, setReceiveRemovePicture] = useState(false);
  const [receiveOccupiedSerials, setReceiveOccupiedSerials] = useState<string[]>([]);
  const receiveEntityType = (receiveTarget?.target_entity_type ||
    'component') as HierarchyEntityType;
  const inventoryHolderLabel = user ? formatUserRef(user) : 'Inventory Manager';

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

  async function openReceive(row: InventoryShortage) {
    const partNumber = (row.suggested_part_number || row.part_number || '').trim();
    let nextSerial = ensureSerialDiffersFromPart(
      row.suggested_serial_number || '',
      partNumber
    );
    let nextSupplierSerial = nextSerial;
    let occupied = [] as string[];
    let catalog: Inventory | null = null;

    if (row.inventory_id != null) {
      try {
        const res = await api.inventory.get(row.inventory_id);
        catalog = res.data ?? null;
      } catch {
        catalog = null;
      }
    }

    if (catalog) {
      occupied = occupiedSerialsFromInventory(catalog);
      const suggested = suggestNextInventorySerial(catalog);
      nextSerial = ensureSerialDiffersFromPart(suggested || nextSerial, partNumber);
      nextSupplierSerial = ensureSerialDiffersFromPart(
        suggestNextSupplierSerial(catalog, nextSerial),
        partNumber
      );
    }

    setReceiveOccupiedSerials(occupied);
    setReceiveTarget(row);
    setReceiveForm({
      ...emptyInventoryEntityForm,
      inventory_type: row.target_entity_type || 'component',
      name: row.lru_name || '',
      quantity: 1,
      part_number: partNumber,
      serial_number: nextSerial,
      // Supplier PN defaults to the product part number and stays editable.
      original_part_number: partNumber,
      original_serial_number: nextSupplierSerial,
      holder_user_id: user?.id ? String(user.id) : '',
    });
    setReceiveTab('general');
    setReceiveCost({ ...EMPTY_RECEIVE_COST, unitCosts: [''] });
    setReceiveAttachments([]);
    setReceivePictureFile(null);
    setReceiveRemovePicture(false);
  }

  async function uploadReceivedExtras(received: Inventory) {
    if (receivePictureFile && !receiveRemovePicture) {
      await api.pictures.upload('inventory', received.id, receivePictureFile);
    }
    if (receiveAttachments.length === 0) return;
    const usesInstances = inventoryUsesInstances(receiveEntityType);
    const instances = received.instances ?? [];
    const ownerId = usesInstances ? instances[instances.length - 1]?.id : received.id;
    if (!ownerId) return;
    for (const attachment of receiveAttachments) {
      await api.attachments.upload(
        usesInstances ? 'inventory_instance' : 'inventory',
        ownerId,
        attachment.file,
        {
          attachment_type: attachment.attachment_type,
          description: attachment.description,
        }
      );
    }
  }

  async function handleReceive() {
    if (!receiveTarget) return;
    const needsLocation = receiveTarget.target_entity_type !== 'component';
    const partNumber = receiveForm.part_number.trim();
    const serialNumber = receiveForm.serial_number.trim();
    const supplierPart = receiveForm.original_part_number.trim();
    const supplierSerial = receiveForm.original_serial_number.trim() || serialNumber;
    const location = composeInventoryLocation(
      receiveForm.location_room,
      receiveForm.location_cabinet,
      receiveForm.location_rack
    );
    const validationError = validateShortageReceiveForm({
      quantity: 1,
      partNumber,
      serialNumber,
      supplierSerialNumber: supplierSerial,
      occupiedSerials: receiveOccupiedSerials,
      requireLocation: needsLocation,
      location,
    });
    if (validationError) {
      toast.error(validationError);
      setReceiveTab(needsLocation && partNumber && serialNumber ? 'holder' : 'general');
      return;
    }
    if (receiveForm.warranty_provided && !receiveForm.warranty_expires_at.trim()) {
      toast.error('Enter the warranty end date, or turn off supplier warranty');
      setReceiveTab('general');
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
        part_number: partNumber || undefined,
        serial_numbers: serialNumber ? [serialNumber] : undefined,
        location: location || undefined,
        location_room: receiveForm.location_room.trim() || undefined,
        location_cabinet: receiveForm.location_cabinet.trim() || undefined,
        location_rack: receiveForm.location_rack.trim() || undefined,
        description: receiveForm.description.trim() || undefined,
        oem_name: receiveForm.oem_name.trim() || undefined,
        original_part_number: supplierPart || undefined,
        original_serial_number: supplierSerial || undefined,
        added_date: receiveForm.added_date
          ? new Date(receiveForm.added_date).toISOString()
          : undefined,
        shelf_life_expires_at: receiveForm.shelf_life_expires_at
          ? new Date(receiveForm.shelf_life_expires_at).toISOString()
          : null,
        warranty_expires_at:
          receiveForm.warranty_provided && receiveForm.warranty_expires_at
            ? new Date(receiveForm.warranty_expires_at).toISOString()
            : null,
        ...costPayload,
      });
      const fulfilled = res.data.fcfs_fulfillments?.length ?? 0;
      toast.success(
        fulfilled > 0
          ? `Stock received and ${fulfilled} shortage item${fulfilled === 1 ? '' : 's'} auto-reserved`
          : 'Stock received'
      );
      try {
        await uploadReceivedExtras(res.data);
      } catch (extrasError: unknown) {
        toast.error(
          apiError(extrasError, 'Stock received, but picture or attachments failed to upload')
        );
      }
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
                      onClick={() => void openReceive(row)}
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
        <DialogContent className={inventoryStockDialogClassName}>
          <InventoryStockFormTabs
            mode="shortage"
            formTab={receiveTab}
            onFormTabChange={setReceiveTab}
            selectedEntityType={receiveEntityType}
            formData={receiveForm}
            onFormDataChange={setReceiveForm}
            entityListNames={[]}
            entityLabel={entityLabel}
            inventoryHolderLabel={inventoryHolderLabel}
            pendingAttachments={receiveAttachments}
            onPendingAttachmentsChange={setReceiveAttachments}
            pendingPictureFile={receivePictureFile}
            onPendingPictureFileChange={setReceivePictureFile}
            removePicture={receiveRemovePicture}
            onRemovePictureChange={setReceiveRemovePicture}
            costValue={receiveCost}
            onCostChange={setReceiveCost}
            costQuantity={1}
            lockTypeAndCategory
            lockQuantity
            disabled={busyId != null}
            stickyHeader={
              <DialogHeader className="space-y-1 px-6 pt-5 pb-1 text-left">
                <div className="flex items-start gap-3">
                  <InventoryPictureThumb
                    pendingFile={!receiveRemovePicture ? receivePictureFile : null}
                    ownerType="inventory"
                    ownerId={null}
                    alt={receiveForm.name || 'Shortage item'}
                    size="md"
                    showPlaceholder
                  />
                  <div className="min-w-0 space-y-1">
                    <DialogTitle>Add stock for shortage</DialogTitle>
                    <DialogDescription>
                      Receive {receiveTarget?.lru_name || 'this item'} directly from the
                      shortage queue. Matching stock is auto-reserved FCFS.
                    </DialogDescription>
                  </div>
                </div>
              </DialogHeader>
            }
          />
          <div className="flex shrink-0 justify-end gap-3 border-t bg-background px-6 py-4">
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

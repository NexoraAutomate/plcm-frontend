'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import * as api from '@/lib/api';
import { filterInventoryForReplacementByPartNumber } from '@/lib/inventory-filter';
import { inventoryPartNumber } from '@/lib/inventory-entity-fields';
import { buildReplacementStockRows, type ReplacementStockRow } from '@/lib/entity-replacement';
import { FaultyEntity, ResolutionType } from '@/lib/models';
import {
  isClassifiedFaultType,
  resolutionRequiresClassifiedFaultType,
} from '@/lib/maintenance-workflow';

export interface ReplacementSelection {
  partNumber: string;
  inventoryItemId?: number;
  inventoryQuantity?: number;
  serialNumber?: string;
  inventoryInstanceId?: number;
}

interface ResolveFaultDialogProps {
  entity: FaultyEntity | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onResolve: (
    resolutionType: ResolutionType,
    replacement?: ReplacementSelection,
    notes?: string
  ) => Promise<void>;
  isProcessing?: boolean;
}

const resolutionOptions: Array<{ value: ResolutionType; label: string }> = [
  { value: ResolutionType.REPAIRED, label: 'Repair' },
  { value: ResolutionType.REPLACED, label: 'Replacement' },
  { value: ResolutionType.NO_FAULT_FOUND, label: 'No Fault Found' },
  { value: ResolutionType.DECOMMISSIONED, label: 'Decommissioned' },
];

function stockRowKey(row: ReplacementStockRow): string {
  return row.instanceId != null ? `i-${row.instanceId}` : `inv-${row.inventoryId}-${row.srNo}`;
}

export function ResolveFaultDialog({
  entity,
  open,
  onOpenChange,
  onResolve,
  isProcessing = false,
}: ResolveFaultDialogProps) {
  const [resolutionType, setResolutionType] = useState<ResolutionType | ''>('');
  const [selectedStockKey, setSelectedStockKey] = useState('');
  const [notes, setNotes] = useState('');
  const [stockRows, setStockRows] = useState<ReplacementStockRow[]>([]);
  const [inventoryLoading, setInventoryLoading] = useState(false);

  useEffect(() => {
    if (!open) {
      setResolutionType('');
      setSelectedStockKey('');
      setNotes('');
      setStockRows([]);
    }
  }, [open]);

  const requiresReplacement = resolutionType === ResolutionType.REPLACED;
  const requiresClassifiedFaultType =
    Boolean(resolutionType) && resolutionRequiresClassifiedFaultType(resolutionType as ResolutionType);
  const hasMissingFaultType =
    requiresClassifiedFaultType && !isClassifiedFaultType(entity?.fault_type);

  useEffect(() => {
    if (!open || !entity || !requiresReplacement) {
      setStockRows([]);
      setSelectedStockKey('');
      return;
    }

    let cancelled = false;

    const loadInventory = async () => {
      setInventoryLoading(true);
      try {
        const targetPartNumber = entity.part_number?.trim() ?? '';
        if (!targetPartNumber) {
          if (!cancelled) {
            setStockRows([]);
            setSelectedStockKey('');
          }
          return;
        }

        const res = await api.inventory.list(0, 1000, entity.entity_type);
        const normalizedPart = targetPartNumber.toLowerCase();
        const candidates = (res.data ?? []).filter(
          (item) =>
            item.inventory_type?.toLowerCase() === entity.entity_type.toLowerCase() &&
            inventoryPartNumber(item).toLowerCase() === normalizedPart
        );

        const withInstances = await Promise.all(
          candidates.map(async (item) => {
            if ((item.instances ?? []).length > 0 || Number(item.quantity) <= 0) {
              return item;
            }
            try {
              const instanceRes = await api.inventory.listInstances(item.id);
              return { ...item, instances: instanceRes.data ?? [] };
            } catch {
              return item;
            }
          })
        );

        const items = filterInventoryForReplacementByPartNumber(
          withInstances,
          entity.entity_type,
          targetPartNumber
        );
        const rows = buildReplacementStockRows(items);
        if (!cancelled) {
          setStockRows(rows);
          setSelectedStockKey('');
        }
      } catch {
        if (!cancelled) {
          setStockRows([]);
        }
      } finally {
        if (!cancelled) {
          setInventoryLoading(false);
        }
      }
    };

    void loadInventory();

    return () => {
      cancelled = true;
    };
  }, [open, entity, requiresReplacement]);

  const selectedRow = useMemo(
    () => stockRows.find((row) => stockRowKey(row) === selectedStockKey),
    [stockRows, selectedStockKey]
  );

  const canSubmit =
    Boolean(resolutionType) &&
    (!requiresReplacement || Boolean(selectedRow)) &&
    !hasMissingFaultType;

  const details = useMemo(
    () => [
      { label: 'Entity Type', value: entity?.entity_type || 'N/A' },
      { label: 'Entity ID', value: entity?.entity_id.toString() || 'N/A' },
      { label: 'Serial Number', value: entity?.serial_number || 'N/A' },
      { label: 'Part Number', value: entity?.part_number || 'N/A' },
      { label: 'Status', value: entity?.status || 'N/A' },
      { label: 'Fault Type', value: entity?.fault_type || 'N/A' },
      {
        label: 'Identified At',
        value: entity?.identified_at ? new Date(entity.identified_at).toLocaleString() : 'Unknown',
      },
    ],
    [entity]
  );

  const handleSubmit = async () => {
    if (!entity || !resolutionType) return;

    const replacement = selectedRow
      ? {
          partNumber: selectedRow.partNumber,
          inventoryItemId: selectedRow.inventoryId,
          serialNumber:
            selectedRow.serialNumber && selectedRow.serialNumber !== '—'
              ? selectedRow.serialNumber
              : undefined,
          inventoryInstanceId: selectedRow.instanceId,
        }
      : undefined;

    await onResolve(resolutionType, replacement, notes.trim() || undefined);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Resolve Fault</DialogTitle>
          <DialogDescription>
            Review the selected entity and choose how to resolve the fault. When replacing,
            choose an in-stock serial whose part number matches this entity (
            {entity?.part_number || 'N/A'}).
          </DialogDescription>
        </DialogHeader>

        {!entity ? (
          <div className="rounded-lg border border-dashed border-border bg-muted p-6 text-sm text-muted-foreground">
            Select a faulty entity before resolving.
          </div>
        ) : (
          <div className="space-y-4 py-2">
            <div className="grid gap-3 sm:grid-cols-2">
              {details.map((detail) => (
                <div key={detail.label} className="rounded-md border border-border bg-background p-3">
                  <p className="text-xs uppercase text-muted-foreground">{detail.label}</p>
                  <p className="mt-1 text-sm font-medium text-foreground">{detail.value}</p>
                </div>
              ))}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="resolution-type">Resolution Type</Label>
              <Select value={resolutionType} onValueChange={(value) => setResolutionType(value as ResolutionType)}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select resolution type" />
                </SelectTrigger>
                <SelectContent>
                  {resolutionOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {requiresReplacement ? (
              <div className="grid gap-2">
                <Label htmlFor="replacement-serial-number">Replacement Serial Number</Label>
                {inventoryLoading ? (
                  <p className="text-sm text-muted-foreground">Loading inventory...</p>
                ) : stockRows.length === 0 ? (
                  <p className="text-sm text-destructive">
                    {entity.part_number?.trim()
                      ? `No in-stock inventory serials found for part number ${entity.part_number}.`
                      : 'This entity has no part number, so replacement stock cannot be matched.'}
                  </p>
                ) : (
                  <Select value={selectedStockKey} onValueChange={setSelectedStockKey}>
                    <SelectTrigger id="replacement-serial-number" className="w-full">
                      <SelectValue placeholder="Select replacement by serial number" />
                    </SelectTrigger>
                    <SelectContent>
                      {stockRows.map((row) => {
                        const description = [
                          row.partNumber ? `PN: ${row.partNumber}` : null,
                          row.oemName,
                          row.name,
                        ]
                          .filter(Boolean)
                          .join(' · ');

                        return (
                          <SelectItem key={stockRowKey(row)} value={stockRowKey(row)}>
                            <span className="font-medium">{row.serialNumber}</span>
                            {description ? (
                              <span className="ml-2 text-xs text-muted-foreground">{description}</span>
                            ) : null}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                )}
              </div>
            ) : null}

            <div className="grid gap-2">
              <Label htmlFor="resolution-notes">Resolution Notes</Label>
              <Input
                id="resolution-notes"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Optional notes for the resolution"
              />
            </div>

            {hasMissingFaultType ? (
              <p className="text-sm text-destructive">
                Select a classified fault type (not Unclassified) before using this resolution.
              </p>
            ) : null}
          </div>
        )}

        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={isProcessing}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!entity || !canSubmit || hasMissingFaultType || isProcessing}
          >
            {isProcessing ? 'Resolving...' : 'Resolve Fault'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

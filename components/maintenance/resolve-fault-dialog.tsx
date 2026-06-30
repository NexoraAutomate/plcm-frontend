'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import * as api from '@/lib/api';
import { filterInventoryForReplacement, inventoryPartNumberLabel } from '@/lib/inventory-filter';
import { FaultyEntity, Inventory, ResolutionType } from '@/lib/models';
import {
  isClassifiedFaultType,
  resolutionRequiresClassifiedFaultType,
} from '@/lib/maintenance-workflow';

export interface ReplacementSelection {
  partNumber: string;
  inventoryItemId?: number;
  inventoryQuantity?: number;
  serialNumber?: string;
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

export function ResolveFaultDialog({
  entity,
  open,
  onOpenChange,
  onResolve,
  isProcessing = false,
}: ResolveFaultDialogProps) {
  const [resolutionType, setResolutionType] = useState<ResolutionType | ''>('');
  const [selectedInventoryId, setSelectedInventoryId] = useState('');
  const [notes, setNotes] = useState('');
  const [inventoryItems, setInventoryItems] = useState<Inventory[]>([]);
  const [inventoryLoading, setInventoryLoading] = useState(false);

  useEffect(() => {
    if (!open) {
      setResolutionType('');
      setSelectedInventoryId('');
      setNotes('');
      setInventoryItems([]);
    }
  }, [open]);

  const requiresReplacementPartNumber = resolutionType === ResolutionType.REPLACED;
  const requiresClassifiedFaultType =
    Boolean(resolutionType) && resolutionRequiresClassifiedFaultType(resolutionType as ResolutionType);
  const hasMissingFaultType =
    requiresClassifiedFaultType && !isClassifiedFaultType(entity?.fault_type);

  useEffect(() => {
    if (!open || !entity || !requiresReplacementPartNumber) {
      setInventoryItems([]);
      setSelectedInventoryId('');
      return;
    }

    let cancelled = false;

    const loadInventory = async () => {
      setInventoryLoading(true);
      try {
        const res = await api.inventory.list(0, 1000, entity.entity_type);
        const items = filterInventoryForReplacement(
          res.data ?? [],
          entity.entity_type,
          entity.entity_name ?? ''
        );
        if (!cancelled) {
          setInventoryItems(items);
          setSelectedInventoryId('');
        }
      } catch {
        if (!cancelled) {
          setInventoryItems([]);
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
  }, [open, entity, requiresReplacementPartNumber]);

  const selectedInventory = useMemo(
    () => inventoryItems.find((item) => String(item.id) === selectedInventoryId),
    [inventoryItems, selectedInventoryId]
  );

  const canSubmit =
    Boolean(resolutionType) &&
    (!requiresReplacementPartNumber || Boolean(selectedInventory)) &&
    !hasMissingFaultType;

  const details = useMemo(
    () => [
      { label: 'Entity Type', value: entity?.entity_type || 'N/A' },
      { label: 'Entity ID', value: entity?.entity_id.toString() || 'N/A' },
      { label: 'Part Number', value: entity?.part_number || 'N/A' },
      { label: 'Serial Number', value: entity?.serial_number || 'N/A' },
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

    const replacement = selectedInventory
      ? {
          partNumber: inventoryPartNumberLabel(selectedInventory),
          inventoryItemId: selectedInventory.id,
          inventoryQuantity: selectedInventory.quantity,
          serialNumber: selectedInventory.serial_number,
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
            Review the selected entity and choose how to resolve the fault. Replacement part
            number is required when resolution type is Replacement.
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

            {requiresReplacementPartNumber ? (
              <div className="grid gap-2">
                <Label htmlFor="replacement-part-number">Replacement Part Number</Label>
                {inventoryLoading ? (
                  <p className="text-sm text-muted-foreground">Loading inventory...</p>
                ) : inventoryItems.length === 0 ? (
                  <p className="text-sm text-destructive">
                    No replacement parts in inventory for this entity.
                  </p>
                ) : (
                  <Select value={selectedInventoryId} onValueChange={setSelectedInventoryId}>
                    <SelectTrigger id="replacement-part-number" className="w-full">
                      <SelectValue placeholder="Select replacement part from inventory" />
                    </SelectTrigger>
                    <SelectContent>
                      {inventoryItems.map((item) => {
                        const partLabel = inventoryPartNumberLabel(item);
                        const description = [
                          item.oem_name,
                          `Qty: ${item.quantity}`,
                          item.serial_number ? `SN: ${item.serial_number}` : null,
                        ]
                          .filter(Boolean)
                          .join(' · ');

                        return (
                          <SelectItem key={item.id} value={String(item.id)}>
                            <span className="font-medium">{partLabel}</span>
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

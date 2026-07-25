'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { Inventory, InventoryInstance } from '@/lib/models';
import { getSelectableInstances } from '@/lib/inventory-install';

interface InventorySerialSelectDialogProps {
  item: Inventory | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (instanceId: number) => void;
  confirming?: boolean;
  confirmLabel?: string;
  description?: string;
}

function formatInstanceLabel(instance: InventoryInstance, index: number): string {
  const serial = instance.serial_number?.trim();
  const base = serial || `Unit ${index + 1}`;
  return instance.is_reserved ? `${base} (issued)` : base;
}

export function InventorySerialSelectDialog({
  item,
  open,
  onOpenChange,
  onConfirm,
  confirming = false,
  confirmLabel = 'Use Selected',
  description,
}: InventorySerialSelectDialogProps) {
  const instances = useMemo(
    () => (item ? getSelectableInstances(item) : []),
    [item]
  );
  const instanceSignature = useMemo(
    () => instances.map((instance) => instance.id).join(','),
    [instances]
  );
  const [selectedInstanceId, setSelectedInstanceId] = useState('');

  useEffect(() => {
    if (!open) {
      setSelectedInstanceId('');
      return;
    }
    if (instances.length === 1) {
      setSelectedInstanceId(String(instances[0].id));
    }
    // instanceSignature keeps this stable across parent re-renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, instanceSignature]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Select Serial Number</DialogTitle>
          <DialogDescription>
            {description ??
              (item
                ? `${item.name} has ${item.quantity} units in stock. Choose which serial number to install.`
                : 'Choose which serial number to install.')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="inventory-serial-select">Serial Number</Label>
          <Select value={selectedInstanceId} onValueChange={setSelectedInstanceId}>
            <SelectTrigger id="inventory-serial-select">
              <SelectValue placeholder="Select a serial number" />
            </SelectTrigger>
            <SelectContent>
              {instances.map((instance, index) => (
                <SelectItem key={instance.id} value={String(instance.id)}>
                  {formatInstanceLabel(instance, index)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={confirming}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              const instanceId = Number(selectedInstanceId);
              if (Number.isFinite(instanceId)) {
                onConfirm(instanceId);
              }
            }}
            disabled={!selectedInstanceId || confirming}
          >
            {confirming ? 'Working...' : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

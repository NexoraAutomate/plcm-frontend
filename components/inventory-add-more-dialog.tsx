'use client';

import { useEffect, useMemo, useState } from 'react';
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
import { CascadingLocationSelects } from '@/components/inventory/cascading-location-selects';
import {
  composeInventoryLocation,
  parseInventoryLocationParts,
} from '@/lib/inventory-entity-fields';
import { allocateInventorySerials } from '@/lib/inventory-serial';
import type { InventoryLocationTree } from '@/lib/inventory-location-tree';
import type { Inventory } from '@/lib/models';

function generateRestockCode(): string {
  return String(Math.floor(1000 + Math.random() * 9000));
}

export type InventoryAddMorePayload = {
  quantity: number;
  location_room: string;
  location_cabinet: string;
  location_rack: string;
  location: string;
};

type RelatedEntity = {
  part_number?: string | null;
  original_part_number?: string | null;
  serial_number?: string | null;
  original_serial_number?: string | null;
};

interface InventoryAddMoreDialogProps {
  item: Inventory | null;
  open: boolean;
  holderLabel: string;
  locationTree: InventoryLocationTree | null | undefined;
  relatedEntities?: RelatedEntity[];
  onOpenChange: (open: boolean) => void;
  onConfirm: (payload: InventoryAddMorePayload) => Promise<void>;
}

export function InventoryAddMoreDialog({
  item,
  open,
  holderLabel,
  locationTree,
  relatedEntities = [],
  onOpenChange,
  onConfirm,
}: InventoryAddMoreDialogProps) {
  const [quantity, setQuantity] = useState(1);
  const [locationRoom, setLocationRoom] = useState('');
  const [locationCabinet, setLocationCabinet] = useState('');
  const [locationRack, setLocationRack] = useState('');
  const [confirmationCode, setConfirmationCode] = useState('');
  const [userInput, setUserInput] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open || !item) return;
    const locationSource = item.instances?.find((instance) => instance.location) ?? item;
    const locationParts = parseInventoryLocationParts(locationSource);
    setQuantity(1);
    setLocationRoom(locationParts.location_room);
    setLocationCabinet(locationParts.location_cabinet);
    setLocationRack(locationParts.location_rack);
    setConfirmationCode(generateRestockCode());
    setUserInput('');
    setSubmitting(false);
    // Keyed on `open` only so parent list refreshes cannot regenerate the code
    // while the IM is typing it (that kept Add stock disabled after a matching entry).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const serialPreview = useMemo(() => {
    if (!item) return [];
    return allocateInventorySerials(item, quantity, relatedEntities);
  }, [item, quantity, relatedEntities]);

  const codeMatches =
    confirmationCode.length === 4 && userInput === confirmationCode;
  const quantityOk = Number.isFinite(quantity) && quantity >= 1 && quantity <= 100;
  const canSubmit = codeMatches && quantityOk && !submitting;

  function close() {
    if (submitting) return;
    onOpenChange(false);
  }

  async function handleConfirm() {
    if (!item || !canSubmit) return;
    const location = composeInventoryLocation(locationRoom, locationCabinet, locationRack);
    setSubmitting(true);
    try {
      await onConfirm({
        quantity,
        location_room: locationRoom,
        location_cabinet: locationCabinet,
        location_rack: locationRack,
        location,
      });
      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) close();
        else onOpenChange(true);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add More Stock</DialogTitle>
          <DialogDescription>
            {item
              ? `Restock ${item.name} (${item.inventory_type}). New units are assigned sequential identities and held by you as Inventory Manager.`
              : 'Add more units of this inventory item.'}
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            void handleConfirm();
          }}
        >
          <div>
            <Label htmlFor="add-more-quantity">Quantity to add *</Label>
            <Input
              id="add-more-quantity"
              type="number"
              min={1}
              max={100}
              value={quantity}
              onChange={(e) => {
                const raw = e.target.value;
                if (raw === '') {
                  setQuantity(0);
                  return;
                }
                const next = Number.parseInt(raw, 10);
                setQuantity(Number.isNaN(next) ? 0 : next);
              }}
              placeholder="How many units to receive"
              disabled={submitting}
            />
            {serialPreview.length > 0 ? (
              <p className="mt-1 text-xs text-muted-foreground font-mono">
                {serialPreview.length === 1
                  ? `Next identity: ${serialPreview[0]}`
                  : `Identities: ${serialPreview[0]} … ${serialPreview[serialPreview.length - 1]}`}
              </p>
            ) : null}
          </div>
          <div>
            <Label>Inventory Holder</Label>
            <Input value={holderLabel} disabled />
            <p className="text-xs text-muted-foreground">
              Warehouse stock is held by the Inventory Manager who restocks the item.
            </p>
          </div>
          <CascadingLocationSelects
            tree={locationTree}
            required
            disabled={submitting}
            value={{
              location_room: locationRoom,
              location_cabinet: locationCabinet,
              location_rack: locationRack,
            }}
            onChange={(next) => {
              setLocationRoom(next.location_room);
              setLocationCabinet(next.location_cabinet);
              setLocationRack(next.location_rack);
            }}
          />
          <div className="space-y-2 rounded-md border bg-muted/30 p-3">
            <p className="text-sm text-muted-foreground">
              To confirm restocking, type the following code:
            </p>
            <p className="text-center text-2xl font-mono font-bold tracking-widest">
              {confirmationCode}
            </p>
            <div className="space-y-1">
              <Label htmlFor="add-more-confirm-code">Confirmation code</Label>
              <Input
                id="add-more-confirm-code"
                name="restock-confirmation-code"
                type="text"
                value={userInput}
                onChange={(e) =>
                  setUserInput(e.target.value.replace(/\D/g, '').slice(0, 4))
                }
                placeholder="Enter the 4-digit code"
                inputMode="numeric"
                autoComplete="off"
                disabled={submitting}
              />
              {userInput.length === 4 && !codeMatches ? (
                <p className="text-xs text-destructive">Code does not match. Check the digits above.</p>
              ) : null}
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={close} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={!canSubmit}>
              {submitting ? 'Adding…' : 'Add stock'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

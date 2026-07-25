'use client';

import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import * as api from '@/lib/api';
import type { Inventory, InventoryInstance, User } from '@/lib/models';
import { inventoryUsesInstances } from '@/lib/entity-hierarchy';
import { formatUserRef } from '@/lib/user-display';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: Inventory | null;
  users: User[];
  onIssued?: () => void;
  /** Preselect a serial instance when opening from a row expander */
  presetInstanceId?: number | null;
};

export function InventoryIssueDialog({
  open,
  onOpenChange,
  item,
  users,
  onIssued,
  presetInstanceId,
}: Props) {
  const [issuedToUserId, setIssuedToUserId] = useState<string>('');
  const [instanceId, setInstanceId] = useState<string>('');
  const [quantity, setQuantity] = useState('1');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const usesInstances = item
    ? inventoryUsesInstances(item.inventory_type as 'system' | 'subsystem' | 'module' | 'unit' | 'component')
    : false;

  const availableInstances: InventoryInstance[] = useMemo(() => {
    if (!item?.instances) return [];
    return item.instances.filter((i) => i.id && !i.is_reserved);
  }, [item]);

  useEffect(() => {
    if (!open || !item) return;
    setIssuedToUserId('');
    setNotes('');
    setQuantity('1');
    if (presetInstanceId) {
      setInstanceId(String(presetInstanceId));
    } else if (availableInstances.length === 1) {
      setInstanceId(String(availableInstances[0].id));
    } else {
      setInstanceId('');
    }
  }, [open, item, presetInstanceId, availableInstances]);

  const handleSubmit = async () => {
    if (!item) return;
    const developerId = Number(issuedToUserId);
    if (!Number.isFinite(developerId) || developerId <= 0) {
      toast.error('Select a developer');
      return;
    }

    const qty = Math.max(1, Number(quantity) || 1);
    let resolvedInstanceId: number | undefined;

    if (usesInstances) {
      resolvedInstanceId = Number(instanceId);
      if (!Number.isFinite(resolvedInstanceId) || resolvedInstanceId <= 0) {
        toast.error('Select a serial number to issue');
        return;
      }
    } else {
      const avail = item.available_quantity ?? item.quantity ?? 0;
      if (qty > avail) {
        toast.error(`Only ${avail} unit(s) available to issue`);
        return;
      }
    }

    setSubmitting(true);
    try {
      await api.inventory.issue(item.id, {
        issued_to_user_id: developerId,
        quantity: usesInstances ? 1 : qty,
        instance_id: resolvedInstanceId ?? null,
        notes: notes.trim() || null,
      });
      toast.success('Inventory item issued to developer');
      onOpenChange(false);
      onIssued?.();
    } catch (err: unknown) {
      const detail =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        'Failed to issue inventory';
      toast.error(typeof detail === 'string' ? detail : 'Failed to issue inventory');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Issue to developer</DialogTitle>
          <DialogDescription>
            Reserve stock for a developer without decreasing inventory quantity. Stock
            decreases only when the item is installed.
          </DialogDescription>
        </DialogHeader>

        {item && (
          <div className="space-y-4">
            <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm">
              <div className="font-medium">{item.name}</div>
              <div className="text-muted-foreground">
                {item.part_number || '—'}
                {usesInstances
                  ? ` · ${availableInstances.length} available serial(s)`
                  : ` · ${item.available_quantity ?? item.quantity} available / ${item.quantity} total`}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Developer</Label>
              <Select value={issuedToUserId} onValueChange={setIssuedToUserId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select user" />
                </SelectTrigger>
                <SelectContent>
                  {users.map((u) => (
                    <SelectItem key={u.id} value={String(u.id)}>
                      {formatUserRef(u) || u.username || `User #${u.id}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {usesInstances ? (
              <div className="space-y-2">
                <Label>Serial number</Label>
                <Select value={instanceId} onValueChange={setInstanceId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select serial" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableInstances.map((inst) => (
                      <SelectItem key={inst.id} value={String(inst.id)}>
                        {inst.serial_number || `Instance #${inst.id}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className="space-y-2">
                <Label>Quantity</Label>
                <Input
                  type="number"
                  min={1}
                  max={item.available_quantity ?? item.quantity}
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                />
              </div>
            )}

            <div className="space-y-2">
              <Label>Notes (optional)</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Purpose, target system, etc."
                rows={3}
              />
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={submitting || !item}>
            {submitting ? 'Issuing…' : 'Issue'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

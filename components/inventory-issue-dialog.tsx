'use client';

import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import * as api from '@/lib/api';
import type { Inventory, InventoryInstance, ItemIssueRequest, User } from '@/lib/models';
import { inventoryUsesInstances } from '@/lib/entity-hierarchy';
import { formatUserRef } from '@/lib/user-display';
import { hasWorkflowRole } from '@/lib/workflow-roles';
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
import {
  IssueSignatureFields,
  useIssueSignature,
} from '@/components/inventory/issue-signature-fields';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: Inventory | null;
  users: User[];
  onIssued?: () => void;
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
  const [pendingRequests, setPendingRequests] = useState<ItemIssueRequest[]>([]);
  const signature = useIssueSignature();

  const usesInstances = item
    ? inventoryUsesInstances(item.inventory_type as 'system' | 'subsystem' | 'module' | 'unit' | 'component')
    : false;

  const issuableInstances: InventoryInstance[] = useMemo(() => {
    if (!item?.instances) return [];
    return item.instances.filter((i) => i.id && !i.is_reserved);
  }, [item]);

  const selectedInstance = useMemo(
    () => issuableInstances.find((row) => String(row.id) === instanceId) ?? null,
    [issuableInstances, instanceId]
  );
  const reservedHold = Boolean(
    selectedInstance?.is_project_reserved || selectedInstance?.project_reservation
  );
  const matchingRequest = useMemo(() => {
    if (!selectedInstance?.id) return null;
    return (
      pendingRequests.find((row) => row.inventory_instance_id === selectedInstance.id) ?? null
    );
  }, [pendingRequests, selectedInstance?.id]);

  const developers = useMemo(
    () => users.filter((user) => hasWorkflowRole(user.roles ?? [], ['DEV', 'ADMIN'])),
    [users]
  );

  useEffect(() => {
    if (!open || !item) return;
    setNotes('');
    setQuantity('1');
    signature.reset();
    if (presetInstanceId) {
      setInstanceId(String(presetInstanceId));
    } else if (issuableInstances.length === 1) {
      setInstanceId(String(issuableInstances[0].id));
    } else {
      setInstanceId('');
    }
    void api.inventory
      .listItemRequests({ status: 'pending' })
      .then((res) => setPendingRequests(res.data ?? []))
      .catch(() => setPendingRequests([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, item, presetInstanceId, issuableInstances]);

  useEffect(() => {
    if (matchingRequest) {
      setIssuedToUserId(String(matchingRequest.assigned_developer_id));
    } else if (open) {
      setIssuedToUserId('');
    }
  }, [matchingRequest, open]);

  const handleSubmit = async () => {
    if (!item) return;
    const signed = signature.payload();
    if (!signed) {
      toast.error('Signature is required to issue');
      return;
    }
    if (usesInstances && reservedHold && !matchingRequest) {
      toast.error('Developer must request this reserved item before it can be issued');
      return;
    }

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
      if (matchingRequest) {
        await api.inventory.issueItemRequest(matchingRequest.id, {
          ...signed,
          notes: notes.trim() || null,
        });
      } else {
        await api.inventory.issue(item.id, {
          issued_to_user_id: developerId,
          quantity: usesInstances ? 1 : qty,
          instance_id: resolvedInstanceId ?? null,
          notes: notes.trim() || null,
          ...signed,
        });
      }
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
            Signature is required. Reserved serials can only be issued after the assigned
            developer requests them.
          </DialogDescription>
        </DialogHeader>

        {item && (
          <div className="space-y-4">
            <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm">
              <div className="font-medium">{item.name}</div>
              <div className="text-muted-foreground">
                {item.part_number || '—'}
                {usesInstances
                  ? ` · ${issuableInstances.length} serial(s)`
                  : ` · ${item.available_quantity ?? item.quantity} available / ${item.quantity} total`}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Developer</Label>
              <Select
                value={issuedToUserId}
                onValueChange={setIssuedToUserId}
                disabled={Boolean(matchingRequest)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select user" />
                </SelectTrigger>
                <SelectContent>
                  {(matchingRequest ? users : developers).map((u) => (
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
                    {issuableInstances.map((inst) => (
                      <SelectItem key={inst.id} value={String(inst.id)}>
                        {inst.serial_number || `Instance #${inst.id}`}
                        {inst.is_project_reserved || inst.project_reservation
                          ? ' (reserved)'
                          : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {reservedHold && !matchingRequest ? (
                  <p className="text-xs text-amber-700">
                    Waiting for the assigned developer to request this reserved item.
                  </p>
                ) : null}
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

            <IssueSignatureFields
              signatureType={signature.signatureType}
              onSignatureTypeChange={signature.setSignatureType}
              digitalPayload={signature.digitalPayload}
              onDigitalPayloadChange={signature.setDigitalPayload}
              hardCopyAck={signature.hardCopyAck}
              onHardCopyAckChange={signature.setHardCopyAck}
              disabled={submitting}
            />

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

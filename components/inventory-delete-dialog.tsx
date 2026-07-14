'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
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
import type { Inventory, InventoryInstance } from '@/lib/models';
import { inventoryUsesInstances, type HierarchyEntityType } from '@/lib/entity-hierarchy';
import { getSelectableInstances } from '@/lib/inventory-install';

type DeleteStep = 'choice' | 'confirm-all' | 'confirm-one';

interface InventoryDeleteDialogProps {
  item: Inventory | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleteAll: (inventoryId: number) => Promise<void>;
  onDeleteOne: (instanceId: number) => Promise<void>;
}

function generateDeleteCode(): string {
  return String(Math.floor(1000 + Math.random() * 9000));
}

function formatInstanceLabel(instance: InventoryInstance, index: number): string {
  const serial = instance.serial_number?.trim();
  if (serial) return serial;
  return `Unit ${index + 1}`;
}

export function InventoryDeleteDialog({
  item,
  open,
  onOpenChange,
  onDeleteAll,
  onDeleteOne,
}: InventoryDeleteDialogProps) {
  const instances = useMemo(() => (item ? getSelectableInstances(item) : []), [item]);
  const canDeleteOne =
    !!item &&
    inventoryUsesInstances(item.inventory_type as HierarchyEntityType) &&
    instances.length > 0;

  const [step, setStep] = useState<DeleteStep>('choice');
  const [selectedInstanceId, setSelectedInstanceId] = useState('');
  const [confirmationCode, setConfirmationCode] = useState('');
  const [userInput, setUserInput] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;

    if (canDeleteOne) {
      setStep('choice');
    } else {
      setStep('confirm-all');
    }
    setSelectedInstanceId(instances.length === 1 ? String(instances[0].id) : '');
    setConfirmationCode(generateDeleteCode());
    setUserInput('');
    setSubmitting(false);
  }, [open, canDeleteOne, instances]);

  const codeMatches = userInput === confirmationCode;
  const selectedInstance = instances.find(
    (instance) => String(instance.id) === selectedInstanceId
  );

  function close() {
    if (submitting) return;
    onOpenChange(false);
  }

  async function handleConfirm() {
    if (!item || !codeMatches || submitting) return;

    setSubmitting(true);
    try {
      if (step === 'confirm-all') {
        await onDeleteAll(item.id);
      } else if (step === 'confirm-one') {
        if (!selectedInstance?.id) return;
        await onDeleteOne(selectedInstance.id);
      }
      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  }

  const title =
    step === 'choice'
      ? 'Delete Inventory Item'
      : step === 'confirm-all'
        ? 'Delete All Serial Numbers'
        : 'Delete One Serial Number';

  const description =
    step === 'choice'
      ? `Choose how to delete "${item?.name ?? 'this item'}".`
      : step === 'confirm-all'
        ? `This will permanently delete "${item?.name ?? 'this item'}" and all of its serial numbers. This action cannot be undone.`
        : `This will permanently delete the selected serial number from "${item?.name ?? 'this item'}". This action cannot be undone.`;

  const canSubmit =
    codeMatches &&
    !submitting &&
    (step === 'confirm-all' || (step === 'confirm-one' && Boolean(selectedInstanceId)));

  return (
    <AlertDialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) close();
        else onOpenChange(true);
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="text-foreground">{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>

        {step === 'choice' && (
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => {
                setStep('confirm-one');
                setConfirmationCode(generateDeleteCode());
                setUserInput('');
                if (instances.length === 1) {
                  setSelectedInstanceId(String(instances[0].id));
                }
              }}
            >
              Delete One
            </Button>
            <Button
              variant="destructive"
              className="flex-1 bg-destructive text-emerald-50 hover:bg-destructive/90"
              onClick={() => {
                setStep('confirm-all');
                setConfirmationCode(generateDeleteCode());
                setUserInput('');
              }}
            >
              Delete All
            </Button>
          </div>
        )}

        {(step === 'confirm-all' || step === 'confirm-one') && (
          <div className="space-y-4">
            {step === 'confirm-one' && (
              <div className="space-y-2">
                <Label htmlFor="inventory-delete-serial">Serial number</Label>
                <Select value={selectedInstanceId} onValueChange={setSelectedInstanceId}>
                  <SelectTrigger id="inventory-delete-serial">
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
            )}

            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                To confirm deletion, type the following code:
              </p>
              <p className="text-center text-2xl font-mono font-bold tracking-widest">
                {confirmationCode}
              </p>
              <div className="space-y-1">
                <Label htmlFor="inventory-delete-code">Confirmation code</Label>
                <Input
                  id="inventory-delete-code"
                  value={userInput}
                  onChange={(e) =>
                    setUserInput(e.target.value.replace(/\D/g, '').slice(0, 4))
                  }
                  placeholder="Enter the 4-digit code"
                  inputMode="numeric"
                  autoComplete="off"
                  disabled={submitting}
                />
              </div>
            </div>
          </div>
        )}

        <AlertDialogFooter>
          {step !== 'choice' && canDeleteOne && (
            <Button
              type="button"
              variant="ghost"
              disabled={submitting}
              onClick={() => {
                setStep('choice');
                setUserInput('');
              }}
            >
              Back
            </Button>
          )}
          <AlertDialogCancel disabled={submitting}>Cancel</AlertDialogCancel>
          {step !== 'choice' && (
            <Button
              variant="destructive"
              disabled={!canSubmit}
              onClick={() => void handleConfirm()}
              className="bg-destructive text-emerald-50 hover:bg-destructive/90"
            >
              {submitting ? 'Deleting…' : 'Delete'}
            </Button>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

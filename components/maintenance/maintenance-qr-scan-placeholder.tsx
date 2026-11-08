'use client';

import { useState } from 'react';
import { Camera, Loader2, QrCode, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { InventoryLabelScanner } from '@/components/inventory/inventory-label-scanner';
import { cn } from '@/lib/utils';
import * as api from '@/lib/api';

interface MaintenanceQrScanPlaceholderProps {
  disabled?: boolean;
  onSerialDetected: (serialNumber: string) => void | Promise<void>;
  /** Icon-only trigger for compact toolbars. */
  variant?: 'default' | 'icon';
  className?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** When true, render only the scanner panel (controlled open). */
  panelOnly?: boolean;
  /** When true, render only the trigger button. */
  triggerOnly?: boolean;
}

function looksLikeSignedLabelPayload(payload: string): boolean {
  const value = payload.trim().toUpperCase();
  return value.startsWith('PLCM1.') || value.startsWith('PLCB.');
}

/**
 * Placeholder QR / barcode scan entry for maintenance entity lookup.
 * Uses the inventory label scanner UI; resolves signed payloads to a serial,
 * then hands that serial to the same lookup path as manual search.
 */
export function MaintenanceQrScanPlaceholder({
  disabled,
  onSerialDetected,
  variant = 'default',
  className,
  open: openProp,
  onOpenChange,
  panelOnly = false,
  triggerOnly = false,
}: MaintenanceQrScanPlaceholderProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const [resolving, setResolving] = useState(false);
  const open = openProp ?? uncontrolledOpen;
  const setOpen = (next: boolean) => {
    onOpenChange?.(next);
    if (openProp === undefined) setUncontrolledOpen(next);
  };

  async function resolvePayload(payload: string) {
    const raw = payload.trim();
    if (!raw || resolving) return;

    setResolving(true);
    try {
      let serial = raw;

      if (looksLikeSignedLabelPayload(raw)) {
        const response = await api.inventory.scanLabel({
          payload: raw,
          source: 'maintenance-lookup',
        });
        const data = response.data;
        if (!data.valid) {
          toast.error(data.message || 'Invalid inventory label');
          return;
        }
        const fromLabel = data.label?.serial_number?.trim();
        const fromInstance = data.inventory?.instance?.serial_number?.trim();
        const fromInventory = data.inventory?.serial_number?.trim();
        serial = fromLabel || fromInstance || fromInventory || '';
        if (!serial) {
          toast.error('Label resolved, but no serial number was found on it.');
          return;
        }
      }

      setOpen(false);
      await onSerialDetected(serial);
      toast.success(`Serial ${serial} looked up`);
    } catch (error: unknown) {
      const detail = (error as { response?: { data?: { detail?: string } } })?.response
        ?.data?.detail;
      toast.error(
        typeof detail === 'string' ? detail : 'Unable to resolve scanned label'
      );
    } finally {
      setResolving(false);
    }
  }

  const triggerButton = (
    <Button
      type="button"
      variant="outline"
      size={variant === 'icon' ? 'icon' : 'default'}
      className={cn(variant === 'icon' ? 'h-10 w-10 shrink-0' : 'w-full gap-2', className)}
      disabled={disabled || resolving}
      onClick={() => setOpen(!open)}
      aria-label={open ? 'Close scanner' : 'Scan QR code'}
    >
      {resolving ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : open ? (
        <X className="h-4 w-4" />
      ) : (
        <QrCode className="h-4 w-4" />
      )}
      {variant === 'default' ? (open ? 'Close scanner' : 'Scan QR code') : null}
    </Button>
  );

  const trigger =
    variant === 'icon' ? (
      <Tooltip>
        <TooltipTrigger asChild>{triggerButton}</TooltipTrigger>
        <TooltipContent>{open ? 'Close scanner' : 'Scan QR code'}</TooltipContent>
      </Tooltip>
    ) : (
      triggerButton
    );

  const panel = open ? (
    <div className="space-y-3 rounded-lg border border-dashed bg-background p-3">
      <div className="flex items-start gap-2 text-xs text-muted-foreground">
        <Camera className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <p>
          Point the camera at an inventory QR/barcode, or paste the label payload.
          The serial is resolved and looked up automatically.
        </p>
      </div>
      {resolving ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Resolving scanned label…
        </p>
      ) : (
        <InventoryLabelScanner onDetected={(payload) => void resolvePayload(payload)} />
      )}
    </div>
  ) : null;

  if (panelOnly) return panel;
  if (triggerOnly) return trigger;

  return (
    <div className="space-y-2">
      {trigger}
      {panel}
    </div>
  );
}

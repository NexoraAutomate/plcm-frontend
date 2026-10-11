'use client';

import { useState } from 'react';
import { Camera, Loader2, QrCode, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { InventoryLabelScanner } from '@/components/inventory/inventory-label-scanner';
import * as api from '@/lib/api';

interface MaintenanceQrScanPlaceholderProps {
  disabled?: boolean;
  onSerialDetected: (serialNumber: string) => void | Promise<void>;
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
}: MaintenanceQrScanPlaceholderProps) {
  const [open, setOpen] = useState(false);
  const [resolving, setResolving] = useState(false);

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
      toast.success(`Serial ${serial} ready for lookup`);
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

  return (
    <div className="space-y-2">
      <Button
        type="button"
        variant="outline"
        className="w-full gap-2"
        disabled={disabled || resolving}
        onClick={() => setOpen((current) => !current)}
      >
        {resolving ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : open ? (
          <X className="h-4 w-4" />
        ) : (
          <QrCode className="h-4 w-4" />
        )}
        {open ? 'Close scanner' : 'Scan QR code'}
      </Button>

      {open ? (
        <div className="space-y-3 rounded-lg border border-dashed bg-background p-3">
          <div className="flex items-start gap-2 text-xs text-muted-foreground">
            <Camera className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <p>
              Placeholder scanner: point the camera at an inventory QR/barcode, or
              paste the label payload. The serial is resolved and looked up the
              same way as a manual serial search.
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
      ) : null}
    </div>
  );
}

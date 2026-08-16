'use client';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { StatusBadge } from '@/components/status-badge';
import { ItemStatus } from '@/lib/workflow-status';
import type { InventoryInstance, InventoryProjectHold } from '@/lib/models';

function Row({ label, value }: { label: string; value?: string | number | null }) {
  if (value == null || value === '') return null;
  return (
    <div className="grid grid-cols-[8rem_1fr] gap-2 border-b border-border/60 py-2 last:border-b-0">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-sm wrap-break-word">{String(value)}</p>
    </div>
  );
}

export function isProjectReservedInstance(instance?: InventoryInstance | null): boolean {
  if (!instance) return false;
  if (instance.is_project_reserved || instance.project_reservation) return true;
  return instance.status_name === ItemStatus.RESERVED;
}

type Props = {
  instance: InventoryInstance | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function InventoryReservationHoldDialog({ instance, open, onOpenChange }: Props) {
  const hold: InventoryProjectHold | null | undefined = instance?.project_reservation;
  const serial =
    instance?.original_serial_number?.trim() ||
    instance?.serial_number?.trim() ||
    hold?.serial_number ||
    '—';
  const flight = hold?.flight_name || hold?.flight_code;
  const sdls = hold?.sdls_name || hold?.sdls_code;
  const node =
    hold?.target_entity_name ||
    (hold ? `${hold.target_entity_type} #${hold.target_entity_id}` : null);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Reserved serial
            <StatusBadge status={ItemStatus.RESERVED} />
          </DialogTitle>
          <DialogDescription>
            This unit is reserved by HM against a project hierarchy node.
          </DialogDescription>
        </DialogHeader>
        {hold ? (
          <div>
            <Row label="Serial" value={serial} />
            <Row label="Part number" value={hold.part_number} />
            <Row label="Inventory" value={hold.inventory_name} />
            <Row label="Project" value={hold.project_name} />
            <Row label="Flight" value={flight} />
            <Row label="SDLS" value={sdls} />
            <Row
              label="Hierarchy"
              value={
                node
                  ? `${hold.target_entity_type}: ${node}`
                  : hold.target_entity_type
              }
            />
            <Row label="Reserved by" value={hold.reserved_by_name} />
            <Row
              label="Reserved"
              value={hold.reserved_at ? new Date(hold.reserved_at).toLocaleString() : null}
            />
            <Row
              label="Reminder"
              value={hold.expires_at ? new Date(hold.expires_at).toLocaleString() : null}
            />
            <Row
              label="Last reminder"
              value={
                hold.last_reminder_at
                  ? new Date(hold.last_reminder_at).toLocaleString()
                  : '—'
              }
            />
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Serial {serial} is marked Reserved, but hold details are not available.
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}

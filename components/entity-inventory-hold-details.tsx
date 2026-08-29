'use client';

import type { InventoryReservation, InventoryShortage } from '@/lib/models';
import {
  ENTITY_LIFECYCLE_LABEL,
  reservationDisplayFields,
  shortageDisplayFields,
  type EntityLifecycleTone,
} from '@/lib/entity-lifecycle-style';
import { cn } from '@/lib/utils';

function Field({
  label,
  value,
  className,
}: {
  label: string;
  value?: string | number | null;
  className?: string;
}) {
  if (value == null || value === '') return null;
  return (
    <p className={cn('text-xs text-muted-foreground', className)}>
      <span className="font-medium text-foreground/80">{label}:</span> {value}
    </p>
  );
}

export function EntityInventoryHoldDetails({
  tone,
  reservation,
  shortage,
  entity,
  compact = false,
}: {
  tone: EntityLifecycleTone;
  reservation?: InventoryReservation | null;
  shortage?: InventoryShortage | null;
  entity?: { part_number?: string | null; serial_number?: string | null };
  compact?: boolean;
}) {
  const label = ENTITY_LIFECYCLE_LABEL[tone];
  const fields = reservationDisplayFields(reservation, entity);
  const short = shortageDisplayFields(shortage);
  const hasReservationFields = Boolean(
    fields.partNumber ||
      fields.serialNumber ||
      fields.inventoryName ||
      fields.reservedBy ||
      fields.expiresAt ||
      fields.flight ||
      fields.sdls
  );
  const hasShortageFields = Boolean(short?.partNumber || short?.lruName || short?.qtyShort);

  if (!label && !hasReservationFields && !hasShortageFields) return null;

  if (compact) {
    return (
      <div className="mt-1.5 space-y-0.5 rounded-md border border-border/60 bg-background/50 px-2 py-1.5">
        <Field label="Inventory" value={fields.inventoryName} />
        <Field label="Part #" value={fields.partNumber || short?.partNumber} />
        <Field label="Serial #" value={fields.serialNumber} />
        {tone === 'short' && short ? (
          <>
            <Field label="LRU" value={short.lruName} />
            <Field label="Qty short" value={short.qtyShort} />
          </>
        ) : null}
        {tone === 'reserved' || reservation ? (
          <>
            <Field
              label="Expires"
              value={
                fields.expiresAt
                  ? new Date(fields.expiresAt).toLocaleDateString()
                  : null
              }
            />
            <Field label="Reserved by" value={fields.reservedBy} />
          </>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-md border border-border/70 bg-background/40 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm font-medium">
          {tone === 'short' ? 'Inventory shortage' : 'Reserved inventory'}
        </p>
      </div>
      <div className="grid grid-cols-1 gap-3 text-sm md:grid-cols-2">
        <div>
          <p className="text-xs text-muted-foreground">Inventory item</p>
          <p className="font-medium">{fields.inventoryName || short?.lruName || '—'}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Part Number</p>
          <p className="font-medium">{fields.partNumber || short?.partNumber || '—'}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Serial Number</p>
          <p className="font-medium">{fields.serialNumber || '—'}</p>
        </div>
        {tone === 'short' && short ? (
          <div>
            <p className="text-xs text-muted-foreground">Quantity short</p>
            <p className="font-medium">{short.qtyShort}</p>
          </div>
        ) : null}
        {reservation ? (
          <>
            <div>
              <p className="text-xs text-muted-foreground">Reserved by</p>
              <p className="font-medium">{fields.reservedBy || '—'}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Reserved at</p>
              <p className="font-medium">
                {fields.reservedAt
                  ? new Date(fields.reservedAt).toLocaleString()
                  : '—'}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Expires</p>
              <p className="font-medium">
                {fields.expiresAt
                  ? new Date(fields.expiresAt).toLocaleString()
                  : '—'}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Flight / SDLS</p>
              <p className="font-medium">
                {[fields.flight, fields.sdls].filter(Boolean).join(' · ') || '—'}
              </p>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}

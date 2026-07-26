'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import * as api from '@/lib/api';
import type { InventoryIssuance, InventoryIssuanceEvent } from '@/lib/models';
import { parseApiDate } from '@/lib/parse-api-date';
import { Badge } from '@/components/ui/badge';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { PageLoader } from '@/components/page-loader';

interface IssuanceHistorySheetProps {
  issuance: InventoryIssuance | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function formatWhen(value?: string | null) {
  if (!value) return '—';
  try {
    const d = parseApiDate(value);
    if (Number.isNaN(d.getTime())) return value;
    return d.toLocaleString();
  } catch {
    return value;
  }
}

function eventLabel(type: string) {
  switch (type) {
    case 'issued':
      return 'Issued';
    case 'return_requested':
      return 'Return requested';
    case 'return_accepted':
      return 'Return accepted';
    case 'return_rejected':
      return 'Return rejected (reissued)';
    case 'installed':
      return 'Installed';
    case 'reverted':
      return 'Reverted to stock';
    default:
      return type;
  }
}

function eventVariant(type: string) {
  switch (type) {
    case 'issued':
      return 'default' as const;
    case 'return_requested':
      return 'secondary' as const;
    case 'return_accepted':
      return 'outline' as const;
    case 'return_rejected':
      return 'destructive' as const;
    case 'installed':
      return 'secondary' as const;
    case 'reverted':
      return 'outline' as const;
    default:
      return 'outline' as const;
  }
}

export function IssuanceHistorySheet({
  issuance,
  open,
  onOpenChange,
}: IssuanceHistorySheetProps) {
  const [events, setEvents] = useState<InventoryIssuanceEvent[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !issuance) {
      setEvents([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    void api.inventory
      .getIssuanceHistory(issuance.id)
      .then((res) => {
        if (!cancelled) setEvents(res.data ?? []);
      })
      .catch(() => {
        if (!cancelled) {
          toast.error('Failed to load issuance history');
          setEvents([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, issuance]);

  const title =
    issuance?.inventory_name ||
    (issuance ? `Issuance #${issuance.id}` : 'Issuance history');

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Issuance history</SheetTitle>
          <SheetDescription>
            {title}
            {issuance?.serial_number ? ` · SN ${issuance.serial_number}` : ''}
            {issuance?.part_number ? ` · PN ${issuance.part_number}` : ''}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-4 px-1">
          {loading ? (
            <PageLoader />
          ) : events.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              No history events found for this unit.
            </p>
          ) : (
            <ol className="relative space-y-4 border-l border-border pl-4">
              {events.map((event, index) => (
                <li key={`${event.issuance_id}-${event.event_type}-${event.created_at}-${index}`} className="relative">
                  <span className="absolute -left-[21px] top-1.5 size-2.5 rounded-full bg-primary" />
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={eventVariant(event.event_type)}>
                        {eventLabel(event.event_type)}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {formatWhen(event.created_at)}
                      </span>
                    </div>
                    <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
                      <dt className="text-muted-foreground">Qty</dt>
                      <dd>{event.quantity}</dd>
                      <dt className="text-muted-foreground">Installer</dt>
                      <dd>
                        {event.installer_name ||
                          (event.installer_user_id != null
                            ? `User #${event.installer_user_id}`
                            : '—')}
                      </dd>
                      <dt className="text-muted-foreground">Actor</dt>
                      <dd>
                        {event.actor_name ||
                          (event.actor_user_id != null ? `User #${event.actor_user_id}` : '—')}
                      </dd>
                      {event.serial_number ? (
                        <>
                          <dt className="text-muted-foreground">Serial</dt>
                          <dd>{event.serial_number}</dd>
                        </>
                      ) : null}
                      <dt className="text-muted-foreground">Remarks</dt>
                      <dd className="whitespace-pre-wrap">
                        {event.notes?.trim() || '—'}
                      </dd>
                    </dl>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { History, PenLine } from 'lucide-react';
import { toast } from 'sonner';
import * as api from '@/lib/api';
import type { InventoryIssuance } from '@/lib/models';
import { parseApiDate } from '@/lib/parse-api-date';
import { ITEM_STATUS_LABELS, type ItemStatusCode } from '@/lib/workflow-status';
import {
  displayStatusBadgeVariant,
  issuanceDisplayStatus,
  issuanceHasSignatureArtifacts,
} from '@/lib/issuance-signature';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PageLoader } from '@/components/page-loader';

type Props = {
  issuance: InventoryIssuance | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onViewHistory?: () => void;
  onViewSignature?: () => void;
};

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

function formatEntityRef(
  type?: string | null,
  id?: number | null,
  name?: string | null
) {
  if (name?.trim()) return name.trim();
  const et = (type || '').trim();
  if (et && id != null) return `${et} #${id}`;
  return null;
}

function lifecycleLabel(code?: string | null) {
  if (!code?.trim()) return null;
  const key = code.trim().toUpperCase() as ItemStatusCode;
  return ITEM_STATUS_LABELS[key] ?? code.replace(/_/g, ' ');
}

function DetailRow({
  label,
  value,
  alwaysShow,
}: {
  label: string;
  value?: string | null;
  alwaysShow?: boolean;
}) {
  const text = value?.trim() ? value.trim() : '—';
  if (!alwaysShow && text === '—') return null;

  return (
    <div className="grid gap-1 border-b border-border/60 py-2.5 last:border-b-0 sm:grid-cols-[minmax(8rem,34%)_1fr] sm:gap-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="text-sm wrap-break-word">{text}</p>
    </div>
  );
}

export function IssuanceDetailsDialog({
  issuance,
  open,
  onOpenChange,
  onViewHistory,
  onViewSignature,
}: Props) {
  const [details, setDetails] = useState<InventoryIssuance | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !issuance) {
      setDetails(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setDetails(issuance);

    void (async () => {
      try {
        const res = await api.inventory.getIssuance(issuance.id);
        if (!cancelled) setDetails(res.data ?? issuance);
      } catch {
        if (!cancelled) {
          toast.error('Could not refresh issuance details');
          setDetails(issuance);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, issuance]);

  const row = details;
  const displayStatus = row ? issuanceDisplayStatus(row) : '';
  const flightLabel =
    row?.flight_name || row?.flight_code
      ? [row.flight_name, row.flight_code].filter(Boolean).join(' · ')
      : null;
  const sdlsLabel =
    row?.sdls_name || row?.sdls_code
      ? [row.sdls_name, row.sdls_code].filter(Boolean).join(' · ')
      : null;
  const targetRef = formatEntityRef(
    row?.target_entity_type,
    row?.target_entity_id,
    row?.target_entity_name
  );
  const installedRef = formatEntityRef(
    row?.installed_entity_type,
    row?.installed_entity_id,
    row?.installed_entity_name
  );
  const hasSignature = row ? issuanceHasSignatureArtifacts(row) : false;

  const title =
    row?.inventory_name ||
    row?.part_number ||
    (row ? `Issuance #${row.id}` : 'Issuance details');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[min(90vh,720px)] flex-col gap-0 overflow-hidden sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="pr-6">{title}</DialogTitle>
          <DialogDescription>
            Issuance and install context for this inventory unit.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-1 py-2">
          {loading && !row ? (
            <PageLoader />
          ) : row ? (
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2 pb-2">
                <Badge variant={displayStatusBadgeVariant(displayStatus)}>
                  {displayStatus}
                </Badge>
                {row.inventory_type ? (
                  <span className="text-xs text-muted-foreground">{row.inventory_type}</span>
                ) : null}
              </div>

              <DetailRow label="Issuance #" value={String(row.id)} alwaysShow />
              <DetailRow
                label="Item"
                value={row.inventory_name || `Inventory #${row.inventory_id}`}
                alwaysShow
              />
              <DetailRow label="Part number" value={row.part_number} alwaysShow />
              <DetailRow label="Serial number" value={row.serial_number} alwaysShow />
              <DetailRow label="Quantity" value={String(row.quantity)} alwaysShow />

              <DetailRow label="Project" value={row.project_name} alwaysShow />
              <DetailRow label="Flight" value={flightLabel} />
              <DetailRow label="SDLS" value={sdlsLabel} />
              <DetailRow
                label="Target entity"
                value={
                  targetRef && row.target_entity_type
                    ? `${targetRef} (${row.target_entity_type})`
                    : targetRef
                }
                alwaysShow
              />

              <DetailRow
                label="Issued to (developer)"
                value={row.issued_to_name || `User #${row.issued_to_user_id}`}
                alwaysShow
              />
              <DetailRow
                label="Issued by"
                value={row.issued_by_name || `User #${row.issued_by_user_id}`}
                alwaysShow
              />
              <DetailRow label="Issued at" value={formatWhen(row.issued_at)} alwaysShow />

              <DetailRow
                label="Item lifecycle"
                value={lifecycleLabel(row.item_lifecycle_status)}
              />
              <DetailRow label="Installed on" value={installedRef} />
              <DetailRow label="Installed at" value={formatWhen(row.installed_at)} />
              <DetailRow
                label="Installed by"
                value={row.installed_by_name}
              />
              <DetailRow label="Verified at" value={formatWhen(row.verified_at)} />

              <DetailRow
                label="Return requested"
                value={formatWhen(row.return_requested_at)}
              />
              <DetailRow label="Closed at" value={formatWhen(row.closed_at)} />
              <DetailRow label="Closed by" value={row.closed_by_name} />
              <DetailRow label="Signature" value={row.signature_type} />
              <DetailRow label="Issue notes" value={row.notes} />
            </div>
          ) : null}
        </div>

        {row ? (
          <DialogFooter className="gap-2 border-t pt-4 sm:justify-between">
            <div className="flex flex-wrap gap-2">
              {onViewHistory ? (
                <Button type="button" variant="outline" size="sm" onClick={onViewHistory}>
                  <History className="size-3.5" />
                  History
                </Button>
              ) : null}
              {onViewSignature && hasSignature ? (
                <Button type="button" variant="outline" size="sm" onClick={onViewSignature}>
                  <PenLine className="size-3.5" />
                  Signature
                </Button>
              ) : null}
            </div>
            <Button type="button" variant="secondary" size="sm" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </DialogFooter>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

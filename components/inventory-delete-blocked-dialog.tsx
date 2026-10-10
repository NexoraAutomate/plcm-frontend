'use client';

import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/status-badge';
import { ItemStatus } from '@/lib/workflow-status';
import type { Inventory, InventoryInstance, InventoryIssuance } from '@/lib/models';
import { isProjectReservedInstance } from '@/lib/inventory-install';
import { useAppDefinitions } from '@/lib/app-definitions-context';
import * as api from '@/lib/api';

function Row({ label, value }: { label: string; value?: string | number | null }) {
  if (value == null || value === '') return null;
  return (
    <div className="grid grid-cols-[8rem_1fr] gap-2 border-b border-border/60 py-2 last:border-b-0">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-sm wrap-break-word">{String(value)}</p>
    </div>
  );
}

function instanceSerial(instance: InventoryInstance): string {
  return (
    instance.original_serial_number?.trim() ||
    instance.serial_number?.trim() ||
    instance.project_reservation?.serial_number ||
    `Unit #${instance.id}`
  );
}

function blockedReasonLabel(instance: InventoryInstance): string {
  if (isProjectReservedInstance(instance)) return ItemStatus.RESERVED;
  if (instance.open_issuance_status === 'return_pending') return 'RETURN PENDING';
  if (instance.status_name?.trim()) return instance.status_name.trim().toUpperCase();
  if (instance.is_reserved) return 'ISSUED';
  return 'IN USE';
}

type Props = {
  item: Inventory | null;
  instances: InventoryInstance[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function InventoryDeleteBlockedDialog({
  item,
  instances,
  open,
  onOpenChange,
}: Props) {
  const { entityLabel } = useAppDefinitions();
  const [issuances, setIssuances] = useState<Record<number, InventoryIssuance>>({});
  const [loadingIssuances, setLoadingIssuances] = useState(false);

  useEffect(() => {
    if (!open) return;

    const issuanceIds = [
      ...new Set(
        instances
          .map((instance) => instance.open_issuance_id)
          .filter((id): id is number => typeof id === 'number' && id > 0)
      ),
    ];
    if (issuanceIds.length === 0) {
      setIssuances({});
      return;
    }

    let cancelled = false;
    setLoadingIssuances(true);
    void Promise.all(
      issuanceIds.map(async (id) => {
        try {
          const res = await api.inventory.getIssuance(id);
          return [id, res.data] as const;
        } catch {
          return [id, null] as const;
        }
      })
    ).then((entries) => {
      if (cancelled) return;
      const next: Record<number, InventoryIssuance> = {};
      for (const [id, issuance] of entries) {
        if (issuance) next[id] = issuance;
      }
      setIssuances(next);
      setLoadingIssuances(false);
    });

    return () => {
      cancelled = true;
    };
  }, [open, instances]);

  const titleName = item?.name?.trim() || 'this inventory item';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Cannot delete inventory</DialogTitle>
          <DialogDescription>
            Only available inventory can be deleted. &quot;{titleName}&quot; is currently
            reserved, issued, or installed.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[24rem] space-y-4 overflow-y-auto">
          {instances.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              This item has no available units. Clear any reservation, issuance, or
              installation before deleting.
            </p>
          ) : (
            instances.map((instance) => {
              const hold = instance.project_reservation;
              const issuance =
                instance.open_issuance_id != null
                  ? issuances[instance.open_issuance_id]
                  : undefined;
              const reason = blockedReasonLabel(instance);
              const flight =
                hold?.flight_name ||
                hold?.flight_code ||
                issuance?.flight_name ||
                issuance?.flight_code;
              const project = hold?.project_name || issuance?.project_name;
              const sdls = hold?.sdls_name || hold?.sdls_code || issuance?.sdls_name || issuance?.sdls_code;
              const hierarchyNode =
                hold?.target_entity_name ||
                (hold
                  ? `${hold.target_entity_type} #${hold.target_entity_id}`
                  : null) ||
                issuance?.target_entity_name ||
                (issuance?.target_entity_type
                  ? `${issuance.target_entity_type}${
                      issuance.target_entity_id != null
                        ? ` #${issuance.target_entity_id}`
                        : ''
                    }`
                  : null);
              const installedEntity =
                issuance?.installed_entity_name ||
                (issuance?.installed_entity_type
                  ? `${issuance.installed_entity_type}${
                      issuance.installed_entity_id != null
                        ? ` #${issuance.installed_entity_id}`
                        : ''
                    }`
                  : null);

              return (
                <div key={instance.id} className="rounded-md border px-3 py-2">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <p className="font-mono text-sm">{instanceSerial(instance)}</p>
                    <StatusBadge status={reason} />
                  </div>
                  {hold ? (
                    <div>
                      <Row label={entityLabel('project')} value={project} />
                      <Row label="Flight" value={flight} />
                      <Row label="SDLS" value={sdls} />
                      <Row
                        label="Hierarchy"
                        value={
                          hierarchyNode
                            ? hold.target_entity_type
                              ? `${hold.target_entity_type}: ${hierarchyNode}`
                              : hierarchyNode
                            : hold.target_entity_type
                        }
                      />
                      <Row label="Reserved by" value={hold.reserved_by_name} />
                    </div>
                  ) : issuance ? (
                    <div>
                      <Row label="Status" value={issuance.display_status || issuance.status} />
                      <Row label={entityLabel('project')} value={project} />
                      <Row label="Flight" value={flight} />
                      <Row label="SDLS" value={sdls} />
                      <Row label="Issued to" value={issuance.issued_to_name} />
                      <Row label="Target" value={hierarchyNode} />
                      <Row label="Installed in" value={installedEntity} />
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      {loadingIssuances && instance.open_issuance_id
                        ? 'Loading reservation / issuance details…'
                        : `This unit is ${reason.toLowerCase()} and cannot be deleted.`}
                    </p>
                  )}
                </div>
              );
            })
          )}
        </div>

        <DialogFooter>
          <Button type="button" onClick={() => onOpenChange(false)}>
            OK
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

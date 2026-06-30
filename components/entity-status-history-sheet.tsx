'use client';

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { History, Loader2 } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { StatusBadge } from '@/components/status-badge';
import * as api from '@/lib/api';
import { resolveEntity, type HardwareEntityType } from '@/lib/entity-resolver';
import type { Entity, EntityStatusHistory, Status } from '@/lib/models';
import { useDataStore } from '@/lib/data-store';

interface EntityStatusHistorySheetProps {
  entityType: HardwareEntityType;
  entityPk: number;
  entityName: string;
  statuses?: Status[];
  trigger?: ReactNode;
  triggerVariant?: 'button' | 'icon';
  className?: string;
}

type HistoryEntry = EntityStatusHistory & { synthetic?: boolean };

function resolveHistoryStatusName(
  entry: HistoryEntry,
  statuses: Status[],
  entity?: Entity | null
): string {
  if (entry.status?.status_name) return entry.status.status_name;
  const match = statuses.find((status) => status.id === entry.status_id);
  if (match?.status_name) return match.status_name;
  if (entity?.status?.status_name && entry.status_id === entity.status_id) {
    return entity.status.status_name;
  }
  return `Status #${entry.status_id}`;
}

function formatChangedAt(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function buildHistoryWithInitialFallback(
  records: EntityStatusHistory[],
  entity: Entity
): HistoryEntry[] {
  if (records.length > 0) return records;

  if (entity.status_id == null) return [];

  return [
    {
      id: 0,
      entity_id: entity.id,
      status_id: entity.status_id,
      changed_by: 0,
      changed_at: entity.created_at,
      notes: '',
      synthetic: true,
    },
  ];
}

export function EntityStatusHistorySheet({
  entityType,
  entityPk,
  entityName,
  statuses: statusesProp,
  trigger,
  triggerVariant = 'button',
  className,
}: EntityStatusHistorySheetProps) {
  const { statuses: storeStatuses } = useDataStore();
  const statuses = statusesProp?.length ? statusesProp : storeStatuses;

  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [entityRecord, setEntityRecord] = useState<Entity | null>(null);

  const sortedHistory = useMemo(
    () =>
      [...history].sort(
        (a, b) => new Date(b.changed_at).getTime() - new Date(a.changed_at).getTime()
      ),
    [history]
  );

  const loadHistory = useCallback(async () => {
    setLoading(true);
    setError(null);
    setEntityRecord(null);

    try {
      const entity = await resolveEntity(entityType, entityPk);
      if (!entity) {
        setHistory([]);
        setError('No linked entity record found for this item.');
        return;
      }

      setEntityRecord(entity);

      const records = (await api.entities.getStatusHistory(entity.id)).data;
      setHistory(buildHistoryWithInitialFallback(records, entity));
    } catch {
      setHistory([]);
      setError('Failed to load status history.');
    } finally {
      setLoading(false);
    }
  }, [entityType, entityPk]);

  useEffect(() => {
    if (open) {
      void loadHistory();
    }
  }, [open, loadHistory]);

  const defaultTrigger =
    triggerVariant === 'icon' ? (
      <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" title="Status history">
        <History className="h-3.5 w-3.5" />
      </Button>
    ) : (
      <Button variant="outline" size="sm" className="gap-1.5 h-7 px-2 text-xs">
        <History className="h-3 w-3" />
        History
      </Button>
    );

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild className={className}>
        {trigger ?? defaultTrigger}
      </SheetTrigger>
      <SheetContent side="right" className="flex w-full flex-col sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Status History</SheetTitle>
          <SheetDescription>
            Status changes for {entityName}
          </SheetDescription>
        </SheetHeader>

        <div className="flex min-h-0 flex-1 flex-col px-4 pb-4">
          {loading ? (
            <div className="flex flex-1 items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Loading history...
            </div>
          ) : error ? (
            <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
              {error}
            </div>
          ) : sortedHistory.length === 0 ? (
            <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
              No status history recorded yet.
            </div>
          ) : (
            <ScrollArea className="flex-1 pr-3">
              <ol className="relative space-y-0 border-l border-border pl-5">
                {sortedHistory.map((entry, index) => {
                  const isCurrent = index === 0;
                  const isInitial = index === sortedHistory.length - 1;

                  return (
                    <li key={`${entry.id}-${entry.changed_at}`} className="relative pb-6 last:pb-0">
                      <span
                        className="absolute -left-[1.3rem] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-background bg-primary"
                        aria-hidden
                      />
                      <div className="space-y-1.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <StatusBadge
                            status={resolveHistoryStatusName(entry, statuses, entityRecord)}
                          />
                          {isCurrent ? (
                            <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                              Current
                            </span>
                          ) : null}
                          {isInitial ? (
                            <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                              Initial
                            </span>
                          ) : null}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {formatChangedAt(entry.changed_at)}
                        </p>
                        {entry.notes ? (
                          <p className="text-xs text-foreground/80">{entry.notes}</p>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ol>
            </ScrollArea>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

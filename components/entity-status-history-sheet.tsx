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
import {
  WORKFLOW_AUDIT_ACTION_LABELS,
  WORKFLOW_AUDIT_ROLE_LABELS,
  type Entity,
  type EntityLifecycleHistoryEvent,
  type EntityStatusHistory,
  type Status,
} from '@/lib/models';
import { useDataStore } from '@/lib/data-store';
import { workflowStatusLabel } from '@/lib/workflow-status';

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

function formatEventDetails(entry: EntityLifecycleHistoryEvent): string | null {
  const oldValue = entry.old_value;
  const newValue = entry.new_value;
  if (!oldValue && !newValue) return null;

  const details: string[] = [];
  const oldStatus = typeof oldValue?.status === 'string' ? oldValue.status : null;
  const newStatus = typeof newValue?.status === 'string' ? newValue.status : null;
  if (oldStatus && newStatus) {
    details.push(
      `${workflowStatusLabel(oldStatus)} → ${workflowStatusLabel(newStatus)}`
    );
  } else if (newStatus) {
    details.push(`Status: ${workflowStatusLabel(newStatus)}`);
  }

  const assignedDeveloper =
    typeof newValue?.assigned_developer_name === 'string'
      ? newValue.assigned_developer_name
      : null;
  const assignedHm =
    typeof newValue?.assigned_hm_name === 'string' ? newValue.assigned_hm_name : null;
  const approvedBy =
    typeof newValue?.approved_by_name === 'string' ? newValue.approved_by_name : null;
  const testResult =
    typeof newValue?.test_result === 'string' ? newValue.test_result : null;
  if (assignedDeveloper) details.push(`Developer: ${assignedDeveloper}`);
  if (assignedHm) details.push(`HM: ${assignedHm}`);
  if (approvedBy) details.push(`PD: ${approvedBy}`);
  if (testResult) details.push(`Test: ${testResult}`);

  return details.length > 0 ? details.join(' · ') : null;
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
  const [history, setHistory] = useState<EntityLifecycleHistoryEvent[]>([]);

  const sortedHistory = useMemo(
    () => [...history].sort(
      (a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime()
    ),
    [history]
  );
  const visibleHistory = useMemo(
    () => sortedHistory.filter((entry) => entry.action !== 'STATUS_CHANGED'),
    [sortedHistory]
  );

  const loadHistory = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const records = (await api.entities.getLifecycleHistory(entityType, entityPk)).data;
      setHistory(records ?? []);
    } catch {
      // Keep the history control useful against older backends while the
      // unified lifecycle endpoint is being rolled out.
      try {
        const entity = await resolveEntity(entityType, entityPk);
        if (!entity) {
          setHistory([]);
          setError('No linked entity record found for this item.');
          return;
        }
        const records = (await api.entities.getStatusHistory(entity.id)).data;
        const fallback = buildHistoryWithInitialFallback(records, entity);
        setHistory(
          fallback.map((entry) => ({
            id: String(entry.id),
            occurred_at: entry.changed_at,
            actor_user_id: entry.changed_by || null,
            actor_role: 'SYSTEM',
            action: entry.synthetic ? 'CREATED' : 'STATUS_CHANGED',
            action_label: entry.synthetic ? 'Created' : 'Status Changed',
            entity_type: entityType,
            entity_id: String(entityPk),
            old_value: null,
            new_value: { status: resolveHistoryStatusName(entry, statuses, entity) },
            remarks: entry.notes,
          }))
        );
      } catch {
        setHistory([]);
        setError('Failed to load lifecycle history.');
      }
    } finally {
      setLoading(false);
    }
  }, [entityType, entityPk, statuses]);

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
          <SheetTitle>Lifecycle History</SheetTitle>
          <SheetDescription>
            Status, ownership, inventory, and verification changes for {entityName}
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
          ) : visibleHistory.length === 0 ? (
            <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
              No status history recorded yet.
            </div>
          ) : (
            <ScrollArea className="flex-1 pr-3">
              <ol className="relative space-y-0 border-l border-border pl-5">
                {visibleHistory.map((entry, index) => {
                  const isCurrent = index === 0;
                  const isInitial = index === visibleHistory.length - 1;
                  const statusValue =
                    typeof entry.new_value?.status === 'string'
                      ? entry.new_value.status
                      : null;
                  const actor =
                    entry.actor_username ||
                    (entry.actor_user_id ? `User #${entry.actor_user_id}` : 'System');
                  const role = WORKFLOW_AUDIT_ROLE_LABELS[entry.actor_role] || entry.actor_role;
                  const details = formatEventDetails(entry);

                  return (
                    <li key={`${entry.id}-${entry.occurred_at}`} className="relative pb-6 last:pb-0">
                      <span
                        className="absolute -left-[1.3rem] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-background bg-primary"
                        aria-hidden
                      />
                      <div className="space-y-1.5">
                        <div className="flex flex-wrap items-center gap-2">
                          {statusValue ? <StatusBadge status={statusValue} /> : null}
                          <span className="text-sm font-medium">
                            {entry.action_label ||
                              WORKFLOW_AUDIT_ACTION_LABELS[entry.action] ||
                              entry.action}
                          </span>
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
                          {actor} · {role} · {formatChangedAt(entry.occurred_at)}
                        </p>
                        {details ? (
                          <p className="text-xs text-foreground/80">{details}</p>
                        ) : null}
                        {entry.remarks ? (
                          <p className="text-xs text-muted-foreground">{entry.remarks}</p>
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

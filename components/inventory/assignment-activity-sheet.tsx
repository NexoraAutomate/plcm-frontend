'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import * as api from '@/lib/api';
import {
  WORKFLOW_AUDIT_ACTION_LABELS,
  WORKFLOW_AUDIT_ROLE_LABELS,
  type DeveloperAssignedWork,
  type EntityLifecycleHistoryEvent,
} from '@/lib/models';
import { workflowStatusLabel } from '@/lib/workflow-status';
import { cn } from '@/lib/utils';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { StatusBadge } from '@/components/status-badge';

interface AssignmentActivitySheetProps {
  row: DeveloperAssignedWork | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function formatWhen(value?: string | null) {
  if (!value) return '—';
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
    details.push(`${workflowStatusLabel(oldStatus)} → ${workflowStatusLabel(newStatus)}`);
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

export function AssignmentActivitySheet({
  row,
  open,
  onOpenChange,
}: AssignmentActivitySheetProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<EntityLifecycleHistoryEvent[]>([]);

  const load = useCallback(async () => {
    if (!row) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.entities.getLifecycleHistory(row.entity_type, row.entity_id);
      setHistory(res.data ?? []);
    } catch {
      setHistory([]);
      setError('Failed to load activity for this assignment.');
    } finally {
      setLoading(false);
    }
  }, [row]);

  useEffect(() => {
    if (open && row) void load();
    if (!open) {
      setHistory([]);
      setError(null);
    }
  }, [open, row, load]);

  const steps = useMemo(() => {
    const sorted = [...history].sort(
      (a, b) => new Date(a.occurred_at).getTime() - new Date(b.occurred_at).getTime()
    );
    return sorted.filter((entry) => entry.action !== 'STATUS_CHANGED');
  }, [history]);

  const title = row?.name || (row ? `${row.entity_type} #${row.entity_id}` : 'Assignment');

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-lg"
      >
        <SheetHeader className="border-b px-4 py-4 pr-12 text-left">
          <SheetTitle className="text-lg">Assignment activity</SheetTitle>
          <SheetDescription>
            Step-by-step record of who acted on {title}, and when.
          </SheetDescription>
          {row ? (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {row.customer_name ? (
                <Badge variant="outline" className="text-[10px]">
                  {row.customer_name}
                </Badge>
              ) : null}
              {row.flight_name ? (
                <Badge variant="outline" className="text-[10px]">
                  Flight {row.flight_name}
                </Badge>
              ) : null}
              {row.system_name ? (
                <Badge variant="outline" className="text-[10px]">
                  System {row.system_name}
                </Badge>
              ) : null}
              {row.project_name ? (
                <Badge variant="secondary" className="text-[10px]">
                  {row.project_name}
                </Badge>
              ) : null}
              {row.assigned_hm_name ? (
                <Badge variant="outline" className="text-[10px]">
                  HM {row.assigned_hm_name}
                </Badge>
              ) : null}
            </div>
          ) : null}
        </SheetHeader>

        <div className="min-h-0 flex-1 px-4 py-4">
          {loading ? (
            <div className="flex h-full items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading activity…
            </div>
          ) : error ? (
            <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
              {error}
            </p>
          ) : steps.length === 0 ? (
            <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
              No workflow activity recorded for this item yet.
            </p>
          ) : (
            <ScrollArea className="h-full pr-3">
              <ol className="relative space-y-0 border-l border-border pl-5">
                {steps.map((entry, index) => {
                  const isLatest = index === steps.length - 1;
                  const actor =
                    entry.actor_username ||
                    (entry.actor_user_id ? `User #${entry.actor_user_id}` : 'System');
                  const role =
                    WORKFLOW_AUDIT_ROLE_LABELS[entry.actor_role] || entry.actor_role;
                  const details = formatEventDetails(entry);
                  const statusValue =
                    typeof entry.new_value?.status === 'string'
                      ? entry.new_value.status
                      : null;

                  return (
                    <li
                      key={`${entry.id}-${entry.occurred_at}-${index}`}
                      className="relative pb-6 last:pb-0"
                    >
                      <span
                        className={cn(
                          'absolute -left-[1.3rem] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-background',
                          isLatest ? 'bg-primary' : 'bg-muted-foreground/50'
                        )}
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
                          {isLatest ? (
                            <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                              Latest
                            </span>
                          ) : null}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          By {actor}
                          {role ? ` · ${role}` : ''} · {formatWhen(entry.occurred_at)}
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

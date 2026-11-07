'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import * as api from '@/lib/api';
import type { AssignmentActivity, DeveloperAssignedWork } from '@/lib/models';
import { WORKFLOW_AUDIT_ROLE_LABELS } from '@/lib/models';
import { cn } from '@/lib/utils';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
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

function roleLabel(role?: string | null) {
  if (!role) return null;
  return WORKFLOW_AUDIT_ROLE_LABELS[role] || role;
}

function stepTone(step: string): string {
  switch (step) {
    case 'hm_verified':
    case 'test_passed':
      return 'border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200';
    case 'test_failed':
    case 'hm_rejected':
    case 'marked_back':
    case 'defect_pending':
      return 'border-rose-300 bg-rose-50 text-rose-800 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-200';
    case 'complete_reported':
    case 'handover_requested':
      return 'border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100';
    case 'issued':
    case 'reissued':
    case 'install_started':
      return 'border-blue-300 bg-blue-50 text-blue-800 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-200';
    case 'assigned':
    case 'reserved':
      return 'border-sky-300 bg-sky-50 text-sky-800 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-200';
    default:
      return 'border-border bg-muted/40 text-foreground';
  }
}

export function AssignmentActivitySheet({
  row,
  open,
  onOpenChange,
}: AssignmentActivitySheetProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activity, setActivity] = useState<AssignmentActivity | null>(null);

  const load = useCallback(async () => {
    if (!row) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.inventory.getAssignmentActivity(row.entity_type, row.entity_id);
      setActivity(res.data);
    } catch {
      setActivity(null);
      setError('Failed to load workflow activity for this item.');
    } finally {
      setLoading(false);
    }
  }, [row]);

  useEffect(() => {
    if (open && row) void load();
    if (!open) {
      setActivity(null);
      setError(null);
    }
  }, [open, row, load]);

  const title =
    activity?.entity_name ||
    row?.name ||
    (row ? `${row.entity_type} #${row.entity_id}` : 'Assignment');
  const steps = activity?.steps ?? [];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className={cn(
          'flex h-full w-full max-w-lg flex-col gap-0 overflow-hidden p-0 sm:max-w-lg',
          'data-[state=open]:duration-300 data-[state=closed]:duration-200'
        )}
      >
        <SheetHeader className="shrink-0 space-y-1 border-b px-4 py-4 pr-12 text-left">
          <SheetTitle className="text-lg">Item workflow</SheetTitle>
          <SheetDescription>
            Who acted on {title}, when, and the current status for this assignment only.
          </SheetDescription>
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            {activity?.current_status ? (
              <StatusBadge status={activity.current_status} />
            ) : null}
            <Badge variant="secondary" className="text-[10px]">
              {activity?.current_status_label || row?.item_status || 'Loading…'}
            </Badge>
            {activity?.assigned_developer_name ? (
              <Badge variant="outline" className="text-[10px]">
                Dev {activity.assigned_developer_name}
              </Badge>
            ) : null}
            {row?.assigned_hm_name ? (
              <Badge variant="outline" className="text-[10px]">
                HM {row.assigned_hm_name}
              </Badge>
            ) : null}
          </div>
        </SheetHeader>

        <div className="min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4">
          {loading ? (
            <div className="flex min-h-40 items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading workflow…
            </div>
          ) : error ? (
            <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
              {error}
            </p>
          ) : steps.length === 0 ? (
            <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
              No assignment workflow activity recorded for this item yet.
            </p>
          ) : (
            <ol className="relative min-w-0 space-y-0 border-l border-border pl-5">
              {steps.map((entry, index) => {
                const isLatest = index === steps.length - 1;
                const actor = entry.actor_name || (entry.actor_user_id ? `User #${entry.actor_user_id}` : 'System');
                const role = roleLabel(entry.actor_role);

                return (
                  <li key={entry.id} className="relative pb-6 last:pb-0">
                    <span
                      className={cn(
                        'absolute -left-[1.3rem] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-background',
                        isLatest ? 'bg-primary' : 'bg-muted-foreground/50'
                      )}
                      aria-hidden
                    />
                    <div className="min-w-0 space-y-1.5 break-words">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={cn(
                            'inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-medium',
                            stepTone(entry.step)
                          )}
                        >
                          {entry.title}
                        </span>
                        {isLatest ? (
                          <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                            Current
                          </span>
                        ) : null}
                      </div>
                      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
                        <dt className="text-muted-foreground">When</dt>
                        <dd>{formatWhen(entry.occurred_at)}</dd>
                        <dt className="text-muted-foreground">By</dt>
                        <dd>
                          {actor}
                          {role ? ` · ${role}` : ''}
                        </dd>
                        {entry.target_name ? (
                          <>
                            <dt className="text-muted-foreground">To</dt>
                            <dd>{entry.target_name}</dd>
                          </>
                        ) : null}
                        {entry.status ? (
                          <>
                            <dt className="text-muted-foreground">Status</dt>
                            <dd>
                              <StatusBadge status={entry.status} className="text-[10px]" />
                            </dd>
                          </>
                        ) : null}
                      </dl>
                      {entry.remarks ? (
                        <p className="text-xs text-muted-foreground">{entry.remarks}</p>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

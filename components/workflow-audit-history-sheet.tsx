'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
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
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import * as api from '@/lib/api';
import {
  WORKFLOW_AUDIT_ACTION_LABELS,
  WORKFLOW_AUDIT_ROLE_LABELS,
  type WorkflowAuditEvent,
} from '@/lib/models';
import { Can } from '@/components/auth';
import { P } from '@/lib/permission-codes';

interface WorkflowAuditHistorySheetProps {
  entityType?: string;
  entityId?: string | number;
  projectId?: number | null;
  trigger?: ReactNode;
}

function formatDateTime(value?: string | null) {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

export function WorkflowAuditHistorySheet({
  entityType,
  entityId,
  projectId,
  trigger,
}: WorkflowAuditHistorySheetProps) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<WorkflowAuditEvent[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.auditTrail.list(
        0,
        50,
        projectId
          ? { project_id: projectId }
          : {
              entity_type: entityType,
              entity_id: entityId != null ? String(entityId) : undefined,
            }
      );
      setRows(res.data ?? []);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [entityType, entityId, projectId]);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  return (
    <Can permission={P.audit_read}>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          {trigger ?? (
            <Button variant="outline" className="w-full">
              <History className="mr-2 h-4 w-4" />
              History
            </Button>
          )}
        </SheetTrigger>
        <SheetContent className="flex w-full flex-col sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Audit history</SheetTitle>
            <SheetDescription>
              {projectId
                ? `Reconstructable status changes for project ${projectId}.`
                : 'Reconstructable status changes for this entity.'}
            </SheetDescription>
          </SheetHeader>
          <ScrollArea className="mt-4 flex-1 pr-4">
            {loading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading…
              </div>
            ) : rows.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {projectId
                  ? 'No audit events for this project yet.'
                  : 'No audit events for this entity.'}
              </p>
            ) : (
              <ol className="space-y-3">
                {rows.map((row) => (
                  <li key={row.id} className="rounded-md border p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium">
                        {row.action_label || WORKFLOW_AUDIT_ACTION_LABELS[row.action] || row.action}
                      </p>
                      <Badge variant="outline" className="text-[10px]">
                        {WORKFLOW_AUDIT_ROLE_LABELS[row.actor_role] || row.actor_role}
                      </Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {row.actor_username || row.actor_user_id} · {formatDateTime(row.occurred_at)}
                    </p>
                    {row.remarks ? (
                      <p className="mt-1 text-xs">{row.remarks}</p>
                    ) : null}
                  </li>
                ))}
              </ol>
            )}
          </ScrollArea>
        </SheetContent>
      </Sheet>
    </Can>
  );
}

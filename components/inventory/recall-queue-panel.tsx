'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import * as api from '@/lib/api';
import type { InventoryRecallTask } from '@/lib/models';
import { parseApiDate } from '@/lib/parse-api-date';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ListContentSuspense } from '@/components/list-content-suspense';
import { StatusBadge } from '@/components/status-badge';
import { Can } from '@/components/auth';
import { P } from '@/lib/permission-codes';

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

function apiError(error: unknown, fallback: string) {
  const detail =
    (error as { response?: { data?: { detail?: string } } })?.response?.data?.detail || fallback;
  return typeof detail === 'string' ? detail : fallback;
}

type RecallAction = 'inspect' | 'disposition' | 'force';

type Props = {
  mine?: boolean;
};

export function RecallQueuePanel({ mine = false }: Props) {
  const [rows, setRows] = useState<InventoryRecallTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<InventoryRecallTask | null>(null);
  const [action, setAction] = useState<RecallAction | null>(null);
  const [outcome, setOutcome] = useState<'repairable' | 'reusable' | 'scrapped'>('reusable');
  const [submitting, setSubmitting] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.inventory.listRecallTasks({ mine: mine || undefined });
      setRows(res.data ?? []);
    } catch {
      toast.error('Failed to load recall queue');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [mine]);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => void refresh(), 12_000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  function openAction(row: InventoryRecallTask, next: RecallAction) {
    setOutcome('reusable');
    setSelected(row);
    setAction(next);
  }

  async function handleSubmit() {
    if (!selected || !action) return;
    setSubmitting(true);
    try {
      if (action === 'inspect') {
        await api.inventory.inspectRecallItem(selected.id);
        toast.success('Inspection started');
      } else if (action === 'disposition') {
        await api.inventory.dispositionRecallItem(selected.id, { outcome });
        toast.success(`Disposition: ${outcome}`);
      } else {
        await api.inventory.forceReturnRecallItem(selected.id);
        toast.success('Force-returned — IM can start inspection');
      }
      setSelected(null);
      setAction(null);
      await refresh();
    } catch (error: unknown) {
      toast.error(apiError(error, 'Recall action failed'));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeveloperReturn(row: InventoryRecallTask) {
    setSubmitting(true);
    try {
      await api.inventory.returnRecallItem(row.id);
      toast.success('Return recorded — IM will inspect');
      await refresh();
    } catch (error: unknown) {
      toast.error(apiError(error, 'Return failed'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <ListContentSuspense loading={loading && rows.length === 0}>
        {rows.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No open recall tasks.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item</TableHead>
                <TableHead>Serial</TableHead>
                <TableHead>Project</TableHead>
                <TableHead>Stage</TableHead>
                <TableHead>Developer</TableHead>
                <TableHead>Updated</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>
                    <div className="font-medium">
                      {row.target_entity_name ||
                        `${row.target_entity_type || 'item'} #${row.target_entity_id ?? row.id}`}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {row.inventory_name || row.part_number || '—'}
                    </div>
                  </TableCell>
                  <TableCell>{row.serial_number || '—'}</TableCell>
                  <TableCell>{row.project_name || `#${row.project_id}`}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {row.item_status ? <StatusBadge status={row.item_status} /> : null}
                      <Badge variant="outline">{row.stage}</Badge>
                      {row.forced_return ? <Badge variant="secondary">Forced</Badge> : null}
                    </div>
                  </TableCell>
                  <TableCell>
                    {row.assigned_developer_name ||
                      (row.assigned_developer_id ? `#${row.assigned_developer_id}` : '—')}
                  </TableCell>
                  <TableCell>{formatWhen(row.updated_at)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex flex-wrap justify-end gap-1">
                      {mine && row.can_return ? (
                        <Can permission={P.item_install_test}>
                          <Button
                            size="sm"
                            onClick={() => void handleDeveloperReturn(row)}
                            disabled={submitting}
                          >
                            Confirm return
                          </Button>
                        </Can>
                      ) : null}
                      {!mine && row.can_return ? (
                        <Can permission={P.project_cancel}>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openAction(row, 'force')}
                          >
                            Force return
                          </Button>
                        </Can>
                      ) : null}
                      <Can permission={P.item_inspect}>
                        {row.can_inspect ? (
                          <Button size="sm" onClick={() => openAction(row, 'inspect')}>
                            Start inspect
                          </Button>
                        ) : null}
                        {row.can_disposition ? (
                          <Button size="sm" onClick={() => openAction(row, 'disposition')}>
                            Disposition
                          </Button>
                        ) : null}
                      </Can>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </ListContentSuspense>

      <Dialog
        open={selected != null && action != null}
        onOpenChange={(open) => {
          if (!open) {
            setSelected(null);
            setAction(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {action === 'inspect'
                ? 'Start inspection'
                : action === 'disposition'
                  ? 'Disposition returned unit'
                  : 'Force-return unrecovered unit'}
            </DialogTitle>
            <DialogDescription>
              {action === 'force'
                ? 'Use only if the developer is unresponsive. This attests that custody is recovered; IM still inspects.'
                : 'Reusable returns to Available. Repairable stays in repair. Scrapped never returns without a new serial.'}
            </DialogDescription>
          </DialogHeader>
          {selected ? (
            <div className="space-y-4">
              <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm">
                <div className="font-medium">
                  {selected.inventory_name || selected.target_entity_name}
                </div>
                <div className="text-muted-foreground">
                  {selected.serial_number || selected.part_number || '—'}
                </div>
              </div>
              {action === 'disposition' ? (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Outcome</label>
                  <select
                    className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                    value={outcome}
                    onChange={(event) =>
                      setOutcome(event.target.value as 'repairable' | 'reusable' | 'scrapped')
                    }
                    disabled={submitting}
                  >
                    <option value="reusable">Reusable (back to stock)</option>
                    <option value="repairable">Repairable (sent to repair)</option>
                    <option value="scrapped">Scrapped (not usable)</option>
                  </select>
                </div>
              ) : null}
            </div>
          ) : null}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setSelected(null);
                setAction(null);
              }}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button onClick={() => void handleSubmit()} disabled={submitting || !selected}>
              {submitting ? 'Saving…' : 'Confirm'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

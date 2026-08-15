'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import * as api from '@/lib/api';
import type { InventoryInstance, ItemReworkCase } from '@/lib/models';
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
import {
  IssueSignatureFields,
  useIssueSignature,
} from '@/components/inventory/issue-signature-fields';
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

type InspectAction = 'inspect' | 'disposition' | 'repair' | 'reissue';

export function InspectQueuePanel() {
  const [rows, setRows] = useState<ItemReworkCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<ItemReworkCase | null>(null);
  const [action, setAction] = useState<InspectAction | null>(null);
  const [outcome, setOutcome] = useState<'repairable' | 'reusable' | 'scrapped'>('repairable');
  const [replacementId, setReplacementId] = useState<number | null>(null);
  const [instances, setInstances] = useState<InventoryInstance[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const signature = useIssueSignature();

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.inventory.listReworkCases();
      setRows(res.data ?? []);
    } catch {
      toast.error('Failed to load inspect queue');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => void refresh(), 12_000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  useEffect(() => {
    if (action !== 'reissue' || !selected) {
      setInstances([]);
      return;
    }
    void api.inventory
      .listInstances(selected.inventory_id)
      .then((res) => setInstances(res.data ?? []))
      .catch(() => setInstances([]));
  }, [action, selected]);

  function openAction(row: ItemReworkCase, next: InspectAction) {
    signature.reset();
    setOutcome('repairable');
    setReplacementId(null);
    setSelected(row);
    setAction(next);
  }

  async function handleSubmit() {
    if (!selected || !action) return;
    setSubmitting(true);
    try {
      if (action === 'inspect') {
        await api.inventory.inspectReworkItem(selected.id);
        toast.success('Inspection started');
      } else if (action === 'disposition') {
        await api.inventory.dispositionReworkItem(selected.id, { outcome });
        toast.success(`Disposition: ${outcome}`);
      } else if (action === 'repair') {
        await api.inventory.repairCompleteReworkItem(selected.id);
        toast.success('Repair marked complete');
      } else {
        const signed = signature.payload();
        if (!signed) {
          toast.error('Signature is required to issue');
          return;
        }
        const needsReplacement = selected.stage === 'scrapped' || selected.stage === 'reusable';
        if (needsReplacement && !replacementId) {
          toast.error('Select a replacement serial');
          return;
        }
        await api.inventory.reissueReworkItem(selected.id, {
          ...signed,
          replacement_instance_id: needsReplacement ? replacementId : null,
        });
        toast.success('Item re-issued to developer');
      }
      setSelected(null);
      setAction(null);
      await refresh();
    } catch (error: unknown) {
      toast.error(apiError(error, 'Inspect action failed'));
    } finally {
      setSubmitting(false);
    }
  }

  const availableReplacements = instances.filter(
    (row) =>
      row.id !== selected?.current_instance_id &&
      (row.status_name || '').toUpperCase() === 'AVAILABLE'
  );

  return (
    <>
      <ListContentSuspense loading={loading && rows.length === 0}>
        {rows.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No open rework cases.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item</TableHead>
                <TableHead>Serial</TableHead>
                <TableHead>Stage</TableHead>
                <TableHead>Attempt</TableHead>
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
                      {row.target_entity_name || `${row.target_entity_type} #${row.target_entity_id}`}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {row.inventory_name || row.part_number || '—'}
                    </div>
                  </TableCell>
                  <TableCell>{row.serial_number || '—'}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {row.item_status ? <StatusBadge status={row.item_status} /> : null}
                      <Badge variant="outline">{row.stage}</Badge>
                      {row.cycle_warning ? (
                        <Badge variant="destructive">Cycle warning</Badge>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell>{row.attempt_count}</TableCell>
                  <TableCell>
                    {row.assigned_developer_name || (row.assigned_developer_id ? `#${row.assigned_developer_id}` : '—')}
                  </TableCell>
                  <TableCell>{formatWhen(row.updated_at)}</TableCell>
                  <TableCell className="text-right">
                    <Can permission={P.item_inspect}>
                      <div className="flex flex-wrap justify-end gap-1">
                        {row.stage === 'returned' ? (
                          <Button size="sm" onClick={() => openAction(row, 'inspect')}>
                            Start inspect
                          </Button>
                        ) : null}
                        {row.stage === 'inspection' ? (
                          <Button size="sm" onClick={() => openAction(row, 'disposition')}>
                            Disposition
                          </Button>
                        ) : null}
                        {row.stage === 'repairable' && !row.repaired_at ? (
                          <Button size="sm" onClick={() => openAction(row, 'repair')}>
                            Mark repaired
                          </Button>
                        ) : null}
                        {row.stage === 'repairable' && row.repaired_at ? (
                          <Button size="sm" onClick={() => openAction(row, 'reissue')}>
                            Re-issue
                          </Button>
                        ) : null}
                        {row.stage === 'scrapped' || row.stage === 'reusable' ? (
                          <Button size="sm" onClick={() => openAction(row, 'reissue')}>
                            Issue replacement
                          </Button>
                        ) : null}
                      </div>
                    </Can>
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
                  : action === 'repair'
                    ? 'Mark repaired'
                    : 'Re-issue with signature'}
            </DialogTitle>
            <DialogDescription>
              {action === 'reissue'
                ? 'Signature is required. Repair re-issues the same serial; replace issues a new serial.'
                : 'Update the rework case for this returned unit.'}
            </DialogDescription>
          </DialogHeader>
          {selected ? (
            <div className="space-y-4">
              <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm">
                <div className="font-medium">{selected.inventory_name || selected.target_entity_name}</div>
                <div className="text-muted-foreground">
                  {selected.serial_number || selected.part_number || '—'} · attempt {selected.attempt_count}
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
                    <option value="repairable">Repairable (same serial)</option>
                    <option value="reusable">Reusable (return to stock)</option>
                    <option value="scrapped">Scrapped</option>
                  </select>
                </div>
              ) : null}
              {action === 'reissue' && (selected.stage === 'scrapped' || selected.stage === 'reusable') ? (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Replacement serial</label>
                  <select
                    className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                    value={replacementId ?? ''}
                    onChange={(event) =>
                      setReplacementId(event.target.value ? Number(event.target.value) : null)
                    }
                    disabled={submitting}
                  >
                    <option value="">Select available serial</option>
                    {availableReplacements.map((row) => (
                      <option key={row.id} value={row.id}>
                        {row.serial_number || `Instance #${row.id}`}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}
              {action === 'reissue' ? (
                <IssueSignatureFields
                  signatureType={signature.signatureType}
                  onSignatureTypeChange={signature.setSignatureType}
                  digitalPayload={signature.digitalPayload}
                  onDigitalPayloadChange={signature.setDigitalPayload}
                  hardCopyAck={signature.hardCopyAck}
                  onHardCopyAckChange={signature.setHardCopyAck}
                  disabled={submitting}
                />
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

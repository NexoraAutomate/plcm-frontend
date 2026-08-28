'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import * as api from '@/lib/api';
import type { DeveloperAssignedWork } from '@/lib/models';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ListContentSuspense } from '@/components/list-content-suspense';
import { StatusBadge } from '@/components/status-badge';
import { WorkflowCan } from '@/components/auth';
import { P } from '@/lib/permission-codes';
import { ReworkWizardDialog, type ReworkWizardTarget } from '@/components/inventory/rework-wizard-dialog';
import { usePageDataRefresh } from '@/components/page-data-refresh';

function rowKey(row: DeveloperAssignedWork) {
  return `${row.entity_type}:${row.entity_id}`;
}

function requestLabel(row: DeveloperAssignedWork) {
  if (row.verified) return 'Verified';
  if (row.rework_stage) return `Rework — ${row.rework_stage}`;
  if (row.defect_pending) return 'Fail — rework';
  if (row.complete_reported) return 'Waiting for HM verify';
  if (row.issued) return 'Issued';
  if (row.request_status === 'pending') return 'Requested';
  if (row.reserved) return 'Reserved';
  return 'Assigned';
}

function apiError(error: unknown, fallback: string) {
  const detail =
    (error as { response?: { data?: { detail?: string } } })?.response?.data?.detail || fallback;
  return typeof detail === 'string' ? detail : fallback;
}

export function MyAssignmentsPanel() {
  const [rows, setRows] = useState<DeveloperAssignedWork[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [submitting, setSubmitting] = useState(false);
  const [reworkTarget, setReworkTarget] = useState<ReworkWizardTarget | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.inventory.listMyAssignments();
      setRows(res.data ?? []);
    } catch {
      toast.error('Failed to load assigned items');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  usePageDataRefresh(refresh);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const selectedRows = useMemo(
    () => rows.filter((row) => selected[rowKey(row)]),
    [rows, selected]
  );
  const requestable = rows.filter((row) => row.can_request);
  const reservedCount = rows.filter((row) => row.reserved && !row.issued).length;

  async function requestBulk(
    mode: 'all' | 'reserved' | 'selected',
    items?: Array<{ entity_type: string; entity_id: number }>
  ) {
    setSubmitting(true);
    try {
      const res = await api.inventory.createItemRequestsBulk({ mode, items });
      const created = res.data.created?.length ?? 0;
      const skipped = res.data.skipped?.length ?? 0;
      if (created === 0 && skipped === 0) {
        toast.message('No items were ready to request');
      } else {
        toast.success(
          `Requested ${created} item${created === 1 ? '' : 's'}${
            skipped ? ` · ${skipped} skipped` : ''
          }`
        );
      }
      setSelected({});
      await refresh();
    } catch (error: unknown) {
      toast.error(apiError(error, 'Request failed'));
    } finally {
      setSubmitting(false);
    }
  }

  async function requestOne(row: DeveloperAssignedWork) {
    setSubmitting(true);
    try {
      await api.inventory.createItemRequest({
        entity_type: row.entity_type,
        entity_id: row.entity_id,
      });
      toast.success('Handover requested from Inventory Manager');
      await refresh();
    } catch (error: unknown) {
      toast.error(apiError(error, 'Request failed'));
    } finally {
      setSubmitting(false);
    }
  }

  async function startInstall(row: DeveloperAssignedWork) {
    setSubmitting(true);
    try {
      await api.inventory.startItemInstall(row.entity_type, row.entity_id);
      toast.success('Installation started');
      await refresh();
    } catch (error: unknown) {
      toast.error(apiError(error, 'Could not start install'));
    } finally {
      setSubmitting(false);
    }
  }

  async function submitTest(row: DeveloperAssignedWork, result: 'pass' | 'fail') {
    if (result === 'fail') {
      setReworkTarget({
        entityType: row.entity_type,
        entityId: row.entity_id,
        name: row.name,
        serialNumber: row.serial_number,
        reworkId: row.rework_id,
        needsFail: true,
        canRemove: Boolean(row.can_remove),
        canReturn: Boolean(row.can_return),
        attemptCount: row.rework_attempt_count,
        stage: row.rework_stage,
      });
      return;
    }
    setSubmitting(true);
    try {
      await api.inventory.submitItemTest(row.entity_type, row.entity_id, { result });
      toast.success(result === 'pass' ? 'Test recorded as Pass' : 'Test recorded as Fail');
      await refresh();
    } catch (error: unknown) {
      toast.error(apiError(error, 'Could not record test'));
    } finally {
      setSubmitting(false);
    }
  }

  async function reportComplete(row: DeveloperAssignedWork) {
    setSubmitting(true);
    try {
      await api.inventory.reportItemComplete(row.entity_type, row.entity_id);
      toast.success('Installation complete reported — waiting for HM verify');
      await refresh();
    } catch (error: unknown) {
      toast.error(apiError(error, 'Could not report complete'));
    } finally {
      setSubmitting(false);
    }
  }

  const allRequestableSelected =
    requestable.length > 0 && requestable.every((row) => selected[rowKey(row)]);

  return (
    <>
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="outline"
          disabled={submitting || selectedRows.length === 0}
          onClick={() =>
            void requestBulk(
              'selected',
              selectedRows.map((row) => ({
                entity_type: row.entity_type,
                entity_id: row.entity_id,
              }))
            )
          }
        >
          Request selected
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={submitting || reservedCount === 0}
          onClick={() => void requestBulk('reserved')}
        >
          Request reserved only
        </Button>
        <Button
          size="sm"
          disabled={submitting || requestable.length === 0}
          onClick={() => void requestBulk('all')}
        >
          Request all
        </Button>
      </div>
      <ListContentSuspense loading={loading}>
        {rows.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No hierarchy items have been assigned to you yet.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    checked={allRequestableSelected}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        const next: Record<string, boolean> = {};
                        for (const row of requestable) next[rowKey(row)] = true;
                        setSelected(next);
                      } else {
                        setSelected({});
                      }
                    }}
                    aria-label="Select all requestable items"
                  />
                </TableHead>
                <TableHead>Item</TableHead>
                <TableHead>Project</TableHead>
                <TableHead>Serial</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => {
                const key = rowKey(row);
                return (
                  <TableRow key={key}>
                    <TableCell>
                      <Checkbox
                        checked={Boolean(selected[key])}
                        disabled={!row.can_request}
                        onCheckedChange={(checked) =>
                          setSelected((prev) => ({ ...prev, [key]: Boolean(checked) }))
                        }
                        aria-label={`Select ${row.name || row.entity_type}`}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">
                        {row.name || `${row.entity_type} #${row.entity_id}`}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {row.entity_type}
                        {row.part_number ? ` · ${row.part_number}` : ''}
                      </div>
                    </TableCell>
                    <TableCell>{row.project_name || '—'}</TableCell>
                    <TableCell>{row.serial_number || '—'}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {row.item_status ? (
                          <StatusBadge status={row.item_status} />
                        ) : row.issued ? (
                          <StatusBadge status="ISSUED" />
                        ) : (
                          <StatusBadge status="Assigned" />
                        )}
                        {row.reserved && !row.issued ? (
                          <Badge variant="secondary">Reserved</Badge>
                        ) : null}
                        {row.request_status === 'pending' ? (
                          <Badge variant="outline">Requested</Badge>
                        ) : null}
                        {row.test_result === 'pass' && !row.verified ? (
                          <Badge variant="outline">Pass</Badge>
                        ) : null}
                        {row.defect_pending ? (
                          <Badge variant="destructive">Fail</Badge>
                        ) : null}
                        {row.rework_stage ? (
                          <Badge variant="outline">
                            Attempt {row.rework_attempt_count || 1} · {row.rework_stage}
                          </Badge>
                        ) : null}
                        {row.complete_reported && !row.verified ? (
                          <Badge variant="secondary">Complete reported</Badge>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      {row.can_request ? (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={submitting}
                          onClick={() => void requestOne(row)}
                        >
                          Request handover
                        </Button>
                      ) : (
                        <WorkflowCan
                          role="DEV"
                          permission={P.item_install_test}
                          fallback={
                            <span className="text-xs text-muted-foreground">
                              {requestLabel(row)}
                            </span>
                          }
                        >
                          <div className="flex flex-wrap justify-end gap-1">
                            {row.can_install ? (
                              <Button
                                size="sm"
                                disabled={submitting}
                                onClick={() => void startInstall(row)}
                              >
                                Start install
                              </Button>
                            ) : null}
                            {row.can_test ? (
                              <>
                                <Button
                                  size="sm"
                                  disabled={submitting}
                                  onClick={() => void submitTest(row, 'pass')}
                                >
                                  Pass
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  disabled={submitting}
                                  onClick={() => void submitTest(row, 'fail')}
                                >
                                  Fail
                                </Button>
                              </>
                            ) : null}
                            {row.can_report_complete ? (
                              <Button
                                size="sm"
                                disabled={submitting}
                                onClick={() => void reportComplete(row)}
                              >
                                Report complete
                              </Button>
                            ) : null}
                            {row.can_remove || row.can_return ? (
                              <Button
                                size="sm"
                                variant="destructive"
                                disabled={submitting}
                                onClick={() =>
                                  setReworkTarget({
                                    entityType: row.entity_type,
                                    entityId: row.entity_id,
                                    name: row.name,
                                    serialNumber: row.serial_number,
                                    reworkId: row.rework_id,
                                    needsFail: false,
                                    canRemove: Boolean(row.can_remove),
                                    canReturn: Boolean(row.can_return),
                                    attemptCount: row.rework_attempt_count,
                                    stage: row.rework_stage,
                                  })
                                }
                              >
                                Continue rework
                              </Button>
                            ) : null}
                            {row.defect_pending && !row.can_remove && !row.can_return && !row.can_install && !row.can_test ? (
                              <span className="text-xs text-muted-foreground">
                                Waiting for IM inspect
                              </span>
                            ) : null}
                            {!row.can_install &&
                            !row.can_test &&
                            !row.can_report_complete &&
                            !row.can_remove &&
                            !row.can_return &&
                            !row.defect_pending ? (
                              <span className="text-xs text-muted-foreground">
                                {requestLabel(row)}
                              </span>
                            ) : null}
                          </div>
                        </WorkflowCan>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </ListContentSuspense>
    </div>
    <ReworkWizardDialog
      target={reworkTarget}
      open={reworkTarget != null}
      onOpenChange={(open) => {
        if (!open) setReworkTarget(null);
      }}
      onDone={() => {
        setReworkTarget(null);
        void refresh();
      }}
    />
    </>
  );
}

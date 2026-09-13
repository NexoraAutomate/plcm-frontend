'use client';

import { useCallback, useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import * as api from '@/lib/api';
import type { ItemInstallRejection, ItemInstallState } from '@/lib/models';
import { parseApiDate } from '@/lib/parse-api-date';
import { queryKeys } from '@/hooks/queries/query-keys';
import { Button } from '@/components/ui/button';
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
import { usePageDataRefresh } from '@/components/page-data-refresh';
import { RejectInstallationDialog } from '@/components/inventory/reject-installation-dialog';
import { RejectionReasonsDialog } from '@/components/inventory/rejection-reasons-dialog';

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

export function VerifyQueuePanel() {
  const queryClient = useQueryClient();
  const [rows, setRows] = useState<ItemInstallState[]>([]);
  const [loading, setLoading] = useState(true);
  const [submittingId, setSubmittingId] = useState<number | null>(null);
  const [rejectTarget, setRejectTarget] = useState<ItemInstallState | null>(null);
  const [rejectionView, setRejectionView] = useState<{
    label: string;
    history: ItemInstallRejection[];
  } | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.inventory.listItemVerifications();
      setRows(res.data ?? []);
    } catch {
      toast.error('Failed to load verification queue');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  usePageDataRefresh(refresh);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => void refresh(), 12_000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  async function invalidateProgress(row: ItemInstallState) {
    if (row.project_id) {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.projectProgress(row.project_id),
      });
    }
    await queryClient.invalidateQueries({ queryKey: ['projects'] });
  }

  async function handleAccept(row: ItemInstallState) {
    if (!row.complete_reported) {
      toast.error('Developer must report installation complete before accept');
      return;
    }
    setSubmittingId(row.issuance_id);
    try {
      await api.inventory.verifyItemInstallation(row.issuance_id);
      toast.success('Installation accepted');
      await invalidateProgress(row);
      await refresh();
    } catch (error: unknown) {
      const detail =
        (error as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail || 'Accept failed';
      toast.error(typeof detail === 'string' ? detail : 'Accept failed');
    } finally {
      setSubmittingId(null);
    }
  }

  async function handleRejectConfirm(reason: string) {
    if (!rejectTarget) return;
    const row = rejectTarget;
    setSubmittingId(row.issuance_id);
    try {
      await api.inventory.rejectItemInstallation(row.issuance_id, reason);
      toast.success('Installation rejected — returned to developer');
      setRejectTarget(null);
      await invalidateProgress(row);
      await refresh();
    } catch (error: unknown) {
      const detail =
        (error as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail || 'Reject failed';
      toast.error(typeof detail === 'string' ? detail : 'Reject failed');
    } finally {
      setSubmittingId(null);
    }
  }

  return (
    <>
      <ListContentSuspense loading={loading}>
        {rows.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No items are waiting for verification.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item</TableHead>
                <TableHead>Project</TableHead>
                <TableHead>Developer</TableHead>
                <TableHead>Serial</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Complete reported</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.issuance_id}>
                  <TableCell>
                    <div className="font-medium">
                      {row.entity_name || `${row.entity_type} #${row.entity_id}`}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {row.entity_type}
                      {row.part_number ? ` · ${row.part_number}` : ''}
                    </div>
                  </TableCell>
                  <TableCell>{row.project_name || '—'}</TableCell>
                  <TableCell>{row.assigned_developer_name || '—'}</TableCell>
                  <TableCell>{row.serial_number || '—'}</TableCell>
                  <TableCell>
                    <StatusBadge status={row.item_status || 'UNDER_TESTING_REVIEW'} />
                  </TableCell>
                  <TableCell>{formatWhen(row.complete_reported_at)}</TableCell>
                  <TableCell className="text-right">
                    <WorkflowCan role={['HM', 'ADMIN']} permission={P.item_verify}>
                      <div className="flex flex-wrap justify-end gap-1">
                        <Button
                          size="sm"
                          disabled={
                            submittingId === row.issuance_id || !row.complete_reported
                          }
                          onClick={() => void handleAccept(row)}
                        >
                          Accept
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          disabled={
                            submittingId === row.issuance_id || !row.complete_reported
                          }
                          onClick={() => setRejectTarget(row)}
                        >
                          Reject
                        </Button>
                        {(row.rejection_count ?? 0) > 0 ||
                        (row.rejection_history?.length ?? 0) > 0 ? (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={submittingId === row.issuance_id}
                            onClick={() =>
                              setRejectionView({
                                label:
                                  row.entity_name ||
                                  `${row.entity_type} #${row.entity_id}`,
                                history: row.rejection_history ?? [],
                              })
                            }
                          >
                            Rejection Reasons
                          </Button>
                        ) : null}
                      </div>
                    </WorkflowCan>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </ListContentSuspense>
      <RejectInstallationDialog
        open={rejectTarget != null}
        onOpenChange={(open) => {
          if (!open) setRejectTarget(null);
        }}
        itemLabel={
          rejectTarget
            ? rejectTarget.entity_name ||
              `${rejectTarget.entity_type} #${rejectTarget.entity_id}`
            : undefined
        }
        busy={rejectTarget != null && submittingId === rejectTarget.issuance_id}
        onConfirm={handleRejectConfirm}
      />
      <RejectionReasonsDialog
        open={rejectionView != null}
        onOpenChange={(open) => {
          if (!open) setRejectionView(null);
        }}
        itemLabel={rejectionView?.label}
        history={rejectionView?.history}
      />
    </>
  );
}

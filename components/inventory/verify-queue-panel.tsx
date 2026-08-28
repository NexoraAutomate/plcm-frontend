'use client';

import { useCallback, useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import * as api from '@/lib/api';
import type { ItemInstallState } from '@/lib/models';
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

  async function handleVerify(row: ItemInstallState) {
    if (!row.complete_reported) {
      toast.error('Developer must report installation complete before verify');
      return;
    }
    setSubmittingId(row.issuance_id);
    try {
      await api.inventory.verifyItemInstallation(row.issuance_id);
      toast.success('Installation verified');
      if (row.project_id) {
        await queryClient.invalidateQueries({
          queryKey: queryKeys.projectProgress(row.project_id),
        });
      }
      await queryClient.invalidateQueries({ queryKey: ['projects'] });
      await refresh();
    } catch (error: unknown) {
      const detail =
        (error as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail || 'Verify failed';
      toast.error(typeof detail === 'string' ? detail : 'Verify failed');
    } finally {
      setSubmittingId(null);
    }
  }

  return (
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
                    <Button
                      size="sm"
                      disabled={
                        submittingId === row.issuance_id || !row.complete_reported
                      }
                      onClick={() => void handleVerify(row)}
                    >
                      Verify
                    </Button>
                  </WorkflowCan>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </ListContentSuspense>
  );
}

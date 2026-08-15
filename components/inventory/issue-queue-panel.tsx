'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import * as api from '@/lib/api';
import type { ItemIssueRequest } from '@/lib/models';
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

export function IssueQueuePanel() {
  const [rows, setRows] = useState<ItemIssueRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<ItemIssueRequest | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const signature = useIssueSignature();

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.inventory.listItemRequests({ status: 'pending' });
      setRows(res.data ?? []);
    } catch {
      toast.error('Failed to load issue queue');
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

  async function handleIssue() {
    if (!selected) return;
    const signed = signature.payload();
    if (!signed) {
      toast.error('Signature is required to issue');
      return;
    }
    setSubmitting(true);
    try {
      await api.inventory.issueItemRequest(selected.id, signed);
      toast.success('Item issued to developer');
      setSelected(null);
      signature.reset();
      await refresh();
    } catch (error: unknown) {
      const detail =
        (error as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail || 'Issue failed';
      toast.error(typeof detail === 'string' ? detail : 'Issue failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <ListContentSuspense loading={loading && rows.length === 0}>
        {rows.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No pending developer requests.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item</TableHead>
                <TableHead>Serial</TableHead>
                <TableHead>Hierarchy</TableHead>
                <TableHead>Developer</TableHead>
                <TableHead>Requested</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>
                    <div className="font-medium">{row.inventory_name || '—'}</div>
                    <div className="text-xs text-muted-foreground">
                      {row.part_number || '—'}
                    </div>
                  </TableCell>
                  <TableCell>{row.serial_number || '—'}</TableCell>
                  <TableCell>
                    <div>{row.target_entity_name || `${row.target_entity_type} #${row.target_entity_id}`}</div>
                    <div className="text-xs text-muted-foreground">
                      {row.flight_code || row.flight_name || '—'} / {row.sdls_code || row.sdls_name || '—'}
                    </div>
                  </TableCell>
                  <TableCell>{row.assigned_developer_name || `User #${row.assigned_developer_id}`}</TableCell>
                  <TableCell>{formatWhen(row.requested_at)}</TableCell>
                  <TableCell className="text-right">
                    <Can permission={[P.inventory_issue_workflow, P.issue_inventory]}>
                      <Button size="sm" onClick={() => { signature.reset(); setSelected(row); }}>
                        Issue
                      </Button>
                    </Can>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </ListContentSuspense>

      <Dialog
        open={selected != null}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Issue with signature</DialogTitle>
            <DialogDescription>
              Digital signature is required, or confirm a signed hard-copy sheet.
            </DialogDescription>
          </DialogHeader>
          {selected ? (
            <div className="space-y-4">
              <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm">
                <div className="font-medium">{selected.inventory_name}</div>
                <div className="text-muted-foreground">
                  {selected.serial_number || selected.part_number || '—'} ·{' '}
                  {selected.assigned_developer_name}
                </div>
                <Badge variant="secondary" className="mt-2">
                  Reserved
                </Badge>
              </div>
              <IssueSignatureFields
                signatureType={signature.signatureType}
                onSignatureTypeChange={signature.setSignatureType}
                digitalPayload={signature.digitalPayload}
                onDigitalPayloadChange={signature.setDigitalPayload}
                hardCopyAck={signature.hardCopyAck}
                onHardCopyAckChange={signature.setHardCopyAck}
                disabled={submitting}
              />
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelected(null)} disabled={submitting}>
              Cancel
            </Button>
            <Button onClick={() => void handleIssue()} disabled={submitting || !selected}>
              {submitting ? 'Issuing…' : 'Issue'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

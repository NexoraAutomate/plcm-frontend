'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { maintenanceCases } from '@/lib/api';
import type {
  DualTrackBoard,
  MaintenanceCase,
  ReplacementRequest,
} from '@/lib/models';
import { formatMaintenanceApiError } from '@/services/maintenance';
import { cn } from '@/lib/utils';

function statusLabel(value?: string | null) {
  if (!value) return '—';
  return value.replace(/_/g, ' ');
}

interface DualTrackBoardPanelProps {
  maintenanceCase: MaintenanceCase;
  /** Bump to force a board refresh (e.g. after create CTA). */
  refreshKey?: number;
  onRequestUpdated?: (req: ReplacementRequest) => void;
}

export function DualTrackBoardPanel({
  maintenanceCase,
  refreshKey = 0,
  onRequestUpdated,
}: DualTrackBoardPanelProps) {
  const [board, setBoard] = useState<DualTrackBoard | null>(null);
  const [loading, setLoading] = useState(false);
  const [meId, setMeId] = useState('');
  const [partNumber, setPartNumber] = useState(maintenanceCase.part_number ?? '');
  const [serialNumber, setSerialNumber] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!Number.isFinite(maintenanceCase.id)) return;
    setLoading(true);
    try {
      const { data } = await maintenanceCases.getDualTrack(maintenanceCase.id);
      setBoard(data);
      if (data.track_a?.assigned_me_id != null) {
        setMeId(String(data.track_a.assigned_me_id));
      }
    } catch (err) {
      toast.error(formatMaintenanceApiError(err, 'Failed to load dual-track board'));
    } finally {
      setLoading(false);
    }
  }, [maintenanceCase.id]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  const trackA = board?.track_a ?? null;
  const canHmAct =
    trackA &&
    (trackA.status === 'replacement_requested' ||
      trackA.status === 'pd_approved' ||
      trackA.status === 'im_issue_pending');
  const canPdDecide = trackA && trackA.status === 'replacement_requested';

  const runAssign = async () => {
    if (!trackA) return;
    const id = Number(meId);
    if (!Number.isFinite(id) || id <= 0) {
      toast.error('Enter a valid ME user id');
      return;
    }
    setBusy(true);
    try {
      const { data } = await maintenanceCases.assignReplacementMe(
        maintenanceCase.id,
        trackA.id,
        { assigned_me_id: id }
      );
      setBoard((prev) =>
        prev
          ? {
              ...prev,
              track_a: data,
              track_a_status: data.status,
            }
          : prev
      );
      onRequestUpdated?.(data);
      toast.success('ME assigned');
    } catch (err) {
      toast.error(formatMaintenanceApiError(err, 'Failed to assign ME'));
    } finally {
      setBusy(false);
    }
  };

  const runReserve = async () => {
    if (!trackA) return;
    setBusy(true);
    try {
      const { data } = await maintenanceCases.reserveReplacement(
        maintenanceCase.id,
        trackA.id,
        {
          part_number: partNumber.trim() || null,
          serial_number: serialNumber.trim() || null,
          target_entity_type:
            trackA.faulty_entity_type || maintenanceCase.entity_type || null,
          target_entity_id:
            trackA.faulty_entity_ref_id ?? maintenanceCase.entity_id ?? null,
        }
      );
      setBoard((prev) =>
        prev
          ? {
              ...prev,
              track_a: data,
              track_a_status: data.status,
            }
          : prev
      );
      onRequestUpdated?.(data);
      toast.success('Replacement inventory reserved');
    } catch (err) {
      toast.error(formatMaintenanceApiError(err, 'Failed to reserve inventory'));
    } finally {
      setBusy(false);
    }
  };

  const runPd = async (decision: 'approve' | 'reject') => {
    if (!trackA) return;
    if (decision === 'reject' && !rejectReason.trim()) {
      toast.error('Reject reason is required');
      return;
    }
    setBusy(true);
    try {
      const { data } = await maintenanceCases.pdDecideReplacement(
        maintenanceCase.id,
        trackA.id,
        {
          decision,
          reject_reason: decision === 'reject' ? rejectReason.trim() : null,
        }
      );
      await load();
      onRequestUpdated?.(data);
      toast.success(decision === 'approve' ? 'Replacement approved' : 'Replacement rejected');
    } catch (err) {
      toast.error(formatMaintenanceApiError(err, 'PD decision failed'));
    } finally {
      setBusy(false);
    }
  };

  const showBoard =
    maintenanceCase.onsite_outcome === 'fault_identified' ||
    Boolean(board?.track_a) ||
    Boolean(board?.track_a_status);

  if (!showBoard && !loading) {
    return null;
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base font-semibold">Dual-track board</CardTitle>
          <Button type="button" variant="ghost" size="sm" onClick={() => void load()} disabled={loading}>
            Refresh
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">
          Track A immediate replacement runs in parallel with Track B faulty return &amp; inspection.
        </p>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-3 rounded-md border border-border p-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-medium">Track A — Replacement</h3>
              <Badge variant="outline" className="font-normal capitalize">
                {statusLabel(board?.track_a_status)}
              </Badge>
            </div>
            {!trackA ? (
              <p className="text-sm text-muted-foreground">
                No replacement request yet. Use <span className="font-medium">Request immediate replacement</span> on
                the Occurrence Report.
              </p>
            ) : (
              <>
                <p className="text-xs text-muted-foreground">
                  Request #{trackA.id}
                  {trackA.assigned_me_name
                    ? ` · ME: ${trackA.assigned_me_name}`
                    : trackA.assigned_me_id
                      ? ` · ME #${trackA.assigned_me_id}`
                      : ' · ME unassigned'}
                </p>
                {(trackA.reservations?.length ?? 0) > 0 ? (
                  <ul className="space-y-1 text-xs text-muted-foreground">
                    {trackA.reservations!.map((r) => (
                      <li key={r.id}>
                        Reserved
                        {r.part_number ? ` · ${r.part_number}` : ''}
                        {r.serial_number ? ` / ${r.serial_number}` : ''}
                      </li>
                    ))}
                  </ul>
                ) : null}
                {canHmAct ? (
                  <div className="space-y-2 border-t border-border pt-2">
                    <p className="text-xs font-medium text-foreground">HM — assign ME &amp; reserve</p>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <div className="space-y-1">
                        <Label className="text-xs">ME user id</Label>
                        <Input
                          value={meId}
                          onChange={(e) => setMeId(e.target.value)}
                          inputMode="numeric"
                          placeholder="User id"
                        />
                      </div>
                      <div className="flex items-end">
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          disabled={busy}
                          onClick={() => void runAssign()}
                        >
                          Assign ME
                        </Button>
                      </div>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <div className="space-y-1">
                        <Label className="text-xs">Part number</Label>
                        <Input
                          value={partNumber}
                          onChange={(e) => setPartNumber(e.target.value)}
                          placeholder="Same specs PN"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Serial (optional)</Label>
                        <Input
                          value={serialNumber}
                          onChange={(e) => setSerialNumber(e.target.value)}
                          placeholder="Preferred S/N"
                        />
                      </div>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      disabled={busy}
                      onClick={() => void runReserve()}
                    >
                      Reserve inventory
                    </Button>
                  </div>
                ) : null}
                {canPdDecide ? (
                  <div className="space-y-2 border-t border-border pt-2">
                    <p className="text-xs font-medium text-foreground">PD — approve / reject</p>
                    <Input
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      placeholder="Reject reason (required to reject)"
                    />
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        size="sm"
                        disabled={busy}
                        onClick={() => void runPd('approve')}
                      >
                        Approve
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="destructive"
                        disabled={busy}
                        onClick={() => void runPd('reject')}
                      >
                        Reject
                      </Button>
                    </div>
                  </div>
                ) : null}
                {trackA.pd_decision === 'reject' && trackA.reject_reason ? (
                  <p className="text-xs text-destructive">Rejected: {trackA.reject_reason}</p>
                ) : null}
              </>
            )}
          </div>

          <div className="space-y-3 rounded-md border border-border p-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-medium">Track B — Faulty inspection</h3>
              <Badge
                variant="outline"
                className={cn(
                  'font-normal capitalize',
                  board?.track_b_status === 'awaiting_faulty_arrival' &&
                    'border-amber-300 text-amber-900 dark:text-amber-200'
                )}
              >
                {statusLabel(board?.track_b_status ?? 'idle')}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              {board?.track_b_status === 'awaiting_faulty_arrival'
                ? 'Faulty unit queued for return — reception not required for Track A to continue.'
                : board?.track_b_rework_id
                  ? `Rework #${board.track_b_rework_id}`
                  : 'Idle until PD approves the replacement request (or later ship).'}
            </p>
            {board?.track_b_reception_date ? (
              <p className="text-xs text-muted-foreground">
                Reception: {board.track_b_reception_date}
              </p>
            ) : null}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

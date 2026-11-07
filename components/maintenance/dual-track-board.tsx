'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Can } from '@/components/auth/can';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { maintenanceCases, attachments } from '@/lib/api';
import { P } from '@/lib/permission-codes';
import type {
  DualTrackBoard,
  MaintenanceCase,
  ReplacementRequest,
  ReturnedUnit,
} from '@/lib/models';
import { DiscardedBadge } from '@/components/inventory/discarded-badge';
import { formatMaintenanceApiError } from '@/services/maintenance';
import { cn } from '@/lib/utils';

function statusLabel(value?: string | null) {
  if (!value) return '—';
  return value.replace(/_/g, ' ');
}

const RED_OPEN_STATUSES = new Set([
  'shipped_replaced_badge',
  'ait_in_progress',
  'ait_rejected',
  'im_issue_pending',
]);

const RED_CLEARED_STATUSES = new Set([
  'patch_delivered',
  'track_a_closed',
  'pd_rejected',
  'ait_approved',
]);

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
  const [aitRejectReason, setAitRejectReason] = useState('');
  const [aitDisplayName, setAitDisplayName] = useState('');
  const [aitFile, setAitFile] = useState<File | null>(null);
  const [ieId, setIeId] = useState('');
  const [repairRejectReason, setRepairRejectReason] = useState('');
  const [abortReason, setAbortReason] = useState('');
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

  const applyRequest = (data: ReplacementRequest) => {
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
  };

  const applyTrackB = (unit: ReturnedUnit) => {
    setBoard((prev) =>
      prev
        ? {
            ...prev,
            track_b_status: unit.stage,
            track_b_rework_id: unit.id,
            track_b_reception_date: unit.reception_date ?? prev.track_b_reception_date,
            track_b_discarded: Boolean(unit.discarded),
            track_b_terminal: Boolean(unit.is_track_b_terminal),
          }
        : prev
    );
    if (unit.assigned_ie_id != null) {
      setIeId(String(unit.assigned_ie_id));
    }
  };

  const trackA = board?.track_a ?? null;
  const status = trackA?.status ?? board?.track_a_status ?? null;
  const canHmAct =
    trackA &&
    (status === 'replacement_requested' ||
      status === 'pd_approved' ||
      status === 'im_issue_pending');
  const canPdDecide = trackA && status === 'replacement_requested';
  const canMeRequestIssue = trackA && status === 'pd_approved';
  const canImIssue = trackA && status === 'im_issue_pending';
  const canStartAit = trackA && status === 'shipped_replaced_badge';
  const canUploadAit =
    trackA && (status === 'shipped_replaced_badge' || status === 'ait_in_progress');
  const canPdAit = trackA && status === 'ait_in_progress';
  const canAbort =
    trackA &&
    status != null &&
    status !== 'track_a_closed' &&
    status !== 'pd_rejected';
  const showRed =
    status != null &&
    !RED_CLEARED_STATUSES.has(status) &&
    Boolean(trackA?.red_notified_at) &&
    RED_OPEN_STATUSES.has(status);

  const runAbort = async () => {
    if (!trackA) return;
    const reason = abortReason.trim();
    if (!reason) {
      toast.error('Abort reason is required');
      return;
    }
    setBusy(true);
    try {
      const { data } = await maintenanceCases.abortReplacementRequest(
        maintenanceCase.id,
        trackA.id,
        { reason }
      );
      applyRequest(data);
      setAbortReason('');
      toast.success('Track A aborted; RED cleared');
      void load();
    } catch (err) {
      toast.error(formatMaintenanceApiError(err, 'Failed to abort replacement'));
    } finally {
      setBusy(false);
    }
  };

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
      applyRequest(data);
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
      applyRequest(data);
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

  const runRequestIssue = async () => {
    if (!trackA) return;
    setBusy(true);
    try {
      const { data } = await maintenanceCases.requestReplacementIssue(
        maintenanceCase.id,
        trackA.id
      );
      applyRequest(data);
      toast.success('IM issue requested');
    } catch (err) {
      toast.error(formatMaintenanceApiError(err, 'Failed to request issue'));
    } finally {
      setBusy(false);
    }
  };

  const runImIssue = async () => {
    if (!trackA) return;
    setBusy(true);
    try {
      const { data } = await maintenanceCases.imIssueReplacement(
        maintenanceCase.id,
        trackA.id,
        {
          signature_type: 'HARD_COPY',
          signature_payload: 'ACKNOWLEDGED',
          notes: 'Track A replacement issue',
        }
      );
      await load();
      onRequestUpdated?.(data);
      toast.success(`Issued ${data.issued_serial || 'replacement'} (Replaced / RED)`);
    } catch (err) {
      await load();
      toast.error(formatMaintenanceApiError(err, 'IM issue failed'));
    } finally {
      setBusy(false);
    }
  };

  const runStartAit = async () => {
    if (!trackA) return;
    setBusy(true);
    try {
      const { data } = await maintenanceCases.startReplacementAit(
        maintenanceCase.id,
        trackA.id
      );
      applyRequest(data);
      toast.success('AIT marked in progress');
    } catch (err) {
      toast.error(formatMaintenanceApiError(err, 'Failed to start AIT'));
    } finally {
      setBusy(false);
    }
  };

  const runUploadAit = async () => {
    if (!trackA) return;
    const name = aitDisplayName.trim();
    if (!name) {
      toast.error('AIT attachment display name is required');
      return;
    }
    setBusy(true);
    try {
      let fileId: number | null = null;
      if (aitFile) {
        const uploaded = await attachments.upload(
          'replacement_request',
          trackA.id,
          aitFile,
          { attachment_type: 'other', description: name }
        );
        fileId = uploaded.data.id;
      }
      if (fileId == null) {
        toast.error('Choose a file to upload for AIT evidence');
        setBusy(false);
        return;
      }
      const { data } = await maintenanceCases.uploadReplacementAitAttachment(
        maintenanceCase.id,
        trackA.id,
        { display_name: name, file_id: fileId }
      );
      applyRequest(data);
      setAitDisplayName('');
      setAitFile(null);
      toast.success('AIT attachment uploaded');
    } catch (err) {
      toast.error(formatMaintenanceApiError(err, 'AIT upload failed'));
    } finally {
      setBusy(false);
    }
  };

  const runPdAit = async (decision: 'approve' | 'reject') => {
    if (!trackA) return;
    if (decision === 'reject' && !aitRejectReason.trim()) {
      toast.error('AIT reject reason is required');
      return;
    }
    setBusy(true);
    try {
      const { data } = await maintenanceCases.pdDecideReplacementAit(
        maintenanceCase.id,
        trackA.id,
        {
          decision,
          reject_reason: decision === 'reject' ? aitRejectReason.trim() : null,
        }
      );
      await load();
      onRequestUpdated?.(data);
      toast.success(
        decision === 'approve' ? 'AIT approved — patch delivered' : 'AIT rejected — re-issue loop'
      );
    } catch (err) {
      toast.error(formatMaintenanceApiError(err, 'AIT PD decision failed'));
    } finally {
      setBusy(false);
    }
  };

  const trackBStatus = board?.track_b_status ?? null;
  const trackBReworkId = board?.track_b_rework_id ?? null;
  const canReception = trackBReworkId != null && trackBStatus === 'awaiting_faulty_arrival';
  const canAssignIe = trackBReworkId != null && trackBStatus === 'received';
  const canHandover = trackBReworkId != null && trackBStatus === 'ie_assigned';
  const canImIssueToIe = trackBReworkId != null && trackBStatus === 'issued_to_ie';
  const canDisposition =
    trackBReworkId != null && trackBStatus === 'inspection_under_process';
  const canRepairSubmit =
    trackBReworkId != null && trackBStatus === 'repair_under_progress';
  const canPdRepair =
    trackBReworkId != null && trackBStatus === 'repair_under_progress';
  const canConfirmDiscard =
    trackBReworkId != null && trackBStatus === 'discard_pending';

  const runTrackB = async (
    label: string,
    fn: () => Promise<{ data: ReturnedUnit }>
  ) => {
    setBusy(true);
    try {
      const { data } = await fn();
      applyTrackB(data);
      toast.success(label);
    } catch (err) {
      toast.error(formatMaintenanceApiError(err, `${label} failed`));
    } finally {
      setBusy(false);
    }
  };

  const runAssignIe = async () => {
    if (trackBReworkId == null) return;
    const id = Number(ieId);
    if (!Number.isFinite(id) || id <= 0) {
      toast.error('Enter a valid IE user id');
      return;
    }
    await runTrackB('IE assigned', () =>
      maintenanceCases.trackBAssignIe(maintenanceCase.id, trackBReworkId, id)
    );
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
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-medium">Track A — Replacement</h3>
              <div className="flex flex-wrap items-center gap-1">
                {showRed ? (
                  <Badge className="border-red-600 bg-red-600 font-normal text-white hover:bg-red-600">
                    RED
                  </Badge>
                ) : null}
                {trackA?.issued_serial ? (
                  <Badge variant="secondary" className="font-normal">
                    Replaced · {trackA.issued_serial}
                  </Badge>
                ) : null}
                <Badge variant="outline" className="font-normal capitalize">
                  {statusLabel(board?.track_a_status)}
                </Badge>
              </div>
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
                  {status === 'patch_delivered' ? ' · Track A complete' : ''}
                </p>
                {trackA.shortage_held ? (
                  <p className="text-xs text-amber-800 dark:text-amber-200">
                    Shortage held — no S/N issued. Escalate to PD/HM; reserve again when stock available.
                  </p>
                ) : null}
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
                {(trackA.ait_attachments?.length ?? 0) > 0 ? (
                  <ul className="space-y-1 text-xs text-muted-foreground">
                    {trackA.ait_attachments!.map((a) => (
                      <li key={a.id}>AIT: {a.display_name}</li>
                    ))}
                  </ul>
                ) : null}
                {canHmAct ? (
                  <Can permission={P.maintenance_replacement_request}>
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
                  </Can>
                ) : null}
                {canPdDecide ? (
                  <Can permission={P.maintenance_replacement_request}>
                    <div className="space-y-2 border-t border-border pt-2">
                      <p className="text-xs font-medium text-foreground">PD — approve / reject request</p>
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
                  </Can>
                ) : null}
                {canMeRequestIssue ? (
                  <Can permission={P.maintenance_replacement_request}>
                    <div className="space-y-2 border-t border-border pt-2">
                      <p className="text-xs font-medium text-foreground">ME — request IM issue</p>
                      <Button
                        type="button"
                        size="sm"
                        disabled={busy}
                        onClick={() => void runRequestIssue()}
                      >
                        Request IM ISSUE
                      </Button>
                    </div>
                  </Can>
                ) : null}
                {canImIssue ? (
                  <Can permission={[P.maintenance_replacement_request, P.issue_inventory, P.inventory_issue_workflow]}>
                    <div className="space-y-2 border-t border-border pt-2">
                      <p className="text-xs font-medium text-foreground">IM — issue reserved S/N</p>
                      <Button
                        type="button"
                        size="sm"
                        disabled={busy}
                        onClick={() => void runImIssue()}
                      >
                        ISSUE replacement
                      </Button>
                    </div>
                  </Can>
                ) : null}
                {canStartAit || canUploadAit ? (
                  <Can permission={P.maintenance_ait_upload}>
                    <div className="space-y-2 border-t border-border pt-2">
                      <p className="text-xs font-medium text-foreground">ME — AIT / site</p>
                      {canStartAit ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          disabled={busy}
                          onClick={() => void runStartAit()}
                        >
                          Mark AIT in progress
                        </Button>
                      ) : null}
                      {canUploadAit ? (
                        <div className="space-y-2">
                          <div className="space-y-1">
                            <Label className="text-xs">AIT attachment name</Label>
                            <Input
                              value={aitDisplayName}
                              onChange={(e) => setAitDisplayName(e.target.value)}
                              placeholder="Display name (required)"
                            />
                          </div>
                          <Input
                            type="file"
                            onChange={(e) => setAitFile(e.target.files?.[0] ?? null)}
                          />
                          <Button
                            type="button"
                            size="sm"
                            disabled={busy}
                            onClick={() => void runUploadAit()}
                          >
                            Upload AIT evidence
                          </Button>
                        </div>
                      ) : null}
                    </div>
                  </Can>
                ) : null}
                {canPdAit ? (
                  <Can permission={P.maintenance_replacement_request}>
                    <div className="space-y-2 border-t border-border pt-2">
                      <p className="text-xs font-medium text-foreground">PD — AIT approve / reject</p>
                      <Input
                        value={aitRejectReason}
                        onChange={(e) => setAitRejectReason(e.target.value)}
                        placeholder="AIT reject reason"
                      />
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          size="sm"
                          disabled={busy}
                          onClick={() => void runPdAit('approve')}
                        >
                          Approve AIT
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="destructive"
                          disabled={busy}
                          onClick={() => void runPdAit('reject')}
                        >
                          Reject AIT
                        </Button>
                      </div>
                    </div>
                  </Can>
                ) : null}
                {trackA.pd_decision === 'reject' && trackA.reject_reason ? (
                  <p className="text-xs text-destructive">Rejected: {trackA.reject_reason}</p>
                ) : null}
                {trackA.ait_decision === 'reject' && trackA.ait_reject_reason ? (
                  <p className="text-xs text-destructive">
                    AIT rejected: {trackA.ait_reject_reason}
                    {trackA.quarantined_instance_id
                      ? ` · quarantined instance #${trackA.quarantined_instance_id}`
                      : ''}
                  </p>
                ) : null}
                {trackA.abort_reason ? (
                  <p className="text-xs text-muted-foreground">
                    Aborted: {trackA.abort_reason}
                  </p>
                ) : null}
                {canAbort ? (
                  <Can permission={P.maintenance_replacement_request}>
                    <div className="space-y-2 border-t border-border pt-2">
                      <p className="text-xs font-medium text-foreground">
                        Abort Track A (e.g. later NFF)
                      </p>
                      <Input
                        value={abortReason}
                        onChange={(e) => setAbortReason(e.target.value)}
                        placeholder="Abort reason"
                      />
                      <Button
                        type="button"
                        size="sm"
                        variant="destructive"
                        disabled={busy}
                        onClick={() => void runAbort()}
                      >
                        Abort replacement
                      </Button>
                    </div>
                  </Can>
                ) : null}
              </>
            )}
          </div>

          <div className="space-y-3 rounded-md border border-border p-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-medium">Track B — Faulty inspection</h3>
              <div className="flex flex-wrap items-center gap-2">
                {board?.track_b_discarded ? <DiscardedBadge force /> : null}
                {board?.track_b_terminal && !board?.track_b_discarded ? (
                  <Badge variant="secondary" className="font-normal capitalize">
                    Terminal
                  </Badge>
                ) : null}
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
            </div>
            <p className="text-sm text-muted-foreground">
              {board?.track_b_status === 'awaiting_faulty_arrival'
                ? 'Faulty unit queued for return — reception not required for Track A to continue.'
                : board?.track_b_rework_id
                  ? `Rework #${board.track_b_rework_id}`
                  : 'Idle until IM issues the replacement (ship) or later reception.'}
            </p>
            {board?.track_b_reception_date ? (
              <p className="text-xs text-muted-foreground">
                Reception: {board.track_b_reception_date}
              </p>
            ) : null}

            {canReception ? (
              <Can permission={P.edit_maintenance_cases}>
                <Button
                  type="button"
                  size="sm"
                  disabled={busy}
                  onClick={() =>
                    void runTrackB('Reception recorded', () =>
                      maintenanceCases.trackBReception(
                        maintenanceCase.id,
                        trackBReworkId!
                      )
                    )
                  }
                >
                  Record reception
                </Button>
              </Can>
            ) : null}

            {canAssignIe ? (
              <Can permission={P.edit_maintenance_cases}>
                <div className="space-y-2">
                  <Label htmlFor="track-b-ie-id">IE user id</Label>
                  <Input
                    id="track-b-ie-id"
                    value={ieId}
                    onChange={(e) => setIeId(e.target.value)}
                    placeholder="Inspection Engineer user id"
                  />
                  <Button
                    type="button"
                    size="sm"
                    disabled={busy}
                    onClick={() => void runAssignIe()}
                  >
                    Assign IE
                  </Button>
                </div>
              </Can>
            ) : null}

            {canHandover ? (
              <Can permission={P.maintenance_inspection_disposition}>
                <Button
                  type="button"
                  size="sm"
                  disabled={busy}
                  onClick={() =>
                    void runTrackB('Handover requested', () =>
                      maintenanceCases.trackBHandoverRequest(
                        maintenanceCase.id,
                        trackBReworkId!
                      )
                    )
                  }
                >
                  Request handover
                </Button>
              </Can>
            ) : null}

            {canImIssueToIe ? (
              <Can permission={P.edit_maintenance_cases}>
                <Button
                  type="button"
                  size="sm"
                  disabled={busy}
                  onClick={() =>
                    void runTrackB('Issued to IE', () =>
                      maintenanceCases.trackBImIssueToIe(
                        maintenanceCase.id,
                        trackBReworkId!
                      )
                    )
                  }
                >
                  IM issue to IE
                </Button>
              </Can>
            ) : null}

            {canDisposition ? (
              <Can permission={P.maintenance_inspection_disposition}>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    disabled={busy}
                    onClick={() =>
                      void runTrackB('Marked repairable', () =>
                        maintenanceCases.trackBDisposition(
                          maintenanceCase.id,
                          trackBReworkId!,
                          { outcome: 'repairable' }
                        )
                      )
                    }
                  >
                    Repairable
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    disabled={busy}
                    onClick={() =>
                      void runTrackB('Warranty claim path', () =>
                        maintenanceCases.trackBDisposition(
                          maintenanceCase.id,
                          trackBReworkId!,
                          { outcome: 'warranty' }
                        )
                      )
                    }
                  >
                    Warranty
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="destructive"
                    disabled={busy}
                    onClick={() =>
                      void runTrackB('Discard recommended', () =>
                        maintenanceCases.trackBDisposition(
                          maintenanceCase.id,
                          trackBReworkId!,
                          { outcome: 'discard' }
                        )
                      )
                    }
                  >
                    Recommend discard
                  </Button>
                </div>
              </Can>
            ) : null}

            {canConfirmDiscard ? (
              <Can permission={P.edit_maintenance_cases}>
                <Button
                  type="button"
                  size="sm"
                  variant="destructive"
                  disabled={busy}
                  onClick={() =>
                    void runTrackB('Discard confirmed', () =>
                      maintenanceCases.trackBConfirmDiscard(
                        maintenanceCase.id,
                        trackBReworkId!
                      )
                    )
                  }
                >
                  IM confirm discard
                </Button>
              </Can>
            ) : null}

            {canRepairSubmit ? (
              <Can permission={P.maintenance_inspection_disposition}>
                <Button
                  type="button"
                  size="sm"
                  disabled={busy}
                  onClick={() =>
                    void runTrackB('Repair submitted for PD', () =>
                      maintenanceCases.trackBRepairSubmit(
                        maintenanceCase.id,
                        trackBReworkId!
                      )
                    )
                  }
                >
                  Submit repair evidence
                </Button>
              </Can>
            ) : null}

            {canPdRepair ? (
              <Can permission={P.edit_maintenance_cases}>
                <div className="space-y-2">
                  <Label htmlFor="track-b-repair-reject">Reject reason (if reject)</Label>
                  <Input
                    id="track-b-repair-reject"
                    value={repairRejectReason}
                    onChange={(e) => setRepairRejectReason(e.target.value)}
                  />
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      disabled={busy}
                      onClick={() =>
                        void runTrackB('Repair approved — restocked', () =>
                          maintenanceCases.trackBPdRepairDecision(
                            maintenanceCase.id,
                            trackBReworkId!,
                            { decision: 'approve' }
                          )
                        )
                      }
                    >
                      Approve repair
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="destructive"
                      disabled={busy}
                      onClick={() =>
                        void runTrackB('Repair rejected', () =>
                          maintenanceCases.trackBPdRepairDecision(
                            maintenanceCase.id,
                            trackBReworkId!,
                            {
                              decision: 'reject',
                              reject_reason: repairRejectReason.trim() || null,
                            }
                          )
                        )
                      }
                    >
                      Reject repair
                    </Button>
                  </div>
                </div>
              </Can>
            ) : null}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

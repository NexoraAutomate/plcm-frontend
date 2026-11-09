'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  ClipboardList,
  Loader2,
  Package,
  ShieldAlert,
  UserRound,
  Wrench,
} from 'lucide-react';
import { toast } from 'sonner';
import { Can } from '@/components/auth/can';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/lib/auth-context';
import { HierarchySearchCombobox } from '@/components/hierarchy-dashboard/hierarchy-search-combobox';
import { DiscardedBadge } from '@/components/inventory/discarded-badge';
import { attachments, inventory, maintenanceCases, users } from '@/lib/api';
import { buildReplacementStockRows, type ReplacementStockRow } from '@/lib/entity-replacement';
import { isInventoryInStock } from '@/lib/inventory-filter';
import type {
  DualTrackBoard,
  MaintenanceCase,
  ReplacementRequest,
  ReturnedUnit,
  User,
} from '@/lib/models';
import { P } from '@/lib/permission-codes';
import { formatMaintenanceApiError } from '@/services/maintenance';
import { cn } from '@/lib/utils';

function statusLabel(value?: string | null) {
  if (!value) return '—';
  return value.replace(/_/g, ' ');
}

function stockRowKey(row: ReplacementStockRow): string {
  return row.instanceId != null ? `i-${row.instanceId}` : `inv-${row.inventoryId}-${row.srNo}`;
}

function isPrivilegedAdminRole(roles: string[] | undefined) {
  return (roles ?? []).some((role) => {
    const name = role.toLowerCase();
    return name === 'admin' || name === 'subadmin';
  });
}

function userDisplayName(user: User) {
  return user.full_name?.trim() || user.username;
}

const OPEN_REPLACEMENT_STATUSES = new Set([
  'replacement_requested',
  'pd_approved',
  'im_issue_pending',
  'shipped_replaced_badge',
  'ait_in_progress',
  'ait_rejected',
  'ait_approved',
  'patch_delivered',
]);

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

const TRACK_A_STEPS = [
  'replacement_requested',
  'pd_approved',
  'im_issue_pending',
  'shipped_replaced_badge',
  'ait_in_progress',
  'patch_delivered',
] as const;

type PdRejectOutcome = 'issue_fixed' | 'modification_required';

interface DualTrackBoardPanelProps {
  maintenanceCase: MaintenanceCase;
  /** Bump to force a board refresh (e.g. after create CTA). */
  refreshKey?: number;
  onRequestUpdated?: (req: ReplacementRequest) => void;
  /** Refresh parent case after PD reject closes it (issue_fixed). */
  onCaseUpdated?: (next: MaintenanceCase) => void;
  /** Notifies parent when an open Track A request is present. */
  onOpenReplacementChange?: (hasOpen: boolean) => void;
  /** PD rejected with modification_required — occurrence report becomes editable. */
  onModificationRequiredChange?: (required: boolean) => void;
  /** Live Track A progress for the case progress stepper branch. */
  onTrackAProgressChange?: (
    progress: {
      status: string | null;
      assignedMeId?: number | null;
      hasReservation?: boolean;
    } | null
  ) => void;
}

function isModificationRequiredRequest(req?: ReplacementRequest | null) {
  return (
    req?.status === 'pd_rejected' && req.reject_outcome === 'modification_required'
  );
}

export function DualTrackBoardPanel({
  maintenanceCase,
  refreshKey = 0,
  onRequestUpdated,
  onCaseUpdated,
  onOpenReplacementChange,
  onModificationRequiredChange,
  onTrackAProgressChange,
}: DualTrackBoardPanelProps) {
  const { user } = useAuth();
  const [board, setBoard] = useState<DualTrackBoard | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);

  const [assignees, setAssignees] = useState<User[]>([]);
  const [assigneesLoading, setAssigneesLoading] = useState(false);
  const [stockRows, setStockRows] = useState<ReplacementStockRow[]>([]);
  const [stockLoading, setStockLoading] = useState(false);

  const [meId, setMeId] = useState('');
  const [partNumber, setPartNumber] = useState(maintenanceCase.part_number ?? '');
  const [stockKey, setStockKey] = useState('');
  const [ieId, setIeId] = useState('');

  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectOutcome, setRejectOutcome] = useState<PdRejectOutcome | ''>('');
  const [aitRejectDialogOpen, setAitRejectDialogOpen] = useState(false);
  const [aitRejectReason, setAitRejectReason] = useState('');
  const [abortDialogOpen, setAbortDialogOpen] = useState(false);
  const [abortReason, setAbortReason] = useState('');
  const [repairRejectReason, setRepairRejectReason] = useState('');

  const [aitDisplayName, setAitDisplayName] = useState('');
  const [aitFile, setAitFile] = useState<File | null>(null);

  const load = useCallback(async () => {
    if (!Number.isFinite(maintenanceCase.id)) return;
    setLoading(true);
    try {
      const { data } = await maintenanceCases.getDualTrack(maintenanceCase.id);
      setBoard(data);
      if (data.track_a?.assigned_me_id != null) {
        setMeId(String(data.track_a.assigned_me_id));
      }
      const status = data.track_a?.status ?? data.track_a_status ?? null;
      onOpenReplacementChange?.(
        Boolean(data.track_a) && status != null && OPEN_REPLACEMENT_STATUSES.has(status)
      );
      onModificationRequiredChange?.(isModificationRequiredRequest(data.track_a));
      onTrackAProgressChange?.(
        data.track_a
          ? {
              status,
              assignedMeId: data.track_a.assigned_me_id ?? null,
              hasReservation: (data.track_a.reservations?.length ?? 0) > 0,
            }
          : null
      );
    } catch (err) {
      toast.error(formatMaintenanceApiError(err, 'Failed to load dual-track board'));
    } finally {
      setLoading(false);
    }
  }, [
    maintenanceCase.id,
    onOpenReplacementChange,
    onModificationRequiredChange,
    onTrackAProgressChange,
  ]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  useEffect(() => {
    let cancelled = false;
    const loadAssignees = async () => {
      setAssigneesLoading(true);
      try {
        const { data } = await users.list(0, 500);
        if (cancelled) return;
        const next = (data ?? []).filter(
          (user) => user.is_active && !isPrivilegedAdminRole(user.roles)
        );
        next.sort((a, b) => userDisplayName(a).localeCompare(userDisplayName(b)));
        setAssignees(next);
      } catch {
        if (!cancelled) {
          setAssignees([]);
          toast.error('Failed to load users for assignment');
        }
      } finally {
        if (!cancelled) setAssigneesLoading(false);
      }
    };
    void loadAssignees();
    return () => {
      cancelled = true;
    };
  }, []);

  const entityTypeForStock =
    board?.track_a?.faulty_entity_type ||
    maintenanceCase.entity_type ||
    maintenanceCase.faulty_entities?.[0]?.entity_type ||
    '';

  useEffect(() => {
    if (!entityTypeForStock) {
      setStockRows([]);
      return;
    }
    let cancelled = false;
    const loadStock = async () => {
      setStockLoading(true);
      try {
        const res = await inventory.list(0, 1000, entityTypeForStock);
        const typed = (res.data ?? []).filter(
          (item) =>
            item.inventory_type?.toLowerCase() === entityTypeForStock.toLowerCase() &&
            isInventoryInStock(item)
        );
        const withInstances = await Promise.all(
          typed.map(async (item) => {
            if ((item.instances ?? []).length > 0 || Number(item.quantity) <= 0) {
              return item;
            }
            try {
              const instanceRes = await inventory.listInstances(item.id);
              return { ...item, instances: instanceRes.data ?? [] };
            } catch {
              return item;
            }
          })
        );
        const inStock = withInstances.filter(isInventoryInStock);
        const rows = buildReplacementStockRows(inStock);
        if (!cancelled) {
          setStockRows(rows);
          const preferredPn = (
            maintenanceCase.part_number ||
            maintenanceCase.faulty_entities?.[0]?.part_number ||
            ''
          ).trim();
          if (preferredPn) {
            const match = rows.find(
              (row) => row.partNumber.toLowerCase() === preferredPn.toLowerCase()
            );
            if (match) setPartNumber(match.partNumber);
          }
        }
      } catch {
        if (!cancelled) {
          setStockRows([]);
          toast.error('Failed to load available inventory');
        }
      } finally {
        if (!cancelled) setStockLoading(false);
      }
    };
    void loadStock();
    return () => {
      cancelled = true;
    };
  }, [
    entityTypeForStock,
    maintenanceCase.faulty_entities,
    maintenanceCase.part_number,
  ]);

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
    onOpenReplacementChange?.(OPEN_REPLACEMENT_STATUSES.has(data.status));
    onModificationRequiredChange?.(isModificationRequiredRequest(data));
    onTrackAProgressChange?.({
      status: data.status ?? null,
      assignedMeId: data.assigned_me_id ?? null,
      hasReservation: (data.reservations?.length ?? 0) > 0,
    });
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
  const hasMeAssigned = Boolean(trackA?.assigned_me_id);
  const hasReservation = (trackA?.reservations?.length ?? 0) > 0;
  const isAdminEditor = isPrivilegedAdminRole(user?.roles);
  // Workflow-gated actions — each option only when its step is reached.
  // Admin may edit ME / reservation outside the normal PD/MMHD path.
  const canPdDecide = Boolean(trackA && status === 'replacement_requested');
  const canAssignMe = Boolean(
    trackA &&
      status != null &&
      status !== 'pd_rejected' &&
      status !== 'track_a_closed' &&
      (isAdminEditor ||
        status === 'pd_approved' ||
        status === 'im_issue_pending' ||
        status === 'ait_rejected')
  );
  const meAssignmentLocked = hasMeAssigned && !isAdminEditor;
  const canReserveStock = Boolean(
    trackA &&
      hasMeAssigned &&
      status != null &&
      status !== 'pd_rejected' &&
      status !== 'track_a_closed' &&
      (isAdminEditor
        ? true
        : (status === 'pd_approved' || status === 'im_issue_pending') &&
          (!hasReservation || trackA.shortage_held))
  );
  // Part/serial reservation is done by PD in MMHD; case page only for Admin override.
  const showReserveEditor = canReserveStock && isAdminEditor;
  const showReserveReadonly =
    hasReservation && !isAdminEditor && !showReserveEditor;
  const canResubmit =
    trackA &&
    status === 'pd_rejected' &&
    trackA.reject_outcome === 'modification_required' &&
    user?.id != null &&
    Number(user.id) === Number(trackA.requested_by_id);
  const canMeRequestIssue = Boolean(
    trackA && status === 'pd_approved' && hasMeAssigned && hasReservation
  );
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

  const assigneeOptions = useMemo(
    () =>
      assignees.map((user) => ({
        value: String(user.id),
        label: userDisplayName(user),
        description: [user.username, ...(user.roles ?? [])].filter(Boolean).join(' · '),
      })),
    [assignees]
  );

  const partNumberOptions = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of stockRows) {
      const pn = row.partNumber?.trim();
      if (!pn || pn === '—') continue;
      map.set(pn, (map.get(pn) ?? 0) + 1);
    }
    return [...map.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([pn, count]) => ({
        value: pn,
        label: pn,
        description: `${count} serial${count === 1 ? '' : 's'} available`,
      }));
  }, [stockRows]);

  const serialOptions = useMemo(() => {
    const pn = partNumber.trim().toLowerCase();
    return stockRows
      .filter((row) => !pn || row.partNumber.toLowerCase() === pn)
      .map((row) => ({
        value: stockRowKey(row),
        label: row.serialNumber && row.serialNumber !== '—' ? row.serialNumber : `Stock #${row.srNo}`,
        description: [row.partNumber, row.location, row.oemName].filter(Boolean).join(' · '),
      }));
  }, [partNumber, stockRows]);

  const selectedStock = useMemo(
    () => stockRows.find((row) => stockRowKey(row) === stockKey) ?? null,
    [stockKey, stockRows]
  );

  const stepIndex = useMemo(() => {
    if (!status) return -1;
    if (status === 'pd_rejected') return -1;
    if (status === 'ait_rejected') return TRACK_A_STEPS.indexOf('im_issue_pending');
    if (status === 'ait_approved') return TRACK_A_STEPS.indexOf('patch_delivered');
    if (status === 'track_a_closed') return TRACK_A_STEPS.length;
    return TRACK_A_STEPS.indexOf(status as (typeof TRACK_A_STEPS)[number]);
  }, [status]);

  const runAssign = async () => {
    if (!trackA) return;
    const id = Number(meId);
    if (!Number.isFinite(id) || id <= 0) {
      toast.error('Select a user to assign as ME');
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
    if (!selectedStock && !partNumber.trim()) {
      toast.error('Select a part number and serial to reserve');
      return;
    }
    setBusy(true);
    try {
      const { data } = await maintenanceCases.reserveReplacement(
        maintenanceCase.id,
        trackA.id,
        {
          inventory_id: selectedStock?.inventoryId ?? null,
          inventory_instance_id: selectedStock?.instanceId ?? null,
          part_number:
            selectedStock?.partNumber?.trim() || partNumber.trim() || null,
          serial_number:
            selectedStock?.serialNumber && selectedStock.serialNumber !== '—'
              ? selectedStock.serialNumber
              : null,
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

  const runPdApprove = async () => {
    if (!trackA) return;
    setBusy(true);
    try {
      const { data } = await maintenanceCases.pdDecideReplacement(
        maintenanceCase.id,
        trackA.id,
        { decision: 'approve', reject_reason: null }
      );
      await load();
      onRequestUpdated?.(data);
      toast.success('Replacement approved — assign an ME next');
    } catch (err) {
      toast.error(formatMaintenanceApiError(err, 'PD approval failed'));
    } finally {
      setBusy(false);
    }
  };

  const runPdReject = async () => {
    if (!trackA) return;
    const reason = rejectReason.trim();
    if (!rejectOutcome) {
      toast.error('Choose whether the issue is fixed or modification is required');
      return;
    }
    if (!reason) {
      toast.error('Reject reason is required');
      return;
    }
    setBusy(true);
    try {
      const { data } = await maintenanceCases.pdDecideReplacement(
        maintenanceCase.id,
        trackA.id,
        {
          decision: 'reject',
          reject_reason: reason,
          reject_outcome: rejectOutcome,
        }
      );
      setRejectDialogOpen(false);
      setRejectReason('');
      setRejectOutcome('');
      await load();
      onRequestUpdated?.(data);
      onOpenReplacementChange?.(false);
      if (rejectOutcome === 'issue_fixed') {
        try {
          const refreshed = await maintenanceCases.get(maintenanceCase.id);
          onCaseUpdated?.(refreshed.data);
        } catch {
          /* board already updated; case refresh is best-effort */
        }
        toast.success('Issue fixed — maintenance case closed');
      } else {
        toast.success('Modification required — sent back to requester');
      }
    } catch (err) {
      toast.error(formatMaintenanceApiError(err, 'PD reject failed'));
    } finally {
      setBusy(false);
    }
  };

  const runResubmit = async () => {
    if (!trackA) return;
    setBusy(true);
    try {
      const { data } = await maintenanceCases.resubmitReplacementRequest(
        maintenanceCase.id,
        trackA.id
      );
      await load();
      onRequestUpdated?.(data);
      onOpenReplacementChange?.(true);
      toast.success('Re-submitted for PD approval');
    } catch (err) {
      toast.error(formatMaintenanceApiError(err, 'Failed to resubmit for PD approval'));
    } finally {
      setBusy(false);
    }
  };

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
      setAbortDialogOpen(false);
      setAbortReason('');
      applyRequest(data);
      toast.success('Track A aborted; RED cleared');
      void load();
    } catch (err) {
      toast.error(formatMaintenanceApiError(err, 'Failed to abort replacement'));
    } finally {
      setBusy(false);
    }
  };

  const runRequestIssue = async () => {
    if (!trackA) return;
    if (!trackA.assigned_me_id) {
      toast.error('Assign an ME before requesting IM issue');
      return;
    }
    if ((trackA.reservations?.length ?? 0) === 0) {
      toast.error('Reserve inventory before requesting IM issue');
      return;
    }
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
      if (decision === 'reject') {
        setAitRejectDialogOpen(false);
        setAitRejectReason('');
      }
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
      toast.error('Select an inspection engineer');
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
    <>
      <Card className="overflow-hidden border-border/80 shadow-sm">
        <CardHeader className="px-4 py-3 sm:px-5">
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <ClipboardList className="h-4 w-4 text-muted-foreground" />
            Dual-track board
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 p-4 pt-0 sm:p-5 sm:pt-0">
          <div className="grid gap-4 lg:grid-cols-2">
            <section className="flex flex-col gap-3 rounded-xl border border-border/80 bg-card p-4 shadow-xs">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="flex items-center gap-2 text-sm font-semibold">
                  <Package className="h-4 w-4 text-sky-700 dark:text-sky-300" />
                  Track A — Replacement
                </h3>
                <div className="flex flex-wrap items-center gap-1.5">
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

              {trackA && stepIndex >= 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {TRACK_A_STEPS.map((step, index) => {
                    const done = index <= stepIndex;
                    const current = index === stepIndex;
                    return (
                      <span
                        key={step}
                        className={cn(
                          'rounded-full px-2 py-0.5 text-[10px] font-medium capitalize tracking-wide',
                          done
                            ? 'bg-sky-100 text-sky-900 dark:bg-sky-950 dark:text-sky-100'
                            : 'bg-muted text-muted-foreground',
                          current && 'ring-1 ring-sky-500/50'
                        )}
                      >
                        {statusLabel(step)}
                      </span>
                    );
                  })}
                </div>
              ) : null}

              {!trackA ? (
                <div className="rounded-lg border border-dashed border-border bg-muted/40 px-3 py-4 text-sm text-muted-foreground">
                  No replacement request yet. Use{' '}
                  <span className="font-medium text-foreground">Request immediate replacement</span>{' '}
                  on the Occurrence Report.
                </div>
              ) : (
                <>
                  <div className="rounded-lg bg-muted/35 px-3 py-2 text-xs text-muted-foreground">
                    Request #{trackA.id}
                    {trackA.assigned_me_name
                      ? ` · ME: ${trackA.assigned_me_name}`
                      : trackA.assigned_me_id
                        ? ` · ME #${trackA.assigned_me_id}`
                        : ' · ME unassigned'}
                    {status === 'patch_delivered' ? ' · Track A complete' : ''}
                  </div>

                  {trackA.shortage_held ? (
                    <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
                      Shortage held — no S/N issued. Escalate to PD/HM; reserve again when stock
                      available.
                    </p>
                  ) : null}

                  {(trackA.reservations?.length ?? 0) > 0 ? (
                    <ul className="space-y-1 text-xs text-muted-foreground">
                      {trackA.reservations!.map((r) => (
                        <li key={r.id} className="flex items-center gap-1.5">
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
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

                  {canPdDecide ? (
                    <Can permission={P.maintenance_replacement_approve}>
                      <div className="space-y-2 rounded-lg border border-border/70 bg-background/80 p-3">
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          PD decision
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Approve the replacement request to continue. After approval you can
                          assign an ME, then reserve inventory. Reject asks whether the issue is
                          fixed (closes the case) or modification is required (returns to
                          requester).
                        </p>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            size="sm"
                            disabled={busy}
                            onClick={() => void runPdApprove()}
                          >
                            {busy ? (
                              <>
                                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                                Approving…
                              </>
                            ) : (
                              'Approve replacement'
                            )}
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="destructive"
                            disabled={busy}
                            onClick={() => setRejectDialogOpen(true)}
                          >
                            Reject…
                          </Button>
                        </div>
                      </div>
                    </Can>
                  ) : null}

                  {hasMeAssigned && meAssignmentLocked ? (
                    <div className="space-y-2 rounded-lg border border-border/70 bg-muted/30 p-3">
                      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        <UserRound className="h-3.5 w-3.5" />
                        Maintenance engineer
                      </div>
                      <p className="text-sm font-medium text-foreground">
                        {trackA?.assigned_me_name || (meId ? `User #${meId}` : 'Assigned')}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Already assigned — selection is locked on this case. PD reserves
                        part/serial in MMHD assignments.
                      </p>
                    </div>
                  ) : null}

                  {canAssignMe && !meAssignmentLocked ? (
                    <Can permission={P.maintenance_assign_me}>
                      <div className="space-y-3 rounded-lg border border-border/70 bg-background/80 p-3">
                        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          <UserRound className="h-3.5 w-3.5" />
                          Assign maintenance engineer
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Available after PD approval. Inventory reservation unlocks once an ME
                          is assigned
                          {isAdminEditor ? ' (Admin may edit anytime).' : '.'}
                        </p>
                        <HierarchySearchCombobox
                          label="Maintenance engineer"
                          placeholder={
                            assigneesLoading ? 'Loading users…' : 'Search user by name'
                          }
                          value={meId}
                          options={assigneeOptions}
                          onChange={setMeId}
                          onClear={() => setMeId('')}
                          disabled={busy || assigneesLoading}
                          labelClassName="text-xs"
                        />
                        <Button
                          type="button"
                          size="sm"
                          disabled={busy}
                          onClick={() => void runAssign()}
                        >
                          {hasMeAssigned ? 'Reassign ME' : 'Assign ME'}
                        </Button>
                      </div>
                    </Can>
                  ) : null}

                  {showReserveEditor ? (
                    <Can permission={[P.maintenance_assign_me, P.inventory_reserve]}>
                      <div className="space-y-3 rounded-lg border border-border/70 bg-background/80 p-3">
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          Reserve inventory (Admin)
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Admin override — PD normally selects part/serial in MMHD
                          assignments.
                        </p>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <HierarchySearchCombobox
                            label="Part number"
                            placeholder={
                              stockLoading ? 'Loading part numbers…' : 'Search part number'
                            }
                            value={partNumber}
                            options={partNumberOptions}
                            onChange={(value) => {
                              setPartNumber(value);
                              setStockKey('');
                            }}
                            onClear={() => {
                              setPartNumber('');
                              setStockKey('');
                            }}
                            disabled={busy || stockLoading}
                            labelClassName="text-xs"
                          />
                          <HierarchySearchCombobox
                            label="Serial number"
                            placeholder={
                              !partNumber
                                ? 'Select a part number first'
                                : stockLoading
                                  ? 'Loading serials…'
                                  : 'Search serial number'
                            }
                            value={stockKey}
                            options={serialOptions}
                            onChange={setStockKey}
                            onClear={() => setStockKey('')}
                            disabled={busy || stockLoading || !partNumber}
                            labelClassName="text-xs"
                          />
                        </div>
                        {selectedStock ? (
                          <p className="text-xs text-muted-foreground">
                            Selected:{' '}
                            <span className="font-medium text-foreground">
                              {selectedStock.partNumber}
                            </span>
                            {selectedStock.serialNumber && selectedStock.serialNumber !== '—'
                              ? ` / ${selectedStock.serialNumber}`
                              : ''}
                            {selectedStock.location ? ` · ${selectedStock.location}` : ''}
                          </p>
                        ) : null}
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

                  {showReserveReadonly ? (
                    <div className="rounded-lg border border-border/70 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                      Inventory reserved
                      {(trackA?.reservations?.[0]?.part_number ||
                        trackA?.reservations?.[0]?.serial_number) && (
                        <>
                          {' · '}
                          {[
                            trackA.reservations?.[0]?.part_number,
                            trackA.reservations?.[0]?.serial_number,
                          ]
                            .filter(Boolean)
                            .join(' / ')}
                        </>
                      )}
                      . Part/serial is selected by PD in MMHD assignments.
                    </div>
                  ) : null}

                  {canReserveStock && !isAdminEditor && !hasReservation ? (
                    <div className="rounded-lg border border-dashed border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                      Next: PD selects part number and serial in{' '}
                      <span className="font-medium text-foreground">MMHD assignments</span> to
                      reserve inventory.
                    </div>
                  ) : null}

                  {canMeRequestIssue ? (
                    <Can permission={P.maintenance_request_issue}>
                      <div className="space-y-2 rounded-lg border border-border/70 p-3">
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          ME — request IM issue
                        </p>
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
                    <Can
                      permission={[
                        P.maintenance_im_issue,
                        P.issue_inventory,
                        P.inventory_issue_workflow,
                      ]}
                    >
                      <div className="space-y-2 rounded-lg border border-border/70 p-3">
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          IM — issue reserved S/N
                        </p>
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
                      <div className="space-y-2 rounded-lg border border-border/70 p-3">
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          ME — AIT / site
                        </p>
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
                    <Can permission={P.maintenance_ait_approve}>
                      <div className="space-y-2 rounded-lg border border-border/70 p-3">
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          PD — AIT approve / reject
                        </p>
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
                            onClick={() => setAitRejectDialogOpen(true)}
                          >
                            Reject AIT…
                          </Button>
                        </div>
                      </div>
                    </Can>
                  ) : null}

                  {trackA.pd_decision === 'reject' && trackA.reject_reason ? (
                    <p className="flex items-start gap-1.5 text-xs text-destructive">
                      <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      Rejected
                      {trackA.reject_outcome === 'issue_fixed'
                        ? ' (issue fixed — case closed)'
                        : trackA.reject_outcome === 'modification_required'
                          ? ' (modification required)'
                          : ''}
                      : {trackA.reject_reason}
                    </p>
                  ) : null}

                  {canResubmit ? (
                    <div className="space-y-2 rounded-lg border border-amber-200/80 bg-amber-50/50 p-3 dark:border-amber-900 dark:bg-amber-950/30">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Modification required
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Update the request as needed, then re-submit for PD approval.
                      </p>
                      <Button
                        type="button"
                        size="sm"
                        disabled={busy}
                        onClick={() => void runResubmit()}
                      >
                        {busy ? 'Re-submitting…' : 'Re-submit for PD approval'}
                      </Button>
                    </div>
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
                    <p className="text-xs text-muted-foreground">Aborted: {trackA.abort_reason}</p>
                  ) : null}

                  {canAbort ? (
                    <Can
                      permission={[
                        P.maintenance_replacement_approve,
                        P.maintenance_case_close,
                      ]}
                    >
                      <div className="pt-1">
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="text-destructive hover:text-destructive"
                          disabled={busy}
                          onClick={() => setAbortDialogOpen(true)}
                        >
                          Abort Track A…
                        </Button>
                      </div>
                    </Can>
                  ) : null}
                </>
              )}
            </section>

            <section className="flex flex-col gap-3 rounded-xl border border-border/80 bg-card p-4 shadow-xs">
              <div className="flex items-center justify-between gap-2">
                <h3 className="flex items-center gap-2 text-sm font-semibold">
                  <Wrench className="h-4 w-4 text-amber-700 dark:text-amber-300" />
                  Track B — Faulty inspection
                </h3>
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
                <Can permission={P.maintenance_reception}>
                  <Button
                    type="button"
                    size="sm"
                    disabled={busy}
                    onClick={() =>
                      void runTrackB('Reception recorded', () =>
                        maintenanceCases.trackBReception(maintenanceCase.id, trackBReworkId!)
                      )
                    }
                  >
                    Record reception
                  </Button>
                </Can>
              ) : null}

              {canAssignIe ? (
                <Can permission={P.maintenance_assign_ie}>
                  <div className="space-y-2 rounded-lg border border-border/70 p-3">
                    <HierarchySearchCombobox
                      label="Inspection engineer"
                      placeholder={
                        assigneesLoading ? 'Loading users…' : 'Search user by name'
                      }
                      value={ieId}
                      options={assigneeOptions}
                      onChange={setIeId}
                      onClear={() => setIeId('')}
                      disabled={busy || assigneesLoading}
                      labelClassName="text-xs"
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
                <Can permission={P.maintenance_im_issue_to_ie}>
                  <Button
                    type="button"
                    size="sm"
                    disabled={busy}
                    onClick={() =>
                      void runTrackB('Issued to IE', () =>
                        maintenanceCases.trackBImIssueToIe(maintenanceCase.id, trackBReworkId!)
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
                <Can permission={P.maintenance_confirm_discard}>
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
                <Can permission={P.maintenance_repair_approve}>
                  <div className="space-y-2 rounded-lg border border-border/70 p-3">
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
            </section>
          </div>
        </CardContent>
      </Card>

      <Dialog
        open={rejectDialogOpen}
        onOpenChange={(open) => {
          setRejectDialogOpen(open);
          if (!open) {
            setRejectReason('');
            setRejectOutcome('');
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reject replacement request</DialogTitle>
            <DialogDescription>
              Choose the outcome, then provide a clear reason.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <div className="space-y-2">
              <Label>What should happen?</Label>
              <RadioGroup
                value={rejectOutcome}
                onValueChange={(value) => setRejectOutcome(value as PdRejectOutcome)}
                className="gap-2"
              >
                <label
                  htmlFor="pd-reject-issue-fixed"
                  className="flex cursor-pointer items-start gap-3 rounded-lg border bg-background px-3 py-2.5"
                >
                  <RadioGroupItem id="pd-reject-issue-fixed" value="issue_fixed" className="mt-0.5" />
                  <span className="space-y-0.5">
                    <span className="block text-sm font-medium">Issue is fixed</span>
                    <span className="block text-xs text-muted-foreground">
                      Close the maintenance case now. The stepper skips mid steps and links
                      directly to Closed.
                    </span>
                  </span>
                </label>
                <label
                  htmlFor="pd-reject-modification"
                  className="flex cursor-pointer items-start gap-3 rounded-lg border bg-background px-3 py-2.5"
                >
                  <RadioGroupItem
                    id="pd-reject-modification"
                    value="modification_required"
                    className="mt-0.5"
                  />
                  <span className="space-y-0.5">
                    <span className="block text-sm font-medium">Modification required</span>
                    <span className="block text-xs text-muted-foreground">
                      Send back to the requester so they can update and re-submit for PD
                      approval.
                    </span>
                  </span>
                </label>
              </RadioGroup>
            </div>
            <div className="space-y-2">
              <Label htmlFor="pd-reject-reason">Reject reason</Label>
              <Textarea
                id="pd-reject-reason"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Why is this replacement being rejected?"
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => setRejectDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={busy || !rejectReason.trim() || !rejectOutcome}
              onClick={() => void runPdReject()}
            >
              {busy
                ? 'Rejecting…'
                : rejectOutcome === 'issue_fixed'
                  ? 'Close case'
                  : rejectOutcome === 'modification_required'
                    ? 'Send for modification'
                    : 'Confirm reject'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={aitRejectDialogOpen} onOpenChange={setAitRejectDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reject AIT</DialogTitle>
            <DialogDescription>
              AIT rejection returns Track A to the re-issue loop. Reason is required.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-1">
            <Label htmlFor="ait-reject-reason">AIT reject reason</Label>
            <Textarea
              id="ait-reject-reason"
              value={aitRejectReason}
              onChange={(e) => setAitRejectReason(e.target.value)}
              placeholder="Describe the AIT failure"
              rows={4}
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => setAitRejectDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={busy || !aitRejectReason.trim()}
              onClick={() => void runPdAit('reject')}
            >
              {busy ? 'Rejecting…' : 'Confirm AIT reject'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={abortDialogOpen} onOpenChange={setAbortDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Abort Track A</DialogTitle>
            <DialogDescription>
              Use when replacement is no longer needed (for example later NFF). RED notifications
              are cleared.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-1">
            <Label htmlFor="abort-reason">Abort reason</Label>
            <Textarea
              id="abort-reason"
              value={abortReason}
              onChange={(e) => setAbortReason(e.target.value)}
              placeholder="Why is Track A being aborted?"
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => setAbortDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={busy || !abortReason.trim()}
              onClick={() => void runAbort()}
            >
              {busy ? 'Aborting…' : 'Confirm abort'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

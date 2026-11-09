'use client';

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { ExternalLink, Loader2, Search, X } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { maintenanceCases, users } from '@/lib/api';
import { type ReplacementStockRow } from '@/lib/entity-replacement';
import type { MaintenanceAssignedWork, User } from '@/lib/models';
import { cn } from '@/lib/utils';
import { formatMaintenanceApiError } from '@/services/maintenance';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsTrigger } from '@/components/ui/tabs';
import {
  AnimatedPillTabsList,
  animatedPillTabsTriggerClassName,
} from '@/components/ui/animated-pill-tabs';
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
import { HierarchySearchCombobox } from '@/components/hierarchy-dashboard/hierarchy-search-combobox';
import { ListContentSuspense } from '@/components/list-content-suspense';
import { usePageDataRefresh } from '@/components/page-data-refresh';
import { invalidatePendingActionCounts } from '@/hooks/use-pending-action-counts';

type LifecycleTab = 'needs_action' | 'in_progress' | 'closed';

type DialogMode =
  | null
  | 'pd_reject'
  | 'ait_reject'
  | 'pd_repair_reject'
  | 'assign_me'
  | 'assign_ie'
  | 'reserve';

function userDisplayName(user: User) {
  return user.full_name?.trim() || user.username;
}

function stockRowKey(row: ReplacementStockRow): string {
  return row.instanceId != null ? `i-${row.instanceId}` : `inv-${row.inventoryId}-${row.srNo}`;
}

function lifecycleOf(row: MaintenanceAssignedWork): LifecycleTab {
  const value = (row.lifecycle || '').toLowerCase();
  if (value === 'closed') return 'closed';
  if (value === 'in_progress') return 'in_progress';
  if (row.needs_action) return 'needs_action';
  return 'in_progress';
}

function trackBadgeClass(track: string) {
  return track === 'a'
    ? 'border-sky-300 bg-sky-50 text-sky-900 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-100'
    : 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100';
}

export function MmhdAssignmentsPanel() {
  const queryClient = useQueryClient();
  const [rows, setRows] = useState<MaintenanceAssignedWork[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [lifecycleTab, setLifecycleTab] = useState<LifecycleTab>('needs_action');

  const [assignees, setAssignees] = useState<User[]>([]);
  const [assigneesLoading, setAssigneesLoading] = useState(false);

  const [dialogMode, setDialogMode] = useState<DialogMode>(null);
  const [activeRow, setActiveRow] = useState<MaintenanceAssignedWork | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectOutcome, setRejectOutcome] = useState<'issue_fixed' | 'modification_required' | ''>(
    ''
  );
  const [assigneeId, setAssigneeId] = useState('');
  const [stockRows, setStockRows] = useState<ReplacementStockRow[]>([]);
  const [stockLoading, setStockLoading] = useState(false);
  const [partNumber, setPartNumber] = useState('');
  const [stockKey, setStockKey] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await maintenanceCases.listMyAssignments();
      setRows(Array.isArray(data) ? data : []);
      await invalidatePendingActionCounts(queryClient);
    } catch (err) {
      toast.error(formatMaintenanceApiError(err, 'Failed to load MMHD assignments'));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [queryClient]);

  usePageDataRefresh(load);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    let cancelled = false;
    setAssigneesLoading(true);
    users
      .list(0, 500)
      .then(({ data }) => {
        if (!cancelled) setAssignees(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        if (!cancelled) setAssignees([]);
      })
      .finally(() => {
        if (!cancelled) setAssigneesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

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

  const loadStockForRow = useCallback(async (row: MaintenanceAssignedWork) => {
    setStockLoading(true);
    setStockRows([]);
    setPartNumber(row.part_number?.trim() || '');
    setStockKey('');
    if (row.replacement_request_id == null) {
      setStockLoading(false);
      toast.error('This assignment has no replacement request to reserve against');
      return;
    }
    try {
      const res = await maintenanceCases.listReplacementStock(
        row.case_id,
        row.replacement_request_id
      );
      const rows: ReplacementStockRow[] = (res.data ?? []).map((item, index) => ({
        srNo: index + 1,
        inventoryId: item.inventory_id,
        instanceId: item.inventory_instance_id ?? undefined,
        name: item.name,
        partNumber: item.part_number || '—',
        serialNumber: item.serial_number || '—',
        configurationItem: item.configuration_item ?? undefined,
        oemName: item.oem_name ?? undefined,
        location: item.location ?? undefined,
      }));
      setStockRows(rows);
      const preferredPn = (row.part_number || '').trim();
      if (preferredPn) {
        const match = rows.find(
          (stock) => stock.partNumber.toLowerCase() === preferredPn.toLowerCase()
        );
        if (match) setPartNumber(match.partNumber);
      }
    } catch {
      setStockRows([]);
      toast.error('Failed to load available inventory');
    } finally {
      setStockLoading(false);
    }
  }, []);

  const tabCounts = useMemo(() => {
    const counts: Record<LifecycleTab, number> = {
      needs_action: 0,
      in_progress: 0,
      closed: 0,
    };
    for (const row of rows) {
      counts[lifecycleOf(row)] += 1;
    }
    return counts;
  }, [rows]);

  useEffect(() => {
    if (rows.length === 0) return;
    if (tabCounts[lifecycleTab] > 0) return;
    const next = (['needs_action', 'in_progress', 'closed'] as LifecycleTab[]).find(
      (tab) => tabCounts[tab] > 0
    );
    if (next) setLifecycleTab(next);
  }, [rows.length, tabCounts, lifecycleTab]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (lifecycleOf(row) !== lifecycleTab) return false;
      if (!q) return true;
      const hay = [
        row.case_number,
        row.project_name,
        row.part_number,
        row.serial_number,
        row.status_label,
        row.task_type,
        row.assigned_me_name,
        row.assigned_ie_name,
        row.entity_type,
        String(row.entity_id ?? ''),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  }, [rows, lifecycleTab, search]);

  const closeDialog = () => {
    setDialogMode(null);
    setActiveRow(null);
    setRejectReason('');
    setRejectOutcome('');
    setAssigneeId('');
    setStockRows([]);
    setPartNumber('');
    setStockKey('');
  };

  const withBusy = async (row: MaintenanceAssignedWork, fn: () => Promise<void>) => {
    setBusyId(row.id);
    try {
      await fn();
      await load();
    } catch (err) {
      toast.error(formatMaintenanceApiError(err, 'Action failed'));
    } finally {
      setBusyId(null);
    }
  };

  const openDialog = (mode: DialogMode, row: MaintenanceAssignedWork) => {
    setActiveRow(row);
    setDialogMode(mode);
    setRejectReason('');
    setRejectOutcome('');
    setAssigneeId(
      mode === 'assign_me' && row.assigned_me_id
        ? String(row.assigned_me_id)
        : mode === 'assign_ie' && row.assigned_ie_id
          ? String(row.assigned_ie_id)
          : ''
    );
    if (mode === 'reserve') {
      void loadStockForRow(row);
    } else {
      setStockRows([]);
      setPartNumber('');
      setStockKey('');
    }
  };

  const runPdDecide = async (row: MaintenanceAssignedWork, decision: 'approve' | 'reject') => {
    if (row.replacement_request_id == null) return;
    if (decision === 'reject') {
      openDialog('pd_reject', row);
      return;
    }
    await withBusy(row, async () => {
      await maintenanceCases.pdDecideReplacement(row.case_id, row.replacement_request_id!, {
        decision: 'approve',
        reject_reason: null,
      });
      toast.success('Replacement approved');
    });
  };

  const confirmPdReject = async () => {
    if (!activeRow?.replacement_request_id) return;
    if (!rejectOutcome) {
      toast.error('Choose whether the issue is fixed or modification is required');
      return;
    }
    if (!rejectReason.trim()) {
      toast.error('Reject reason is required');
      return;
    }
    const row = activeRow;
    const outcome = rejectOutcome;
    closeDialog();
    await withBusy(row, async () => {
      await maintenanceCases.pdDecideReplacement(row.case_id, row.replacement_request_id!, {
        decision: 'reject',
        reject_reason: rejectReason.trim(),
        reject_outcome: outcome,
      });
      toast.success(
        outcome === 'issue_fixed'
          ? 'Issue fixed — maintenance case closed'
          : 'Modification required — sent back to requester'
      );
    });
  };

  const runResubmit = async (row: MaintenanceAssignedWork) => {
    if (row.replacement_request_id == null) return;
    await withBusy(row, async () => {
      await maintenanceCases.resubmitReplacementRequest(row.case_id, row.replacement_request_id!);
      toast.success('Re-submitted for PD approval');
    });
  };

  const confirmAssignMe = async () => {
    if (!activeRow?.replacement_request_id) return;
    const id = Number(assigneeId);
    if (!Number.isFinite(id) || id <= 0) {
      toast.error('Select a maintenance engineer');
      return;
    }
    const row = activeRow;
    closeDialog();
    await withBusy(row, async () => {
      await maintenanceCases.assignReplacementMe(row.case_id, row.replacement_request_id!, {
        assigned_me_id: id,
      });
      toast.success('ME assigned');
    });
  };

  const confirmReserve = async () => {
    if (!activeRow?.replacement_request_id) return;
    if (!selectedStock && !partNumber.trim()) {
      toast.error('Select a part number and serial to reserve');
      return;
    }
    const row = activeRow;
    closeDialog();
    await withBusy(row, async () => {
      await maintenanceCases.reserveReplacement(row.case_id, row.replacement_request_id!, {
        inventory_id: selectedStock?.inventoryId ?? null,
        inventory_instance_id: selectedStock?.instanceId ?? null,
        part_number: selectedStock?.partNumber?.trim() || partNumber.trim() || null,
        serial_number:
          selectedStock?.serialNumber && selectedStock.serialNumber !== '—'
            ? selectedStock.serialNumber
            : null,
        target_entity_type: row.entity_type || null,
        target_entity_id: row.entity_id ?? null,
      });
      toast.success('Replacement inventory reserved');
    });
  };

  const confirmAssignIe = async () => {
    if (!activeRow?.rework_id) return;
    const id = Number(assigneeId);
    if (!Number.isFinite(id) || id <= 0) {
      toast.error('Select an inspection engineer');
      return;
    }
    const row = activeRow;
    closeDialog();
    await withBusy(row, async () => {
      await maintenanceCases.trackBAssignIe(row.case_id, row.rework_id!, id);
      toast.success('IE assigned');
    });
  };

  const runMeRequestIssue = async (row: MaintenanceAssignedWork) => {
    if (row.replacement_request_id == null) return;
    await withBusy(row, async () => {
      await maintenanceCases.requestReplacementIssue(row.case_id, row.replacement_request_id!);
      toast.success('Issue requested');
    });
  };

  const runImIssue = async (row: MaintenanceAssignedWork) => {
    if (row.replacement_request_id == null) return;
    await withBusy(row, async () => {
      await maintenanceCases.imIssueReplacement(row.case_id, row.replacement_request_id!, {
        signature_type: 'DIGITAL',
        signature_payload: null,
        notes: null,
      });
      toast.success('Replacement issued');
    });
  };

  const runStartAit = async (row: MaintenanceAssignedWork) => {
    if (row.replacement_request_id == null) return;
    await withBusy(row, async () => {
      await maintenanceCases.startReplacementAit(row.case_id, row.replacement_request_id!);
      toast.success('AIT started');
    });
  };

  const runPdAit = async (row: MaintenanceAssignedWork, decision: 'approve' | 'reject') => {
    if (row.replacement_request_id == null) return;
    if (decision === 'reject') {
      openDialog('ait_reject', row);
      return;
    }
    await withBusy(row, async () => {
      await maintenanceCases.pdDecideReplacementAit(row.case_id, row.replacement_request_id!, {
        decision: 'approve',
        reject_reason: null,
      });
      toast.success('AIT approved');
    });
  };

  const confirmAitReject = async () => {
    if (!activeRow?.replacement_request_id) return;
    if (!rejectReason.trim()) {
      toast.error('AIT reject reason is required');
      return;
    }
    const row = activeRow;
    closeDialog();
    await withBusy(row, async () => {
      await maintenanceCases.pdDecideReplacementAit(row.case_id, row.replacement_request_id!, {
        decision: 'reject',
        reject_reason: rejectReason.trim(),
      });
      toast.success('AIT rejected');
    });
  };

  const runReception = async (row: MaintenanceAssignedWork) => {
    if (row.rework_id == null) return;
    await withBusy(row, async () => {
      await maintenanceCases.trackBReception(row.case_id, row.rework_id!);
      toast.success('Reception recorded');
    });
  };

  const runHandover = async (row: MaintenanceAssignedWork) => {
    if (row.rework_id == null) return;
    await withBusy(row, async () => {
      await maintenanceCases.trackBHandoverRequest(row.case_id, row.rework_id!);
      toast.success('Handover requested');
    });
  };

  const runImIssueToIe = async (row: MaintenanceAssignedWork) => {
    if (row.rework_id == null) return;
    await withBusy(row, async () => {
      await maintenanceCases.trackBImIssueToIe(row.case_id, row.rework_id!);
      toast.success('Issued to IE');
    });
  };

  const runDisposition = async (
    row: MaintenanceAssignedWork,
    outcome: 'repairable' | 'warranty' | 'discard'
  ) => {
    if (row.rework_id == null) return;
    await withBusy(row, async () => {
      await maintenanceCases.trackBDisposition(row.case_id, row.rework_id!, { outcome });
      toast.success(
        outcome === 'repairable'
          ? 'Marked repairable'
          : outcome === 'warranty'
            ? 'Warranty path'
            : 'Discard recommended'
      );
    });
  };

  const runConfirmDiscard = async (row: MaintenanceAssignedWork) => {
    if (row.rework_id == null) return;
    await withBusy(row, async () => {
      await maintenanceCases.trackBConfirmDiscard(row.case_id, row.rework_id!);
      toast.success('Discard confirmed');
    });
  };

  const runRepairSubmit = async (row: MaintenanceAssignedWork) => {
    if (row.rework_id == null) return;
    await withBusy(row, async () => {
      await maintenanceCases.trackBRepairSubmit(row.case_id, row.rework_id!);
      toast.success('Repair submitted');
    });
  };

  const runPdRepair = async (row: MaintenanceAssignedWork, decision: 'approve' | 'reject') => {
    if (row.rework_id == null) return;
    if (decision === 'reject') {
      openDialog('pd_repair_reject', row);
      return;
    }
    await withBusy(row, async () => {
      await maintenanceCases.trackBPdRepairDecision(row.case_id, row.rework_id!, {
        decision: 'approve',
        reject_reason: null,
      });
      toast.success('Repair approved');
    });
  };

  const confirmPdRepairReject = async () => {
    if (!activeRow?.rework_id) return;
    if (!rejectReason.trim()) {
      toast.error('Reject reason is required');
      return;
    }
    const row = activeRow;
    closeDialog();
    await withBusy(row, async () => {
      await maintenanceCases.trackBPdRepairDecision(row.case_id, row.rework_id!, {
        decision: 'reject',
        reject_reason: rejectReason.trim(),
      });
      toast.success('Repair rejected');
    });
  };

  const renderActions = (row: MaintenanceAssignedWork) => {
    const busy = busyId === row.id;
    const buttons: ReactNode[] = [];

    if (row.can_pd_decide) {
      buttons.push(
        <Button
          key="pd-approve"
          size="sm"
          disabled={busy}
          onClick={() => void runPdDecide(row, 'approve')}
        >
          Approve
        </Button>,
        <Button
          key="pd-reject"
          size="sm"
          variant="destructive"
          disabled={busy}
          onClick={() => void runPdDecide(row, 'reject')}
        >
          Reject…
        </Button>
      );
    }
    if (row.can_resubmit) {
      buttons.push(
        <Button
          key="resubmit"
          size="sm"
          variant="secondary"
          disabled={busy}
          onClick={() => void runResubmit(row)}
        >
          Re-submit for PD
        </Button>
      );
    }
    if (row.can_assign_me && !row.assigned_me_id) {
      buttons.push(
        <Button
          key="assign-me"
          size="sm"
          variant="secondary"
          disabled={busy}
          onClick={() => openDialog('assign_me', row)}
        >
          Assign ME…
        </Button>
      );
    }
    if (row.can_reserve) {
      buttons.push(
        <Button
          key="reserve"
          size="sm"
          variant="secondary"
          disabled={busy}
          onClick={() => openDialog('reserve', row)}
        >
          Reserve inventory…
        </Button>
      );
    }
    if (row.can_me_request_issue) {
      buttons.push(
        <Button
          key="me-request"
          size="sm"
          disabled={busy}
          onClick={() => void runMeRequestIssue(row)}
        >
          Request issue
        </Button>
      );
    }
    if (row.can_im_issue) {
      buttons.push(
        <Button key="im-issue" size="sm" disabled={busy} onClick={() => void runImIssue(row)}>
          IM issue
        </Button>
      );
    }
    if (row.can_start_ait) {
      buttons.push(
        <Button key="start-ait" size="sm" disabled={busy} onClick={() => void runStartAit(row)}>
          Start AIT
        </Button>
      );
    }
    if (row.can_upload_ait) {
      buttons.push(
        <Button key="upload-ait" size="sm" variant="outline" asChild>
          <Link href={row.href}>Upload AIT…</Link>
        </Button>
      );
    }
    if (row.can_pd_ait) {
      buttons.push(
        <Button
          key="ait-approve"
          size="sm"
          disabled={busy}
          onClick={() => void runPdAit(row, 'approve')}
        >
          Approve AIT
        </Button>,
        <Button
          key="ait-reject"
          size="sm"
          variant="destructive"
          disabled={busy}
          onClick={() => void runPdAit(row, 'reject')}
        >
          Reject AIT…
        </Button>
      );
    }
    if (row.can_reception) {
      buttons.push(
        <Button
          key="reception"
          size="sm"
          disabled={busy}
          onClick={() => void runReception(row)}
        >
          Record reception
        </Button>
      );
    }
    if (row.can_assign_ie) {
      buttons.push(
        <Button
          key="assign-ie"
          size="sm"
          variant="secondary"
          disabled={busy}
          onClick={() => openDialog('assign_ie', row)}
        >
          Assign IE…
        </Button>
      );
    }
    if (row.can_handover) {
      buttons.push(
        <Button key="handover" size="sm" disabled={busy} onClick={() => void runHandover(row)}>
          Request handover
        </Button>
      );
    }
    if (row.can_im_issue_to_ie) {
      buttons.push(
        <Button
          key="im-ie"
          size="sm"
          disabled={busy}
          onClick={() => void runImIssueToIe(row)}
        >
          IM issue to IE
        </Button>
      );
    }
    if (row.can_disposition) {
      buttons.push(
        <Button
          key="disp-repair"
          size="sm"
          disabled={busy}
          onClick={() => void runDisposition(row, 'repairable')}
        >
          Repairable
        </Button>,
        <Button
          key="disp-warranty"
          size="sm"
          variant="secondary"
          disabled={busy}
          onClick={() => void runDisposition(row, 'warranty')}
        >
          Warranty
        </Button>,
        <Button
          key="disp-discard"
          size="sm"
          variant="destructive"
          disabled={busy}
          onClick={() => void runDisposition(row, 'discard')}
        >
          Discard
        </Button>
      );
    }
    if (row.can_repair_submit) {
      buttons.push(
        <Button
          key="repair-submit"
          size="sm"
          disabled={busy}
          onClick={() => void runRepairSubmit(row)}
        >
          Submit repair
        </Button>
      );
    }
    if (row.can_pd_repair) {
      buttons.push(
        <Button
          key="pd-repair-ok"
          size="sm"
          disabled={busy}
          onClick={() => void runPdRepair(row, 'approve')}
        >
          Approve repair
        </Button>,
        <Button
          key="pd-repair-no"
          size="sm"
          variant="destructive"
          disabled={busy}
          onClick={() => void runPdRepair(row, 'reject')}
        >
          Reject repair…
        </Button>
      );
    }
    if (row.can_confirm_discard) {
      buttons.push(
        <Button
          key="confirm-discard"
          size="sm"
          variant="destructive"
          disabled={busy}
          onClick={() => void runConfirmDiscard(row)}
        >
          Confirm discard
        </Button>
      );
    }

    buttons.push(
      <Button key="view" size="sm" variant="outline" asChild>
        <Link href={row.href} className="inline-flex items-center gap-1">
          View
          <ExternalLink className="h-3.5 w-3.5" />
        </Link>
      </Button>
    );

    return (
      <div className="flex flex-wrap items-center justify-end gap-1.5">
        {busy ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : null}
        {buttons}
      </div>
    );
  };

  return (
    <div className="space-y-3">
      <Tabs
        value={lifecycleTab}
        onValueChange={(value) => setLifecycleTab(value as LifecycleTab)}
        className="gap-3"
      >
        <AnimatedPillTabsList value={lifecycleTab}>
          {(
            [
              ['needs_action', 'Needs action'],
              ['in_progress', 'In progress'],
              ['closed', 'Closed'],
            ] as const
          ).map(([value, label]) => (
            <TabsTrigger
              key={value}
              value={value}
              className={animatedPillTabsTriggerClassName}
            >
              {label}
              <Badge variant="secondary" className="ml-1.5 font-normal">
                {tabCounts[value]}
              </Badge>
            </TabsTrigger>
          ))}
        </AnimatedPillTabsList>

        <div className="relative max-w-md">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search case, project, PN, S/N…"
            className="pl-8 pr-8"
          />
          {search ? (
            <button
              type="button"
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              onClick={() => setSearch('')}
              aria-label="Clear search"
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}
        </div>

        {(['needs_action', 'in_progress', 'closed'] as LifecycleTab[]).map((tab) => (
          <TabsContent key={tab} value={tab} className="mt-0">
            <ListContentSuspense loading={loading}>
              {filtered.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  {rows.length === 0
                    ? 'No maintenance assignments for you yet.'
                    : 'No assignments in this tab.'}
                </p>
              ) : (
                <div className="overflow-x-auto rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Case</TableHead>
                        <TableHead>Track</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Project</TableHead>
                        <TableHead>Part / Serial</TableHead>
                        <TableHead>Assignee</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtered.map((row) => (
                        <TableRow key={row.id}>
                          <TableCell className="font-medium">
                            {row.case_number || `Case #${row.case_id}`}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={cn('font-normal uppercase', trackBadgeClass(row.track))}
                            >
                              Track {row.track}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="max-w-[14rem] text-sm">{row.status_label}</div>
                            <div className="text-xs text-muted-foreground">{row.task_type}</div>
                          </TableCell>
                          <TableCell>{row.project_name || '—'}</TableCell>
                          <TableCell>
                            <div className="text-sm">{row.part_number || '—'}</div>
                            <div className="text-xs text-muted-foreground">
                              {row.serial_number || '—'}
                            </div>
                          </TableCell>
                          <TableCell className="text-sm">
                            {row.track === 'a'
                              ? row.assigned_me_name || '—'
                              : row.assigned_ie_name || row.investigating_pd_name || '—'}
                          </TableCell>
                          <TableCell className="text-right">{renderActions(row)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </ListContentSuspense>
          </TabsContent>
        ))}
      </Tabs>

      <Dialog
        open={dialogMode === 'pd_reject' || dialogMode === 'ait_reject' || dialogMode === 'pd_repair_reject'}
        onOpenChange={(open) => {
          if (!open) closeDialog();
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {dialogMode === 'ait_reject'
                ? 'Reject AIT'
                : dialogMode === 'pd_repair_reject'
                  ? 'Reject repair'
                  : 'Reject replacement'}
            </DialogTitle>
            <DialogDescription>
              {dialogMode === 'pd_reject'
                ? 'Choose the outcome, then provide a reason.'
                : 'Provide a reason for the rejection.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {dialogMode === 'pd_reject' ? (
              <div className="space-y-2">
                <Label>What should happen?</Label>
                <RadioGroup
                  value={rejectOutcome}
                  onValueChange={(value) =>
                    setRejectOutcome(value as 'issue_fixed' | 'modification_required')
                  }
                  className="gap-2"
                >
                  <label
                    htmlFor="mmhd-reject-issue-fixed"
                    className="flex cursor-pointer items-start gap-3 rounded-lg border bg-background px-3 py-2.5"
                  >
                    <RadioGroupItem
                      id="mmhd-reject-issue-fixed"
                      value="issue_fixed"
                      className="mt-0.5"
                    />
                    <span className="space-y-0.5">
                      <span className="block text-sm font-medium">Issue is fixed</span>
                      <span className="block text-xs text-muted-foreground">
                        Close the maintenance case now (stepper skips to Closed).
                      </span>
                    </span>
                  </label>
                  <label
                    htmlFor="mmhd-reject-modification"
                    className="flex cursor-pointer items-start gap-3 rounded-lg border bg-background px-3 py-2.5"
                  >
                    <RadioGroupItem
                      id="mmhd-reject-modification"
                      value="modification_required"
                      className="mt-0.5"
                    />
                    <span className="space-y-0.5">
                      <span className="block text-sm font-medium">Modification required</span>
                      <span className="block text-xs text-muted-foreground">
                        Send back to the requester to update and re-submit for PD approval.
                      </span>
                    </span>
                  </label>
                </RadioGroup>
              </div>
            ) : null}
            <div className="space-y-2">
              <Label htmlFor="mmhd-reject-reason">Reason</Label>
              <Textarea
                id="mmhd-reject-reason"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={closeDialog}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={dialogMode === 'pd_reject' && (!rejectOutcome || !rejectReason.trim())}
              onClick={() =>
                void (dialogMode === 'ait_reject'
                  ? confirmAitReject()
                  : dialogMode === 'pd_repair_reject'
                    ? confirmPdRepairReject()
                    : confirmPdReject())
              }
            >
              {dialogMode === 'pd_reject'
                ? rejectOutcome === 'issue_fixed'
                  ? 'Close case'
                  : rejectOutcome === 'modification_required'
                    ? 'Send for modification'
                    : 'Reject'
                : 'Reject'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={dialogMode === 'assign_me' || dialogMode === 'assign_ie'}
        onOpenChange={(open) => {
          if (!open) closeDialog();
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {dialogMode === 'assign_ie' ? 'Assign inspection engineer' : 'Assign maintenance engineer'}
            </DialogTitle>
            <DialogDescription>
              Choose a user for {activeRow?.case_number || 'this case'}.
            </DialogDescription>
          </DialogHeader>
          <HierarchySearchCombobox
            label={dialogMode === 'assign_ie' ? 'Inspection engineer' : 'Maintenance engineer'}
            placeholder={assigneesLoading ? 'Loading users…' : 'Search user by name'}
            value={assigneeId}
            options={assigneeOptions}
            onChange={setAssigneeId}
            onClear={() => setAssigneeId('')}
            disabled={assigneesLoading}
          />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={closeDialog}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() =>
                void (dialogMode === 'assign_ie' ? confirmAssignIe() : confirmAssignMe())
              }
            >
              Assign
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={dialogMode === 'reserve'}
        onOpenChange={(open) => {
          if (!open) closeDialog();
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Reserve replacement inventory</DialogTitle>
            <DialogDescription>
              Select part number and serial for {activeRow?.case_number || 'this case'} after ME
              allocation.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <HierarchySearchCombobox
              label="Part number"
              placeholder={stockLoading ? 'Loading part numbers…' : 'Search part number'}
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
              disabled={stockLoading}
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
              disabled={stockLoading || !partNumber}
            />
          </div>
          {selectedStock ? (
            <p className="text-xs text-muted-foreground">
              Selected:{' '}
              <span className="font-medium text-foreground">{selectedStock.partNumber}</span>
              {selectedStock.serialNumber && selectedStock.serialNumber !== '—'
                ? ` / ${selectedStock.serialNumber}`
                : ''}
              {selectedStock.location ? ` · ${selectedStock.location}` : ''}
            </p>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={closeDialog}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={stockLoading || (!selectedStock && !partNumber.trim())}
              onClick={() => void confirmReserve()}
            >
              Reserve inventory
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

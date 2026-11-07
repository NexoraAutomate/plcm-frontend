'use client';

import { useCallback, useEffect, useMemo, useState, type MouseEvent } from 'react';
import { CheckCircle2, ClipboardList, Loader2, Search, Trash2, X } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import * as api from '@/lib/api';
import type { DeveloperAssignedWork, ItemInstallRejection } from '@/lib/models';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { ListContentSuspense } from '@/components/list-content-suspense';
import { WorkflowCan } from '@/components/auth';
import { P } from '@/lib/permission-codes';
import { ReworkWizardDialog, type ReworkWizardTarget } from '@/components/inventory/rework-wizard-dialog';
import { RejectionReasonsDialog } from '@/components/inventory/rejection-reasons-dialog';
import { AssignmentActivitySheet } from '@/components/inventory/assignment-activity-sheet';
import { usePageDataRefresh } from '@/components/page-data-refresh';
import { invalidatePendingActionCounts } from '@/hooks/use-pending-action-counts';
import { SortableTableHead } from '@/components/data-table/sortable-table-head';
import { ColumnVisibilityMenu } from '@/components/data-table/column-visibility-menu';
import { useColumnVisibility, type ColumnVisibilityDef } from '@/hooks/use-column-visibility';
import { useClientTableSort } from '@/hooks/use-table-sorting';
import { useIsMobile } from '@/hooks/use-mobile';

function rowKey(row: DeveloperAssignedWork) {
  return `${row.entity_type}:${row.entity_id}`;
}

function requestLabel(row: DeveloperAssignedWork) {
  if (row.verified) return 'Verified';
  if (row.rework_stage) return `Rework — ${row.rework_stage}`;
  if (row.defect_pending) return 'Fail — rework';
  if (row.installation_rejected || row.item_status === 'INSTALLATION_REJECTED') {
    return 'Installation rejected';
  }
  if (row.complete_reported) return 'Waiting for HM accept';
  if (row.issued) return 'Issued';
  if (row.request_status === 'pending') return 'Requested';
  if (row.last_mark_back_reason) return 'Marked back';
  if (row.reserved) return 'Reserved';
  return 'Assigned';
}

function apiError(error: unknown, fallback: string) {
  const detail =
    (error as { response?: { data?: { detail?: string } } })?.response?.data?.detail || fallback;
  return typeof detail === 'string' ? detail : fallback;
}

const FILTER_ALL = 'all';

type AssignmentLifecycleTab = 'new' | 'under_process' | 'completed';

type AssignmentStatusFilter =
  | typeof FILTER_ALL
  | 'needs_action'
  | 'ready_to_request'
  | 'reserved'
  | 'marked_back'
  | 'requested'
  | 'issued'
  | 'installing'
  | 'testing'
  | 'rework'
  | 'complete_reported'
  | 'rejected'
  | 'verified';

type StatusChipTone =
  | 'neutral'
  | 'sky'
  | 'amber'
  | 'blue'
  | 'indigo'
  | 'violet'
  | 'rose'
  | 'orange'
  | 'emerald';

const STATUS_CHIP_TONES: Record<StatusChipTone, { idle: string; active: string }> = {
  neutral: {
    idle: 'border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-200',
    active:
      'border-slate-700 bg-slate-800 text-white shadow-sm dark:border-slate-300 dark:bg-slate-100 dark:text-slate-900',
  },
  sky: {
    idle: 'border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-200',
    active: 'border-sky-600 bg-sky-600 text-white shadow-sm',
  },
  amber: {
    idle: 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100',
    active: 'border-amber-600 bg-amber-600 text-white shadow-sm',
  },
  blue: {
    idle: 'border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-200',
    active: 'border-blue-600 bg-blue-600 text-white shadow-sm',
  },
  indigo: {
    idle: 'border-indigo-200 bg-indigo-50 text-indigo-800 dark:border-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-200',
    active: 'border-indigo-600 bg-indigo-600 text-white shadow-sm',
  },
  violet: {
    idle: 'border-violet-200 bg-violet-50 text-violet-800 dark:border-violet-800 dark:bg-violet-950/40 dark:text-violet-200',
    active: 'border-violet-600 bg-violet-600 text-white shadow-sm',
  },
  rose: {
    idle: 'border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-200',
    active: 'border-rose-600 bg-rose-600 text-white shadow-sm',
  },
  orange: {
    idle: 'border-orange-200 bg-orange-50 text-orange-900 dark:border-orange-800 dark:bg-orange-950/40 dark:text-orange-100',
    active: 'border-orange-600 bg-orange-600 text-white shadow-sm',
  },
  emerald: {
    idle: 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200',
    active: 'border-emerald-600 bg-emerald-600 text-white shadow-sm',
  },
};

const STATUS_FILTER_DEFS: {
  key: AssignmentStatusFilter;
  label: string;
  tone: StatusChipTone;
  tabs: AssignmentLifecycleTab[];
}[] = [
  { key: FILTER_ALL, label: 'All', tone: 'neutral', tabs: ['new', 'under_process', 'completed'] },
  { key: 'needs_action', label: 'Needs action', tone: 'amber', tabs: ['new', 'under_process'] },
  { key: 'ready_to_request', label: 'Ready to request', tone: 'sky', tabs: ['new'] },
  { key: 'reserved', label: 'Reserved', tone: 'sky', tabs: ['new'] },
  { key: 'marked_back', label: 'Marked back', tone: 'orange', tabs: ['under_process'] },
  { key: 'requested', label: 'Requested', tone: 'blue', tabs: ['under_process'] },
  { key: 'issued', label: 'Issued', tone: 'blue', tabs: ['under_process'] },
  { key: 'installing', label: 'Installing', tone: 'indigo', tabs: ['under_process'] },
  { key: 'testing', label: 'Testing', tone: 'violet', tabs: ['under_process'] },
  { key: 'rework', label: 'Rework / fail', tone: 'rose', tabs: ['under_process'] },
  {
    key: 'complete_reported',
    label: 'Awaiting HM accept',
    tone: 'amber',
    tabs: ['under_process'],
  },
  { key: 'rejected', label: 'Installation rejected', tone: 'rose', tabs: ['under_process'] },
  { key: 'verified', label: 'Verified', tone: 'emerald', tabs: ['completed'] },
];

const STATUS_GROUP_DEFS: {
  id: string;
  label: string;
  tabs: AssignmentLifecycleTab[];
  keys: AssignmentStatusFilter[];
}[] = [
  {
    id: 'queue',
    label: 'Queue',
    tabs: ['new'],
    keys: ['needs_action', 'ready_to_request', 'reserved'],
  },
  {
    id: 'handover',
    label: 'Handover',
    tabs: ['under_process'],
    keys: ['needs_action', 'marked_back', 'requested', 'issued'],
  },
  {
    id: 'install',
    label: 'Install & test',
    tabs: ['under_process'],
    keys: ['installing', 'testing', 'complete_reported'],
  },
  {
    id: 'attention',
    label: 'Needs attention',
    tabs: ['under_process'],
    keys: ['rework', 'rejected'],
  },
  {
    id: 'done',
    label: 'Done',
    tabs: ['completed'],
    keys: ['verified'],
  },
];

const ROW_STATUS_TONES: Record<string, string> = {
  Assigned: STATUS_CHIP_TONES.neutral.idle,
  Reserved: STATUS_CHIP_TONES.sky.idle,
  Requested: STATUS_CHIP_TONES.blue.idle,
  'Marked back': STATUS_CHIP_TONES.orange.idle,
  Issued: STATUS_CHIP_TONES.blue.idle,
  Installing: STATUS_CHIP_TONES.indigo.idle,
  Testing: STATUS_CHIP_TONES.violet.idle,
  Pass: STATUS_CHIP_TONES.emerald.idle,
  Fail: STATUS_CHIP_TONES.rose.idle,
  Rework: STATUS_CHIP_TONES.rose.idle,
  'Awaiting HM': STATUS_CHIP_TONES.amber.idle,
  Rejected: STATUS_CHIP_TONES.rose.idle,
  Verified: STATUS_CHIP_TONES.emerald.idle,
};

function rowNeedsAction(row: DeveloperAssignedWork) {
  return Boolean(
    row.can_request ||
      row.can_install ||
      row.can_test ||
      row.can_report_complete ||
      row.can_remove ||
      row.can_return
  );
}

function rowHasStartedWork(row: DeveloperAssignedWork) {
  return Boolean(
    row.issued ||
      row.request_status === 'pending' ||
      row.complete_reported ||
      row.defect_pending ||
      row.rework_stage ||
      row.can_install ||
      row.can_test ||
      row.can_report_complete ||
      row.can_remove ||
      row.can_return ||
      row.installation_rejected ||
      row.item_status === 'INSTALLATION_REJECTED' ||
      row.item_status === 'INSTALLATION_IN_PROGRESS' ||
      row.item_status === 'UNDER_TESTING_REVIEW' ||
      row.test_result ||
      row.last_mark_back_reason
  );
}

function assignmentLifecycleTab(row: DeveloperAssignedWork): AssignmentLifecycleTab {
  if (row.verified) return 'completed';
  if (rowHasStartedWork(row)) return 'under_process';
  return 'new';
}

function rowMatchesStatusFilter(row: DeveloperAssignedWork, filter: AssignmentStatusFilter) {
  if (filter === FILTER_ALL) return true;
  switch (filter) {
    case 'needs_action':
      return rowNeedsAction(row);
    case 'ready_to_request':
      return row.can_request;
    case 'reserved':
      return row.reserved && !row.issued;
    case 'marked_back':
      return Boolean(row.last_mark_back_reason);
    case 'requested':
      return row.request_status === 'pending';
    case 'issued':
      return (
        row.issued &&
        !row.verified &&
        !row.complete_reported &&
        !row.defect_pending &&
        !row.rework_stage &&
        !row.can_install &&
        !row.can_test
      );
    case 'installing':
      return Boolean(row.can_install || row.item_status === 'INSTALLATION_IN_PROGRESS');
    case 'testing':
      return Boolean(
        row.can_test ||
          row.item_status === 'UNDER_TESTING_REVIEW' ||
          (row.test_result === 'pass' && !row.verified)
      );
    case 'rework':
      return Boolean(row.defect_pending || row.rework_stage || row.can_remove || row.can_return);
    case 'complete_reported':
      return Boolean(row.complete_reported && !row.verified);
    case 'rejected':
      return Boolean(row.installation_rejected || row.item_status === 'INSTALLATION_REJECTED');
    case 'verified':
      return Boolean(row.verified);
    default:
      return true;
  }
}

function rowMatchesSearch(row: DeveloperAssignedWork, query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const haystack = [
    row.name,
    row.part_number,
    row.serial_number,
    row.project_name,
    row.customer_name,
    row.flight_name,
    row.system_name,
    row.assigned_hm_name,
    row.entity_type,
    row.entity_id != null ? String(row.entity_id) : '',
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return haystack.includes(q);
}

function primaryStatusLabel(row: DeveloperAssignedWork): string {
  if (row.verified) return 'Verified';
  if (row.installation_rejected || row.item_status === 'INSTALLATION_REJECTED') return 'Rejected';
  if (row.complete_reported) return 'Awaiting HM';
  if (row.rework_stage || row.defect_pending) return 'Rework';
  if (row.can_test || row.item_status === 'UNDER_TESTING_REVIEW' || row.test_result === 'pass') {
    return 'Testing';
  }
  if (row.can_install || row.item_status === 'INSTALLATION_IN_PROGRESS') return 'Installing';
  if (row.issued) return 'Issued';
  if (row.request_status === 'pending') return 'Requested';
  if (row.last_mark_back_reason) return 'Marked back';
  if (row.reserved) return 'Reserved';
  return 'Assigned';
}

function StatusChip({
  label,
  onClick,
  title,
}: {
  label: string;
  onClick?: (event: MouseEvent) => void;
  title?: string;
}) {
  const className = cn(
    'inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-medium',
    ROW_STATUS_TONES[label] ?? STATUS_CHIP_TONES.neutral.idle,
    onClick && 'cursor-pointer hover:opacity-90'
  );
  if (onClick) {
    return (
      <button type="button" className={className} onClick={onClick} title={title}>
        {label}
      </button>
    );
  }
  return (
    <span className={className} title={title}>
      {label}
    </span>
  );
}

const COLUMN_DEFS: ColumnVisibilityDef[] = [
  { id: 'name', label: 'Item', alwaysVisible: true },
  { id: 'customer_name', label: 'Customer' },
  { id: 'flight_name', label: 'Flight' },
  { id: 'system_name', label: 'System' },
  { id: 'project_name', label: 'Project' },
  { id: 'serial_number', label: 'Serial' },
  { id: 'item_status', label: 'Status' },
];

const TAB_META: Record<
  AssignmentLifecycleTab,
  { label: string; empty: string; icon: typeof ClipboardList }
> = {
  new: {
    label: 'New Assignments',
    empty: 'No new assignments waiting to be started.',
    icon: ClipboardList,
  },
  under_process: {
    label: 'Under Process',
    empty: 'No assignments currently in progress.',
    icon: Loader2,
  },
  completed: {
    label: 'Completed Assignments',
    empty: 'No completed assignments yet.',
    icon: CheckCircle2,
  },
};

export function MyAssignmentsPanel() {
  const { hasWorkflowRole } = useAuth();
  const canDeleteCompleted = hasWorkflowRole('ADMIN');
  const isMobile = useIsMobile();
  const { visibleIds, isVisible, toggleColumn, resetColumns } = useColumnVisibility(
    'my-assignments-list',
    COLUMN_DEFS
  );
  const showColumn = useCallback(
    (id: string) => {
      if (isMobile) return id === 'name';
      return isVisible(id);
    },
    [isMobile, isVisible]
  );
  const [rows, setRows] = useState<DeveloperAssignedWork[]>([]);
  const [loading, setLoading] = useState(true);
  const [lifecycleTab, setLifecycleTab] = useState<AssignmentLifecycleTab>('new');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<AssignmentStatusFilter>(FILTER_ALL);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [submitting, setSubmitting] = useState(false);
  const [reworkTarget, setReworkTarget] = useState<ReworkWizardTarget | null>(null);
  const [rejectionView, setRejectionView] = useState<{
    label: string;
    history: ItemInstallRejection[];
  } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeveloperAssignedWork | null>(null);
  const [activityRow, setActivityRow] = useState<DeveloperAssignedWork | null>(null);
  const [activityOpen, setActivityOpen] = useState(false);

  const queryClient = useQueryClient();
  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.inventory.listMyAssignments();
      setRows(res.data ?? []);
      await invalidatePendingActionCounts(queryClient);
    } catch {
      toast.error('Failed to load assigned items');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [queryClient]);

  usePageDataRefresh(refresh);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const tabCounts = useMemo(() => {
    const counts: Record<AssignmentLifecycleTab, number> = {
      new: 0,
      under_process: 0,
      completed: 0,
    };
    for (const row of rows) {
      counts[assignmentLifecycleTab(row)] += 1;
    }
    return counts;
  }, [rows]);

  // Prefer a tab that actually has rows so the page does not look empty
  // when everything sits under process / completed.
  useEffect(() => {
    if (rows.length === 0) return;
    if (tabCounts[lifecycleTab] > 0) return;
    const preferred = (['new', 'under_process', 'completed'] as AssignmentLifecycleTab[]).find(
      (tab) => tabCounts[tab] > 0
    );
    if (preferred) setLifecycleTab(preferred);
  }, [rows.length, tabCounts, lifecycleTab]);

  const tabRows = useMemo(
    () => rows.filter((row) => assignmentLifecycleTab(row) === lifecycleTab),
    [rows, lifecycleTab]
  );

  const statusFilterCounts = useMemo(() => {
    const counts = new Map<AssignmentStatusFilter, number>();
    for (const def of STATUS_FILTER_DEFS) {
      counts.set(def.key, 0);
    }
    counts.set(FILTER_ALL, tabRows.length);
    for (const row of tabRows) {
      for (const def of STATUS_FILTER_DEFS) {
        if (def.key === FILTER_ALL) continue;
        if (!def.tabs.includes(lifecycleTab)) continue;
        if (rowMatchesStatusFilter(row, def.key)) {
          counts.set(def.key, (counts.get(def.key) ?? 0) + 1);
        }
      }
    }
    return counts;
  }, [tabRows, lifecycleTab]);

  const filteredRows = useMemo(() => {
    return tabRows.filter((row) => {
      if (!rowMatchesSearch(row, searchQuery)) return false;
      if (!rowMatchesStatusFilter(row, statusFilter)) return false;
      return true;
    });
  }, [tabRows, searchQuery, statusFilter]);

  const { sort, cycleSort, sortedRows } = useClientTableSort(filteredRows);

  const filtersActive = searchQuery.trim().length > 0 || statusFilter !== FILTER_ALL;

  const selectedRows = useMemo(
    () => filteredRows.filter((row) => selected[rowKey(row)]),
    [filteredRows, selected]
  );
  const requestable = filteredRows.filter((row) => row.can_request);

  function clearFilters() {
    setSearchQuery('');
    setStatusFilter(FILTER_ALL);
  }

  function changeLifecycleTab(next: string) {
    const tab = next as AssignmentLifecycleTab;
    setLifecycleTab(tab);
    setSelected({});
    setStatusFilter(FILTER_ALL);
  }

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
      if (created > 0) setLifecycleTab('under_process');
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
      setLifecycleTab('under_process');
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
      toast.success('Installation complete reported — waiting for HM accept');
      await refresh();
    } catch (error: unknown) {
      toast.error(apiError(error, 'Could not report complete'));
    } finally {
      setSubmitting(false);
    }
  }

  async function confirmDeleteCompleted() {
    if (!deleteTarget) return;
    setSubmitting(true);
    try {
      await api.inventory.deleteCompletedAssignment(
        deleteTarget.entity_type,
        deleteTarget.entity_id
      );
      toast.success('Completed assignment deleted permanently');
      setDeleteTarget(null);
      await refresh();
    } catch (error: unknown) {
      toast.error(apiError(error, 'Could not delete assignment'));
    } finally {
      setSubmitting(false);
    }
  }

  const allRequestableSelected =
    requestable.length > 0 && requestable.every((row) => selected[rowKey(row)]);

  const showBulkActions = lifecycleTab === 'new' || lifecycleTab === 'under_process';

  const statusDefsForTab = STATUS_FILTER_DEFS.filter((def) => def.tabs.includes(lifecycleTab));
  const groupsForTab = STATUS_GROUP_DEFS.filter((group) => group.tabs.includes(lifecycleTab));

  return (
    <>
      <div className="space-y-3">
        <Tabs value={lifecycleTab} onValueChange={changeLifecycleTab} className="gap-3">
          <AnimatedPillTabsList
            value={lifecycleTab}
            className={cn(
              isMobile
                ? 'h-auto flex-col flex-nowrap items-stretch gap-1 rounded-2xl'
                : 'flex-nowrap overflow-x-auto rounded-full'
            )}
          >
            {(Object.keys(TAB_META) as AssignmentLifecycleTab[]).map((tab) => {
              const meta = TAB_META[tab];
              const Icon = meta.icon;
              return (
                <TabsTrigger
                  key={tab}
                  value={tab}
                  className={cn(
                    animatedPillTabsTriggerClassName,
                    'group gap-1.5',
                    isMobile
                      ? 'w-full shrink-0 justify-start px-3 py-2.5'
                      : 'min-w-0 shrink-0 grow basis-0'
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className={cn(isMobile ? 'flex-1 text-left' : 'truncate')}>
                    {meta.label}
                  </span>
                  <span className="rounded-full bg-black/10 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums group-data-[state=active]:bg-white/20">
                    {tabCounts[tab]}
                  </span>
                </TabsTrigger>
              );
            })}
          </AnimatedPillTabsList>

          {(Object.keys(TAB_META) as AssignmentLifecycleTab[]).map((tab) => (
            <TabsContent key={tab} value={tab} className="mt-0 space-y-3">
              <div className="space-y-3 rounded-lg border bg-muted/20 p-3">
                <div className="flex flex-wrap items-end gap-3">
                  <div className="min-w-[200px] flex-1 space-y-2 sm:max-w-md">
                    <Label htmlFor={`my-assignments-search-${tab}`} className="text-xs">
                      Search items
                    </Label>
                    <div className="relative">
                      <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id={`my-assignments-search-${tab}`}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Name, serial, part number, project…"
                        className="pl-9"
                      />
                    </div>
                  </div>
                  {filtersActive ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-9 shrink-0"
                      onClick={clearFilters}
                    >
                      <X className="mr-1 h-4 w-4" />
                      Clear filters
                    </Button>
                  ) : null}
                </div>

                <div className="space-y-2.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <Label className="text-xs text-muted-foreground">Workflow status</Label>
                    {statusDefsForTab
                      .filter((def) => def.key === FILTER_ALL)
                      .map((def) => {
                        const count = statusFilterCounts.get(def.key) ?? 0;
                        const active = statusFilter === def.key;
                        const tone = STATUS_CHIP_TONES[def.tone];
                        return (
                          <button
                            key={def.key}
                            type="button"
                            onClick={() => setStatusFilter(def.key)}
                            className={cn(
                              'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors',
                              active ? tone.active : tone.idle,
                              !active && 'hover:opacity-90'
                            )}
                          >
                            {def.label}
                            <span
                              className={cn(
                                'tabular-nums',
                                active ? 'text-white/80' : 'text-current/70'
                              )}
                            >
                              {count}
                            </span>
                          </button>
                        );
                      })}
                  </div>

                  {groupsForTab.map((group) => {
                    const chips = statusDefsForTab.filter((def) => group.keys.includes(def.key));
                    if (chips.length === 0) return null;
                    return (
                      <div key={group.id} className="space-y-1.5">
                        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                          {group.label}
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {chips.map((def) => {
                            const count = statusFilterCounts.get(def.key) ?? 0;
                            const active = statusFilter === def.key;
                            const disabled = count === 0;
                            const tone = STATUS_CHIP_TONES[def.tone];
                            return (
                              <button
                                key={def.key}
                                type="button"
                                disabled={disabled}
                                onClick={() => setStatusFilter(def.key)}
                                className={cn(
                                  'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors',
                                  active ? tone.active : tone.idle,
                                  disabled && 'cursor-not-allowed opacity-35',
                                  !disabled && !active && 'hover:opacity-90'
                                )}
                              >
                                {def.label}
                                <span
                                  className={cn(
                                    'tabular-nums',
                                    active ? 'text-white/80' : 'text-current/70'
                                  )}
                                >
                                  {count}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {tabRows.length > 0 ? (
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs text-muted-foreground">
                      Showing {filteredRows.length} of {tabRows.length} in {TAB_META[tab].label}
                      {statusFilter !== FILTER_ALL
                        ? ` · ${STATUS_FILTER_DEFS.find((d) => d.key === statusFilter)?.label ?? statusFilter}`
                        : ''}
                    </p>
                    {!isMobile ? (
                      <ColumnVisibilityMenu
                        columns={COLUMN_DEFS}
                        visibleIds={visibleIds}
                        onToggle={toggleColumn}
                        onReset={resetColumns}
                      />
                    ) : null}
                  </div>
                ) : null}
              </div>

              {showBulkActions && tab === lifecycleTab ? (
                <div className="flex flex-wrap gap-2">
                  {!isMobile ? (
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
                  ) : null}
                  <Button
                    size="sm"
                    disabled={submitting || requestable.length === 0}
                    onClick={() => void requestBulk('all')}
                  >
                    Request all
                  </Button>
                </div>
              ) : null}

              <ListContentSuspense loading={loading}>
                {tabRows.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    {rows.length === 0
                      ? 'No hierarchy items have been assigned to you yet.'
                      : TAB_META[tab].empty}
                  </p>
                ) : filteredRows.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    No assignments match the current filters.{' '}
                    <button
                      type="button"
                      className="font-medium text-primary underline-offset-4 hover:underline"
                      onClick={clearFilters}
                    >
                      Clear filters
                    </button>
                  </p>
                ) : (
                  <div className="w-full min-w-0 overflow-x-auto rounded-md border">
                  <Table className={cn(!isMobile && 'min-w-[960px]')}>
                    <TableHeader>
                      <TableRow>
                        {!isMobile && lifecycleTab !== 'completed' ? (
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
                        ) : null}
                        {showColumn('name') && (
                          <SortableTableHead column="name" sort={sort} onSort={cycleSort}>
                            Item
                          </SortableTableHead>
                        )}
                        {showColumn('customer_name') && (
                          <SortableTableHead column="customer_name" sort={sort} onSort={cycleSort}>
                            Customer
                          </SortableTableHead>
                        )}
                        {showColumn('flight_name') && (
                          <SortableTableHead column="flight_name" sort={sort} onSort={cycleSort}>
                            Flight
                          </SortableTableHead>
                        )}
                        {showColumn('system_name') && (
                          <SortableTableHead column="system_name" sort={sort} onSort={cycleSort}>
                            System
                          </SortableTableHead>
                        )}
                        {showColumn('project_name') && (
                          <SortableTableHead column="project_name" sort={sort} onSort={cycleSort}>
                            Project
                          </SortableTableHead>
                        )}
                        {showColumn('serial_number') && (
                          <SortableTableHead column="serial_number" sort={sort} onSort={cycleSort}>
                            Serial
                          </SortableTableHead>
                        )}
                        {showColumn('item_status') && (
                          <SortableTableHead column="item_status" sort={sort} onSort={cycleSort}>
                            Status
                          </SortableTableHead>
                        )}
                        <TableHead className="text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sortedRows.map((row) => {
                        const key = rowKey(row);
                        const primary = primaryStatusLabel(row);
                        return (
                          <TableRow
                            key={key}
                            className="cursor-pointer"
                            onClick={() => {
                              setActivityRow(row);
                              setActivityOpen(true);
                            }}
                          >
                            {!isMobile && lifecycleTab !== 'completed' ? (
                              <TableCell
                                onClick={(event) => event.stopPropagation()}
                              >
                                <Checkbox
                                  checked={Boolean(selected[key])}
                                  disabled={!row.can_request}
                                  onCheckedChange={(checked) =>
                                    setSelected((prev) => ({
                                      ...prev,
                                      [key]: Boolean(checked),
                                    }))
                                  }
                                  aria-label={`Select ${row.name || row.entity_type}`}
                                />
                              </TableCell>
                            ) : null}
                            {showColumn('name') && (
                              <TableCell className={cn(isMobile ? 'min-w-0' : 'max-w-[220px]')}>
                                <div className="truncate font-medium">
                                  {row.name || `${row.entity_type} #${row.entity_id}`}
                                </div>
                                <div className="truncate text-xs text-muted-foreground">
                                  {row.entity_type}
                                  {row.part_number ? ` · ${row.part_number}` : ''}
                                </div>
                                {row.last_mark_back_reason ? (
                                  <div className="mt-1 max-w-xs truncate text-xs text-amber-700 dark:text-amber-400">
                                    Marked back: {row.last_mark_back_reason}
                                  </div>
                                ) : null}
                              </TableCell>
                            )}
                            {showColumn('customer_name') && (
                              <TableCell className="max-w-[140px] truncate">
                                {row.customer_name || '—'}
                              </TableCell>
                            )}
                            {showColumn('flight_name') && (
                              <TableCell className="max-w-[120px] truncate">
                                {row.flight_name || '—'}
                              </TableCell>
                            )}
                            {showColumn('system_name') && (
                              <TableCell className="max-w-[140px] truncate">
                                {row.system_name || '—'}
                              </TableCell>
                            )}
                            {showColumn('project_name') && (
                              <TableCell className="max-w-[160px] truncate">
                                {row.project_name || '—'}
                              </TableCell>
                            )}
                            {showColumn('serial_number') && (
                              <TableCell className="max-w-[120px] truncate">
                                {row.serial_number || '—'}
                              </TableCell>
                            )}
                            {showColumn('item_status') && (
                              <TableCell onClick={(event) => event.stopPropagation()}>
                                <div className="flex flex-wrap gap-1">
                                  {primary === 'Awaiting HM' ? (
                                    <Popover>
                                      <PopoverTrigger asChild>
                                        <button
                                          type="button"
                                          className={cn(
                                            'inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-medium',
                                            ROW_STATUS_TONES['Awaiting HM'],
                                            'cursor-pointer hover:opacity-90'
                                          )}
                                        >
                                          Awaiting HM
                                        </button>
                                      </PopoverTrigger>
                                      <PopoverContent className="w-64 p-3" align="start">
                                        <p className="text-xs font-medium text-muted-foreground">
                                          Assigned Hierarchy Manager
                                        </p>
                                        <p className="mt-1 text-sm font-medium">
                                          {row.assigned_hm_name?.trim() ||
                                            (row.assigned_hm_id
                                              ? `User #${row.assigned_hm_id}`
                                              : 'No HM assigned on this project')}
                                        </p>
                                      </PopoverContent>
                                    </Popover>
                                  ) : (
                                    <StatusChip label={primary} />
                                  )}
                                  {row.test_result === 'pass' && !row.verified ? (
                                    <StatusChip label="Pass" />
                                  ) : null}
                                  {row.defect_pending ? <StatusChip label="Fail" /> : null}
                                  {row.rework_stage ? (
                                    <span
                                      className={cn(
                                        'inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-medium',
                                        STATUS_CHIP_TONES.rose.idle
                                      )}
                                    >
                                      Attempt {row.rework_attempt_count || 1} · {row.rework_stage}
                                    </span>
                                  ) : null}
                                </div>
                              </TableCell>
                            )}
                            <TableCell
                              className="text-right"
                              onClick={(event) => event.stopPropagation()}
                            >
                              {lifecycleTab === 'completed' ? (
                                canDeleteCompleted ? (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    disabled={submitting}
                                    className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                                    onClick={() => setDeleteTarget(row)}
                                    aria-label={`Delete ${row.name || row.entity_type}`}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                ) : (
                                  <span className="text-xs text-muted-foreground">Verified</span>
                                )
                              ) : row.can_request ? (
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
                                    {(row.rejection_count ?? 0) > 0 ||
                                    (row.rejection_history?.length ?? 0) > 0 ? (
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        disabled={submitting}
                                        onClick={() =>
                                          setRejectionView({
                                            label:
                                              row.name || `${row.entity_type} #${row.entity_id}`,
                                            history: row.rejection_history ?? [],
                                          })
                                        }
                                      >
                                        Rejection Reasons
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
                                    {row.defect_pending &&
                                    !row.can_remove &&
                                    !row.can_return &&
                                    !row.can_install &&
                                    !row.can_test ? (
                                      <span className="text-xs text-muted-foreground">
                                        Waiting for IM inspect
                                      </span>
                                    ) : null}
                                    {!row.can_install &&
                                    !row.can_test &&
                                    !row.can_report_complete &&
                                    !row.can_remove &&
                                    !row.can_return &&
                                    !row.defect_pending &&
                                    !(row.rejection_count ?? 0) ? (
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
                  </div>
                )}
              </ListContentSuspense>
            </TabsContent>
          ))}
        </Tabs>
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
    <RejectionReasonsDialog
      open={rejectionView != null}
      onOpenChange={(open) => {
        if (!open) setRejectionView(null);
      }}
      itemLabel={rejectionView?.label}
      history={rejectionView?.history}
    />
      <AssignmentActivitySheet
        row={activityRow}
        open={activityOpen}
        onOpenChange={(open) => {
          setActivityOpen(open);
          // Keep row data mounted through the close animation so width stays stable.
          if (!open) {
            window.setTimeout(() => setActivityRow(null), 220);
          }
        }}
      />
      <ConfirmDialog
        open={deleteTarget != null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title="Delete completed assignment"
        description={`Permanently remove "${
          deleteTarget?.name ||
          `${deleteTarget?.entity_type ?? ''} #${deleteTarget?.entity_id ?? ''}`
        }" from My Assignments. Install verification history is kept; only the assignment entry is removed. New and in-progress tasks cannot be deleted.`}
        onConfirm={() => {
          void confirmDeleteCompleted();
        }}
      />
    </>
  );
}

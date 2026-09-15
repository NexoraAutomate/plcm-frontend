'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Search, X } from 'lucide-react';
import { toast } from 'sonner';
import * as api from '@/lib/api';
import type { DeveloperAssignedWork, ItemInstallRejection } from '@/lib/models';
import { ENTITY_TYPE_DB_LABELS } from '@/lib/entity-resolver';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { HierarchySearchCombobox } from '@/components/hierarchy-dashboard/hierarchy-search-combobox';
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
import { RejectionReasonsDialog } from '@/components/inventory/rejection-reasons-dialog';
import { usePageDataRefresh } from '@/components/page-data-refresh';

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
  if (row.reserved) return 'Reserved';
  return 'Assigned';
}

function apiError(error: unknown, fallback: string) {
  const detail =
    (error as { response?: { data?: { detail?: string } } })?.response?.data?.detail || fallback;
  return typeof detail === 'string' ? detail : fallback;
}

const FILTER_ALL = 'all';

type AssignmentStatusFilter =
  | typeof FILTER_ALL
  | 'needs_action'
  | 'ready_to_request'
  | 'reserved'
  | 'requested'
  | 'issued'
  | 'installing'
  | 'testing'
  | 'rework'
  | 'complete_reported'
  | 'rejected'
  | 'verified';

const STATUS_FILTER_DEFS: {
  key: AssignmentStatusFilter;
  label: string;
  badgeStatus?: string;
}[] = [
  { key: FILTER_ALL, label: 'All' },
  { key: 'needs_action', label: 'Needs action' },
  { key: 'ready_to_request', label: 'Ready to request' },
  { key: 'reserved', label: 'Reserved', badgeStatus: 'RESERVED' },
  { key: 'requested', label: 'Requested' },
  { key: 'issued', label: 'Issued', badgeStatus: 'ISSUED' },
  { key: 'installing', label: 'Installing', badgeStatus: 'INSTALLATION_IN_PROGRESS' },
  { key: 'testing', label: 'Testing', badgeStatus: 'UNDER_TESTING_REVIEW' },
  { key: 'rework', label: 'Rework / fail' },
  { key: 'complete_reported', label: 'Awaiting HM accept' },
  { key: 'rejected', label: 'Installation rejected', badgeStatus: 'INSTALLATION_REJECTED' },
  { key: 'verified', label: 'Verified', badgeStatus: 'INSTALLED_VERIFIED' },
];

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

function rowMatchesStatusFilter(row: DeveloperAssignedWork, filter: AssignmentStatusFilter) {
  if (filter === FILTER_ALL) return true;
  switch (filter) {
    case 'needs_action':
      return rowNeedsAction(row);
    case 'ready_to_request':
      return row.can_request;
    case 'reserved':
      return row.reserved && !row.issued;
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
    row.entity_type,
    row.entity_id != null ? String(row.entity_id) : '',
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return haystack.includes(q);
}

export function MyAssignmentsPanel() {
  const [rows, setRows] = useState<DeveloperAssignedWork[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [projectFilter, setProjectFilter] = useState<string | undefined>();
  const [entityTypeFilter, setEntityTypeFilter] = useState(FILTER_ALL);
  const [statusFilter, setStatusFilter] = useState<AssignmentStatusFilter>(FILTER_ALL);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [submitting, setSubmitting] = useState(false);
  const [reworkTarget, setReworkTarget] = useState<ReworkWizardTarget | null>(null);
  const [rejectionView, setRejectionView] = useState<{
    label: string;
    history: ItemInstallRejection[];
  } | null>(null);

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

  const projectOptions = useMemo(() => {
    const byId = new Map<number, string>();
    for (const row of rows) {
      if (row.project_id == null) continue;
      byId.set(row.project_id, row.project_name?.trim() || `Project #${row.project_id}`);
    }
    return [...byId.entries()]
      .sort(([, a], [, b]) => a.localeCompare(b))
      .map(([id, label]) => ({ value: String(id), label }));
  }, [rows]);

  const entityTypeOptions = useMemo(() => {
    const types = new Set<string>();
    for (const row of rows) {
      if (row.entity_type) types.add(row.entity_type.toLowerCase());
    }
    return [...types].sort((a, b) => {
      const la = ENTITY_TYPE_DB_LABELS[a] ?? a;
      const lb = ENTITY_TYPE_DB_LABELS[b] ?? b;
      return la.localeCompare(lb);
    });
  }, [rows]);

  const statusFilterCounts = useMemo(() => {
    const counts = new Map<AssignmentStatusFilter, number>();
    for (const def of STATUS_FILTER_DEFS) {
      counts.set(def.key, 0);
    }
    for (const row of rows) {
      counts.set(FILTER_ALL, (counts.get(FILTER_ALL) ?? 0) + 1);
      for (const def of STATUS_FILTER_DEFS) {
        if (def.key === FILTER_ALL) continue;
        if (rowMatchesStatusFilter(row, def.key)) {
          counts.set(def.key, (counts.get(def.key) ?? 0) + 1);
        }
      }
    }
    return counts;
  }, [rows]);

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      if (!rowMatchesSearch(row, searchQuery)) return false;
      if (projectFilter && String(row.project_id ?? '') !== projectFilter) return false;
      if (
        entityTypeFilter !== FILTER_ALL &&
        row.entity_type.toLowerCase() !== entityTypeFilter
      ) {
        return false;
      }
      if (!rowMatchesStatusFilter(row, statusFilter)) return false;
      return true;
    });
  }, [rows, searchQuery, projectFilter, entityTypeFilter, statusFilter]);

  const filtersActive =
    searchQuery.trim().length > 0 ||
    projectFilter != null ||
    entityTypeFilter !== FILTER_ALL ||
    statusFilter !== FILTER_ALL;

  const selectedRows = useMemo(
    () => filteredRows.filter((row) => selected[rowKey(row)]),
    [filteredRows, selected]
  );
  const requestable = filteredRows.filter((row) => row.can_request);
  const reservedCount = filteredRows.filter((row) => row.reserved && !row.issued).length;

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
      toast.success('Installation complete reported — waiting for HM accept');
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
      <div className="space-y-3 rounded-lg border bg-muted/20 p-3">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[200px] flex-1 space-y-2 sm:max-w-md">
            <Label htmlFor="my-assignments-search" className="text-xs">
              Search items
            </Label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="my-assignments-search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Name, serial, part number, project…"
                className="pl-9"
              />
            </div>
          </div>
          <HierarchySearchCombobox
            label="Project"
            labelClassName="text-xs"
            placeholder="All projects"
            value={projectFilter}
            options={projectOptions}
            onChange={setProjectFilter}
            onClear={() => setProjectFilter(undefined)}
            className="w-full sm:w-[240px]"
            triggerClassName="h-9"
          />
          <div className="w-full space-y-2 sm:w-[200px]">
            <Label className="text-xs">Item category</Label>
            <Select value={entityTypeFilter} onValueChange={setEntityTypeFilter}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="All categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={FILTER_ALL}>All categories</SelectItem>
                {entityTypeOptions.map((type) => (
                  <SelectItem key={type} value={type}>
                    {ENTITY_TYPE_DB_LABELS[type] ?? type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {filtersActive ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-9 shrink-0"
              onClick={() => {
                setSearchQuery('');
                setProjectFilter(undefined);
                setEntityTypeFilter(FILTER_ALL);
                setStatusFilter(FILTER_ALL);
              }}
            >
              <X className="mr-1 h-4 w-4" />
              Clear filters
            </Button>
          ) : null}
        </div>
        <div className="space-y-2">
          <Label className="text-xs">Workflow status</Label>
          <div className="flex flex-wrap gap-1.5">
            {STATUS_FILTER_DEFS.map((def) => {
              const count = statusFilterCounts.get(def.key) ?? 0;
              const active = statusFilter === def.key;
              const disabled = def.key !== FILTER_ALL && count === 0;
              return (
                <button
                  key={def.key}
                  type="button"
                  disabled={disabled}
                  onClick={() => setStatusFilter(def.key)}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-left transition-colors',
                    active && 'border-primary bg-primary/5 ring-1 ring-primary/30',
                    disabled && 'cursor-not-allowed opacity-40',
                    !disabled && !active && 'hover:bg-muted/60'
                  )}
                >
                  {def.badgeStatus ? (
                    <StatusBadge status={def.badgeStatus} className="pointer-events-none text-[10px]" />
                  ) : (
                    <Badge variant={active ? 'default' : 'outline'} className="pointer-events-none text-[10px]">
                      {def.label}
                    </Badge>
                  )}
                  <span className="text-xs tabular-nums text-muted-foreground">{count}</span>
                </button>
              );
            })}
          </div>
        </div>
        {rows.length > 0 ? (
          <p className="text-xs text-muted-foreground">
            Showing {filteredRows.length} of {rows.length} assignment
            {rows.length === 1 ? '' : 's'}
            {statusFilter !== FILTER_ALL
              ? ` · ${STATUS_FILTER_DEFS.find((d) => d.key === statusFilter)?.label ?? statusFilter}`
              : ''}
          </p>
        ) : null}
      </div>
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
        ) : filteredRows.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No assignments match the current filters.{' '}
            <button
              type="button"
              className="font-medium text-primary underline-offset-4 hover:underline"
              onClick={() => {
                setSearchQuery('');
                setProjectFilter(undefined);
                setEntityTypeFilter(FILTER_ALL);
                setStatusFilter(FILTER_ALL);
              }}
            >
              Clear filters
            </button>
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
              {filteredRows.map((row) => {
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
                            {(row.rejection_count ?? 0) > 0 ||
                            (row.rejection_history?.length ?? 0) > 0 ? (
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={submitting}
                                onClick={() =>
                                  setRejectionView({
                                    label: row.name || `${row.entity_type} #${row.entity_id}`,
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

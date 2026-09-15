'use client';

import { WORKFLOW_POLL_MS } from '@/lib/data-loading';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Search, X } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import * as api from '@/lib/api';
import type { ItemInstallRejection, ItemInstallState } from '@/lib/models';
import { ENTITY_TYPE_DB_LABELS } from '@/lib/entity-resolver';
import { cn } from '@/lib/utils';
import { parseApiDate } from '@/lib/parse-api-date';
import { queryKeys } from '@/hooks/queries/query-keys';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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

const FILTER_ALL = 'all';

type VerifyQueueStatusFilter =
  | typeof FILTER_ALL
  | 'ready_to_accept'
  | 'under_review'
  | 'prior_rejection';

const STATUS_FILTER_DEFS: {
  key: VerifyQueueStatusFilter;
  label: string;
  badgeStatus?: string;
}[] = [
  { key: FILTER_ALL, label: 'All' },
  { key: 'ready_to_accept', label: 'Ready to accept' },
  { key: 'under_review', label: 'Under testing / review', badgeStatus: 'UNDER_TESTING_REVIEW' },
  { key: 'prior_rejection', label: 'Prior rejection' },
];

function rowMatchesSearch(row: ItemInstallState, query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const haystack = [
    row.entity_name,
    row.part_number,
    row.serial_number,
    row.project_name,
    row.entity_type,
    row.entity_id != null ? String(row.entity_id) : '',
    row.assigned_developer_name,
    row.item_status,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return haystack.includes(q);
}

function rowMatchesStatusFilter(row: ItemInstallState, filter: VerifyQueueStatusFilter) {
  if (filter === FILTER_ALL) return true;
  switch (filter) {
    case 'ready_to_accept':
      return row.complete_reported && !row.verified;
    case 'under_review':
      return (
        row.item_status === 'UNDER_TESTING_REVIEW' ||
        (!row.item_status && row.complete_reported)
      );
    case 'prior_rejection':
      return (row.rejection_count ?? 0) > 0 || (row.rejection_history?.length ?? 0) > 0;
    default:
      return true;
  }
}

export function VerifyQueuePanel() {
  const queryClient = useQueryClient();
  const [rows, setRows] = useState<ItemInstallState[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [projectFilter, setProjectFilter] = useState<string | undefined>();
  const [entityTypeFilter, setEntityTypeFilter] = useState(FILTER_ALL);
  const [developerFilter, setDeveloperFilter] = useState<string | undefined>();
  const [statusFilter, setStatusFilter] = useState<VerifyQueueStatusFilter>(FILTER_ALL);
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
    const timer = window.setInterval(() => void refresh(), WORKFLOW_POLL_MS);
    return () => window.clearInterval(timer);
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

  const developerOptions = useMemo(() => {
    const byId = new Map<number, string>();
    for (const row of rows) {
      if (row.assigned_developer_id == null) continue;
      byId.set(
        row.assigned_developer_id,
        row.assigned_developer_name?.trim() || `User #${row.assigned_developer_id}`
      );
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
    const counts = new Map<VerifyQueueStatusFilter, number>();
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
      if (
        developerFilter &&
        String(row.assigned_developer_id ?? '') !== developerFilter
      ) {
        return false;
      }
      if (!rowMatchesStatusFilter(row, statusFilter)) return false;
      return true;
    });
  }, [rows, searchQuery, projectFilter, entityTypeFilter, developerFilter, statusFilter]);

  const filtersActive =
    searchQuery.trim().length > 0 ||
    projectFilter != null ||
    entityTypeFilter !== FILTER_ALL ||
    developerFilter != null ||
    statusFilter !== FILTER_ALL;

  function clearFilters() {
    setSearchQuery('');
    setProjectFilter(undefined);
    setEntityTypeFilter(FILTER_ALL);
    setDeveloperFilter(undefined);
    setStatusFilter(FILTER_ALL);
  }

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
      <div className="mb-3 space-y-3 rounded-lg border bg-muted/20 p-3">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[200px] flex-1 space-y-2 sm:max-w-md">
            <Label htmlFor="verify-queue-search" className="text-xs">
              Search items
            </Label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="verify-queue-search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Name, serial, developer, project…"
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
            className="w-full sm:w-[220px]"
            triggerClassName="h-9"
          />
          <div className="w-full space-y-2 sm:w-[180px]">
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
          <HierarchySearchCombobox
            label="Developer"
            labelClassName="text-xs"
            placeholder="All developers"
            value={developerFilter}
            options={developerOptions}
            onChange={setDeveloperFilter}
            onClear={() => setDeveloperFilter(undefined)}
            className="w-full sm:w-[220px]"
            triggerClassName="h-9"
          />
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
        <div className="space-y-2">
          <Label className="text-xs">Verification status</Label>
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
            Showing {filteredRows.length} of {rows.length} item
            {rows.length === 1 ? '' : 's'} awaiting verification
            {statusFilter !== FILTER_ALL
              ? ` · ${STATUS_FILTER_DEFS.find((d) => d.key === statusFilter)?.label ?? statusFilter}`
              : ''}
          </p>
        ) : null}
      </div>
      <ListContentSuspense loading={loading}>
        {rows.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No items are waiting for verification.
          </p>
        ) : filteredRows.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No items match the current filters.{' '}
            <button
              type="button"
              className="font-medium text-primary underline-offset-4 hover:underline"
              onClick={clearFilters}
            >
              Clear filters
            </button>
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
              {filteredRows.map((row) => (
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

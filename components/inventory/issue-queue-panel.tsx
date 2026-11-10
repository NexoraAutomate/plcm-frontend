'use client';

import { WORKFLOW_POLL_MS } from '@/lib/data-loading';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Download, Search, X } from 'lucide-react';
import { toast } from 'sonner';
import * as api from '@/lib/api';
import type { ItemIssueRequest } from '@/lib/models';
import { ENTITY_TYPE_DB_LABELS } from '@/lib/entity-resolver';
import { cn } from '@/lib/utils';
import { parseApiDate } from '@/lib/parse-api-date';
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
import { StatusBadge } from '@/components/status-badge';
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
import { usePageDataRefresh } from '@/components/page-data-refresh';
import { invalidatePendingActionCounts } from '@/hooks/use-pending-action-counts';
import {
  uploadIssuanceProformaIfNeeded,
  uploadIssuanceProformaToManyIfNeeded,
} from '@/lib/issuance-signature';
import { downloadMultiItemIssuanceForm } from '@/lib/download-multi-issuance-form';
import { IssuanceRemarksDialog } from '@/components/inventory/issuance-remarks-dialog';
import { useQueryClient } from '@tanstack/react-query';
import { SortableTableHead } from '@/components/data-table/sortable-table-head';
import { ColumnVisibilityMenu } from '@/components/data-table/column-visibility-menu';
import { useColumnVisibility, type ColumnVisibilityDef } from '@/hooks/use-column-visibility';
import { useClientTableSort } from '@/hooks/use-table-sorting';

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

function apiErrorDetail(error: unknown, fallback: string) {
  const detail = (error as { response?: { data?: { detail?: string } } })?.response?.data
    ?.detail;
  return typeof detail === 'string' ? detail : fallback;
}

const FILTER_ALL = 'all';

type IssueQueueStatusFilter = typeof FILTER_ALL | 'pending' | 'reserved';

const STATUS_FILTER_DEFS: {
  key: IssueQueueStatusFilter;
  label: string;
  badgeStatus?: string;
}[] = [
  { key: FILTER_ALL, label: 'All' },
  { key: 'pending', label: 'Pending request', badgeStatus: 'pending' },
  { key: 'reserved', label: 'Reserved stock', badgeStatus: 'RESERVED' },
];

function rowMatchesSearch(row: ItemIssueRequest, query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const haystack = [
    row.inventory_name,
    row.part_number,
    row.serial_number,
    row.project_name,
    row.target_entity_name,
    row.target_entity_type,
    row.target_entity_id != null ? String(row.target_entity_id) : '',
    row.assigned_developer_name,
    row.requested_by_name,
    row.flight_code,
    row.flight_name,
    row.sdls_code,
    row.sdls_name,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return haystack.includes(q);
}

function rowMatchesStatusFilter(row: ItemIssueRequest, filter: IssueQueueStatusFilter) {
  if (filter === FILTER_ALL) return true;
  if (filter === 'pending') return row.status === 'pending';
  if (filter === 'reserved') return row.status === 'pending' && row.reservation_id != null;
  return true;
}

const COLUMN_DEFS: ColumnVisibilityDef[] = [
  { id: 'inventory_name', label: 'Item', alwaysVisible: true },
  { id: 'project_name', label: 'Project' },
  { id: 'serial_number', label: 'Serial' },
  { id: 'target_entity_name', label: 'Hierarchy' },
  { id: 'assigned_developer_name', label: 'Developer' },
  { id: 'requested_at', label: 'Requested' },
];

export function IssueQueuePanel() {
  const { visibleIds, isVisible, toggleColumn, resetColumns } = useColumnVisibility('issue-queue-list', COLUMN_DEFS);
  const [rows, setRows] = useState<ItemIssueRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [projectFilter, setProjectFilter] = useState<string | undefined>();
  const [entityTypeFilter, setEntityTypeFilter] = useState(FILTER_ALL);
  const [developerFilter, setDeveloperFilter] = useState<string | undefined>();
  const [sdlsFilter, setSdlsFilter] = useState<string | undefined>();
  const [flightFilter, setFlightFilter] = useState<string | undefined>();
  const [statusFilter, setStatusFilter] = useState<IssueQueueStatusFilter>(FILTER_ALL);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [issueRows, setIssueRows] = useState<ItemIssueRequest[]>([]);
  const [markBackRows, setMarkBackRows] = useState<ItemIssueRequest[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [markingBack, setMarkingBack] = useState(false);
  const signature = useIssueSignature();

  const queryClient = useQueryClient();
  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.inventory.listItemRequests({ status: 'pending' });
      const nextRows = res.data ?? [];
      setRows(nextRows);
      setSelectedIds((prev) => {
        const valid = new Set(nextRows.map((row) => row.id));
        return prev.filter((id) => valid.has(id));
      });
      await invalidatePendingActionCounts(queryClient);
    } catch {
      toast.error('Failed to load issue queue');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [queryClient]);

  usePageDataRefresh(refresh);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => void refresh(), WORKFLOW_POLL_MS);
    return () => window.clearInterval(timer);
  }, [refresh]);

  const projectOptions = useMemo(() => {
    const byId = new Map<number, string>();
    for (const row of rows) {
      byId.set(row.project_id, row.project_name?.trim() || `Project #${row.project_id}`);
    }
    return [...byId.entries()]
      .sort(([, a], [, b]) => a.localeCompare(b))
      .map(([id, label]) => ({ value: String(id), label }));
  }, [rows]);

  const developerOptions = useMemo(() => {
    const byId = new Map<number, string>();
    for (const row of rows) {
      byId.set(
        row.assigned_developer_id,
        row.assigned_developer_name?.trim() || `User #${row.assigned_developer_id}`
      );
    }
    return [...byId.entries()]
      .sort(([, a], [, b]) => a.localeCompare(b))
      .map(([id, label]) => ({ value: String(id), label }));
  }, [rows]);

  const sdlsOptions = useMemo(() => {
    const byId = new Map<number, string>();
    for (const row of rows) {
      const label =
        [row.sdls_code, row.sdls_name].filter(Boolean).join(' · ') ||
        `SDLS #${row.sdls_id}`;
      byId.set(row.sdls_id, label);
    }
    return [...byId.entries()]
      .sort(([, a], [, b]) => a.localeCompare(b))
      .map(([id, label]) => ({ value: String(id), label }));
  }, [rows]);

  const flightOptions = useMemo(() => {
    const byId = new Map<number, string>();
    for (const row of rows) {
      const label =
        [row.flight_code, row.flight_name].filter(Boolean).join(' · ') ||
        `Flight #${row.flight_id}`;
      byId.set(row.flight_id, label);
    }
    return [...byId.entries()]
      .sort(([, a], [, b]) => a.localeCompare(b))
      .map(([id, label]) => ({ value: String(id), label }));
  }, [rows]);

  const entityTypeOptions = useMemo(() => {
    const types = new Set<string>();
    for (const row of rows) {
      if (row.target_entity_type) types.add(row.target_entity_type.toLowerCase());
    }
    return [...types].sort((a, b) => {
      const la = ENTITY_TYPE_DB_LABELS[a] ?? a;
      const lb = ENTITY_TYPE_DB_LABELS[b] ?? b;
      return la.localeCompare(lb);
    });
  }, [rows]);

  const statusFilterCounts = useMemo(() => {
    const counts = new Map<IssueQueueStatusFilter, number>();
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
      if (projectFilter && String(row.project_id) !== projectFilter) return false;
      if (
        entityTypeFilter !== FILTER_ALL &&
        row.target_entity_type.toLowerCase() !== entityTypeFilter
      ) {
        return false;
      }
      if (developerFilter && String(row.assigned_developer_id) !== developerFilter) return false;
      if (sdlsFilter && String(row.sdls_id) !== sdlsFilter) return false;
      if (flightFilter && String(row.flight_id) !== flightFilter) return false;
      if (!rowMatchesStatusFilter(row, statusFilter)) return false;
      return true;
    });
  }, [
    rows,
    searchQuery,
    projectFilter,
    entityTypeFilter,
    developerFilter,
    sdlsFilter,
    flightFilter,
    statusFilter,
  ]);

  const { sort, cycleSort, sortedRows } = useClientTableSort(filteredRows);

  const selectedRows = useMemo(() => {
    const byId = new Map(rows.map((row) => [row.id, row]));
    return selectedIds
      .map((id) => byId.get(id))
      .filter((row): row is ItemIssueRequest => row != null);
  }, [rows, selectedIds]);

  const selectedDeveloperId = selectedRows[0]?.assigned_developer_id ?? null;
  const selectedDeveloperName =
    selectedRows[0]?.assigned_developer_name?.trim() ||
    (selectedDeveloperId != null ? `User #${selectedDeveloperId}` : null);

  const selectableFilteredRows = useMemo(() => {
    if (selectedDeveloperId == null) return sortedRows;
    return sortedRows.filter((row) => row.assigned_developer_id === selectedDeveloperId);
  }, [sortedRows, selectedDeveloperId]);

  const allVisibleSelected =
    selectableFilteredRows.length > 0 &&
    selectableFilteredRows.every((row) => selectedIds.includes(row.id));

  const filtersActive =
    searchQuery.trim().length > 0 ||
    projectFilter != null ||
    entityTypeFilter !== FILTER_ALL ||
    developerFilter != null ||
    sdlsFilter != null ||
    flightFilter != null ||
    statusFilter !== FILTER_ALL;

  function clearFilters() {
    setSearchQuery('');
    setProjectFilter(undefined);
    setEntityTypeFilter(FILTER_ALL);
    setDeveloperFilter(undefined);
    setSdlsFilter(undefined);
    setFlightFilter(undefined);
    setStatusFilter(FILTER_ALL);
  }

  function toggleRowSelected(row: ItemIssueRequest, checked: boolean) {
    if (checked) {
      if (
        selectedDeveloperId != null &&
        row.assigned_developer_id !== selectedDeveloperId
      ) {
        toast.error('Select requests for one developer at a time');
        return;
      }
      setSelectedIds((prev) => (prev.includes(row.id) ? prev : [...prev, row.id]));
      return;
    }
    setSelectedIds((prev) => prev.filter((id) => id !== row.id));
  }

  function toggleSelectAllVisible(checked: boolean) {
    if (!checked) {
      const visibleIds = new Set(selectableFilteredRows.map((row) => row.id));
      setSelectedIds((prev) => prev.filter((id) => !visibleIds.has(id)));
      return;
    }
    if (selectableFilteredRows.length === 0) return;
    const developerId = selectedDeveloperId ?? selectableFilteredRows[0].assigned_developer_id;
    const nextIds = selectableFilteredRows
      .filter((row) => row.assigned_developer_id === developerId)
      .map((row) => row.id);
    setSelectedIds((prev) => {
      const keep = prev.filter((id) => {
        const row = rows.find((r) => r.id === id);
        return row != null && row.assigned_developer_id === developerId;
      });
      return [...new Set([...keep, ...nextIds])];
    });
  }

  function openIssueDialog(targetRows: ItemIssueRequest[]) {
    if (targetRows.length === 0) return;
    const developerIds = new Set(targetRows.map((row) => row.assigned_developer_id));
    if (developerIds.size !== 1) {
      toast.error('Select requests for one developer at a time');
      return;
    }
    signature.reset();
    setIssueRows(targetRows);
  }

  function openMarkBackDialog(targetRows: ItemIssueRequest[]) {
    if (targetRows.length === 0) return;
    const developerIds = new Set(targetRows.map((row) => row.assigned_developer_id));
    if (developerIds.size !== 1) {
      toast.error('Select requests for one developer at a time');
      return;
    }
    setMarkBackRows(targetRows);
  }

  function handleDownloadIssuanceForm() {
    try {
      downloadMultiItemIssuanceForm(issueRows);
      toast.success('Issuance form downloaded');
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Unable to download issuance form');
    }
  }

  async function handleIssue() {
    if (issueRows.length === 0) return;
    const signatureError = signature.validationError();
    if (signatureError) {
      toast.error(signatureError);
      return;
    }
    const signed = signature.payload();
    if (!signed) return;
    setSubmitting(true);
    try {
      if (issueRows.length === 1) {
        const res = await api.inventory.issueItemRequest(issueRows[0].id, signed);
        await uploadIssuanceProformaIfNeeded(
          res.data?.issued_issuance_id,
          signature.signatureType,
          signature.proformaFile
        );
        toast.success('Item issued to developer');
      } else {
        const res = await api.inventory.issueItemRequestsBulk({
          request_ids: issueRows.map((row) => row.id),
          ...signed,
        });
        const issued = res.data?.items ?? [];
        await uploadIssuanceProformaToManyIfNeeded(
          issued.map((row) => row.issued_issuance_id),
          signature.signatureType,
          signature.proformaFile
        );
        toast.success(`${issued.length || issueRows.length} items issued to developer`);
      }
      setIssueRows([]);
      setSelectedIds([]);
      signature.reset();
      await refresh();
    } catch (error: unknown) {
      toast.error(apiErrorDetail(error, 'Issue failed'));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleMarkBack(notes: string) {
    if (markBackRows.length === 0) return;
    setMarkingBack(true);
    try {
      if (markBackRows.length === 1) {
        await api.inventory.markBackItemRequest(markBackRows[0].id, notes);
        toast.success('Request marked back to developer');
      } else {
        const res = await api.inventory.markBackItemRequestsBulk({
          request_ids: markBackRows.map((row) => row.id),
          notes,
        });
        const count = res.data?.items?.length || markBackRows.length;
        toast.success(`${count} requests marked back to developer`);
      }
      setMarkBackRows([]);
      setSelectedIds([]);
      await refresh();
    } catch (error: unknown) {
      toast.error(apiErrorDetail(error, 'Mark back failed'));
    } finally {
      setMarkingBack(false);
    }
  }

  const issueDeveloperName =
    issueRows[0]?.assigned_developer_name?.trim() ||
    (issueRows[0] ? `User #${issueRows[0].assigned_developer_id}` : '');

  return (
    <>
      <div className="mb-3 space-y-3 rounded-lg border bg-muted/20 p-3">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[200px] flex-1 space-y-2 sm:max-w-md">
            <Label htmlFor="issue-queue-search" className="text-xs">
              Search requests
            </Label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="issue-queue-search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Item, serial, developer, hierarchy…"
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
          {flightOptions.length > 1 ? (
            <HierarchySearchCombobox
              label="Flight"
              labelClassName="text-xs"
              placeholder="All flights"
              value={flightFilter}
              options={flightOptions}
              onChange={setFlightFilter}
              onClear={() => setFlightFilter(undefined)}
              className="w-full sm:w-[220px]"
              triggerClassName="h-9"
            />
          ) : null}
          {sdlsOptions.length > 1 ? (
            <HierarchySearchCombobox
              label="SDLS"
              labelClassName="text-xs"
              placeholder="All SDLS"
              value={sdlsFilter}
              options={sdlsOptions}
              onChange={setSdlsFilter}
              onClear={() => setSdlsFilter(undefined)}
              className="w-full sm:w-[220px]"
              triggerClassName="h-9"
            />
          ) : null}
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
          <Label className="text-xs">Request status</Label>
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
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">
              Showing {filteredRows.length} of {rows.length} pending request
              {rows.length === 1 ? '' : 's'}
              {statusFilter !== FILTER_ALL
                ? ` · ${STATUS_FILTER_DEFS.find((d) => d.key === statusFilter)?.label ?? statusFilter}`
                : ''}
            </p>
            <ColumnVisibilityMenu
              columns={COLUMN_DEFS}
              visibleIds={visibleIds}
              onToggle={toggleColumn}
              onReset={resetColumns}
            />
          </div>
        ) : null}
      </div>

      {selectedRows.length > 0 ? (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-muted/20 px-3 py-2">
          <p className="text-sm text-muted-foreground">
            {selectedRows.length} selected
            {selectedDeveloperName ? ` · ${selectedDeveloperName}` : ''}
            <span className="text-xs"> (same developer only)</span>
          </p>
          <Can permission={[P.inventory_issue_workflow, P.issue_inventory]}>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => openMarkBackDialog(selectedRows)}
                disabled={submitting || markingBack}
              >
                Mark back selected
              </Button>
              <Button
                size="sm"
                onClick={() => openIssueDialog(selectedRows)}
                disabled={submitting || markingBack}
              >
                Issue selected
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setSelectedIds([])}
                disabled={submitting || markingBack}
              >
                Clear
              </Button>
            </div>
          </Can>
        </div>
      ) : null}

      <ListContentSuspense loading={loading}>
        {rows.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No pending developer requests.
          </p>
        ) : filteredRows.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No requests match the current filters.{' '}
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
                <TableHead className="w-10">
                  <Can permission={[P.inventory_issue_workflow, P.issue_inventory]}>
                    <Checkbox
                      checked={allVisibleSelected}
                      onCheckedChange={(checked) => toggleSelectAllVisible(checked === true)}
                      aria-label="Select all visible requests for one developer"
                    />
                  </Can>
                </TableHead>
                {isVisible('inventory_name') && (
                  <SortableTableHead column="inventory_name" sort={sort} onSort={cycleSort}>
                    Item
                  </SortableTableHead>
                )}
                {isVisible('project_name') && (
                  <SortableTableHead column="project_name" sort={sort} onSort={cycleSort}>
                    Project
                  </SortableTableHead>
                )}
                {isVisible('serial_number') && (
                  <SortableTableHead column="serial_number" sort={sort} onSort={cycleSort}>
                    Serial
                  </SortableTableHead>
                )}
                {isVisible('target_entity_name') && (
                  <SortableTableHead column="target_entity_name" sort={sort} onSort={cycleSort}>
                    Hierarchy
                  </SortableTableHead>
                )}
                {isVisible('assigned_developer_name') && (
                  <SortableTableHead column="assigned_developer_name" sort={sort} onSort={cycleSort}>
                    Developer
                  </SortableTableHead>
                )}
                {isVisible('requested_at') && (
                  <SortableTableHead column="requested_at" sort={sort} onSort={cycleSort}>
                    Requested
                  </SortableTableHead>
                )}
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedRows.map((row) => {
                const selected = selectedIds.includes(row.id);
                const selectionLockedToOtherDeveloper =
                  selectedDeveloperId != null &&
                  row.assigned_developer_id !== selectedDeveloperId &&
                  !selected;
                return (
                  <TableRow
                    key={row.id}
                    data-state={selected ? 'selected' : undefined}
                    className={cn(selectionLockedToOtherDeveloper && 'opacity-60')}
                  >
                    <TableCell>
                      <Can permission={[P.inventory_issue_workflow, P.issue_inventory]}>
                        <Checkbox
                          checked={selected}
                          disabled={selectionLockedToOtherDeveloper}
                          onCheckedChange={(checked) =>
                            toggleRowSelected(row, checked === true)
                          }
                          aria-label={`Select ${row.inventory_name || `request #${row.id}`}`}
                        />
                      </Can>
                    </TableCell>
                    {isVisible('inventory_name') && (
                      <TableCell>
                        <div className="font-medium">{row.inventory_name || '—'}</div>
                        <div className="text-xs text-muted-foreground">
                          {row.part_number || '—'}
                        </div>
                      </TableCell>
                    )}
                    {isVisible('project_name') && (
                      <TableCell>{row.project_name || (row.project_id ? `Project #${row.project_id}` : '—')}</TableCell>
                    )}
                    {isVisible('serial_number') && <TableCell>{row.serial_number || '—'}</TableCell>}
                    {isVisible('target_entity_name') && (
                      <TableCell>
                        <div>{row.target_entity_name || `${row.target_entity_type} #${row.target_entity_id}`}</div>
                        <div className="text-xs text-muted-foreground">
                          {row.flight_code || row.flight_name || '—'} / {row.sdls_code || row.sdls_name || '—'}
                        </div>
                      </TableCell>
                    )}
                    {isVisible('assigned_developer_name') && (
                      <TableCell>{row.assigned_developer_name || `User #${row.assigned_developer_id}`}</TableCell>
                    )}
                    {isVisible('requested_at') && <TableCell>{formatWhen(row.requested_at)}</TableCell>}
                    <TableCell className="text-right">
                      <Can permission={[P.inventory_issue_workflow, P.issue_inventory]}>
                        <div className="flex flex-wrap justify-end gap-1">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openMarkBackDialog([row])}
                          >
                            Mark back
                          </Button>
                          <Button size="sm" onClick={() => openIssueDialog([row])}>
                            Issue
                          </Button>
                        </div>
                      </Can>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </ListContentSuspense>

      <Dialog
        open={issueRows.length > 0}
        onOpenChange={(open) => {
          if (!open && !submitting) {
            setIssueRows([]);
            signature.reset();
          }
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {issueRows.length > 1
                ? `Issue ${issueRows.length} items with signature`
                : 'Issue with signature'}
            </DialogTitle>
            <DialogDescription>
              {issueRows.length > 1
                ? 'One digital signature covers every selected item. For hard copy, download the issuance form PDF, collect the developer signature, then upload the scanned sheet.'
                : 'Provide a digital signature, or confirm a signed hard-copy sheet and upload the scanned attachment.'}
            </DialogDescription>
          </DialogHeader>
          {issueRows.length > 0 ? (
            <div className="space-y-4">
              <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm">
                <div className="font-medium">{issueDeveloperName}</div>
                {issueRows.length === 1 ? (
                  <div className="text-muted-foreground">
                    {issueRows[0].inventory_name} ·{' '}
                    {issueRows[0].serial_number || issueRows[0].part_number || '—'}
                  </div>
                ) : (
                  <div className="mt-2 max-h-40 space-y-1 overflow-y-auto text-muted-foreground">
                    {issueRows.map((row) => (
                      <div key={row.id} className="text-xs">
                        <span className="font-medium text-foreground">
                          {row.inventory_name || 'Item'}
                        </span>
                        {' · '}
                        {row.part_number || '—'}
                        {' · '}
                        {row.serial_number || '—'}
                      </div>
                    ))}
                  </div>
                )}
                <Badge variant="secondary" className="mt-2">
                  {issueRows.length > 1 ? `${issueRows.length} reserved` : 'Reserved'}
                </Badge>
              </div>
              <IssueSignatureFields
                signatureType={signature.signatureType}
                onSignatureTypeChange={signature.setSignatureType}
                digitalPayload={signature.digitalPayload}
                onDigitalPayloadChange={signature.setDigitalPayload}
                hardCopyAck={signature.hardCopyAck}
                onHardCopyAckChange={signature.setHardCopyAck}
                proformaFile={signature.proformaFile}
                onProformaFileChange={signature.setProformaFile}
                disabled={submitting}
                hardCopyActions={
                  <div className="space-y-2 rounded-md border border-dashed px-3 py-2">
                    <p className="text-xs text-muted-foreground">
                      Download a PDF listing{' '}
                      {issueRows.length === 1 ? 'this item' : 'all selected items'} with a
                      blank developer signature box, then attach the signed scan below.
                    </p>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={handleDownloadIssuanceForm}
                      disabled={submitting}
                    >
                      <Download className="mr-1.5 h-4 w-4" />
                      Download issuance form PDF
                    </Button>
                  </div>
                }
              />
            </div>
          ) : null}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIssueRows([]);
                signature.reset();
              }}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              onClick={() => void handleIssue()}
              disabled={submitting || issueRows.length === 0}
            >
              {submitting
                ? 'Issuing…'
                : issueRows.length > 1
                  ? `Issue ${issueRows.length} items`
                  : 'Issue'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <IssuanceRemarksDialog
        open={markBackRows.length > 0}
        onOpenChange={(open) => {
          if (!open && !markingBack) setMarkBackRows([]);
        }}
        action={markBackRows.length > 0 ? 'mark_back' : null}
        itemLabel={
          markBackRows.length === 0
            ? undefined
            : markBackRows.length === 1
              ? `${markBackRows[0].inventory_name || 'Item'} · ${
                  markBackRows[0].assigned_developer_name ||
                  `User #${markBackRows[0].assigned_developer_id}`
                }`
              : `${markBackRows.length} requests · ${
                  markBackRows[0].assigned_developer_name ||
                  `User #${markBackRows[0].assigned_developer_id}`
                }`
        }
        busy={markingBack}
        onConfirm={handleMarkBack}
      />
    </>
  );
}

'use client';

import { WORKFLOW_POLL_MS } from '@/lib/data-loading';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Search, X } from 'lucide-react';
import { toast } from 'sonner';
import * as api from '@/lib/api';
import type { ItemIssueRequest } from '@/lib/models';
import { ENTITY_TYPE_DB_LABELS } from '@/lib/entity-resolver';
import { cn } from '@/lib/utils';
import { parseApiDate } from '@/lib/parse-api-date';
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
import { uploadIssuanceProformaIfNeeded } from '@/lib/issuance-signature';

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

export function IssueQueuePanel() {
  const [rows, setRows] = useState<ItemIssueRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [projectFilter, setProjectFilter] = useState<string | undefined>();
  const [entityTypeFilter, setEntityTypeFilter] = useState(FILTER_ALL);
  const [developerFilter, setDeveloperFilter] = useState<string | undefined>();
  const [sdlsFilter, setSdlsFilter] = useState<string | undefined>();
  const [flightFilter, setFlightFilter] = useState<string | undefined>();
  const [statusFilter, setStatusFilter] = useState<IssueQueueStatusFilter>(FILTER_ALL);
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

  async function handleIssue() {
    if (!selected) return;
    const signed = signature.payload();
    if (!signed) {
      toast.error('Signature is required to issue');
      return;
    }
    setSubmitting(true);
    try {
      const res = await api.inventory.issueItemRequest(selected.id, signed);
      const issuanceId = res.data?.issued_issuance_id;
      await uploadIssuanceProformaIfNeeded(
        issuanceId,
        signature.signatureType,
        signature.proformaFile
      );
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
          <p className="text-xs text-muted-foreground">
            Showing {filteredRows.length} of {rows.length} pending request
            {rows.length === 1 ? '' : 's'}
            {statusFilter !== FILTER_ALL
              ? ` · ${STATUS_FILTER_DEFS.find((d) => d.key === statusFilter)?.label ?? statusFilter}`
              : ''}
          </p>
        ) : null}
      </div>
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
                <TableHead>Item</TableHead>
                <TableHead>Project</TableHead>
                <TableHead>Serial</TableHead>
                <TableHead>Hierarchy</TableHead>
                <TableHead>Developer</TableHead>
                <TableHead>Requested</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>
                    <div className="font-medium">{row.inventory_name || '—'}</div>
                    <div className="text-xs text-muted-foreground">
                      {row.part_number || '—'}
                    </div>
                  </TableCell>
                  <TableCell>{row.project_name || (row.project_id ? `Project #${row.project_id}` : '—')}</TableCell>
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
                proformaFile={signature.proformaFile}
                onProformaFileChange={signature.setProformaFile}
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

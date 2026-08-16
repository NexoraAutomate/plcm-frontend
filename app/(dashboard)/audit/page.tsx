'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Download, History, Search } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { EntityListPagination } from '@/components/entity-list-pagination';
import { ListContentSuspense } from '@/components/list-content-suspense';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { useSyncedPage } from '@/hooks/use-synced-page';
import * as api from '@/lib/api';
import {
  WORKFLOW_AUDIT_ACTION_LABELS,
  WORKFLOW_AUDIT_ENTITY_TYPES,
  WORKFLOW_AUDIT_ROLE_LABELS,
  WorkflowAuditAction,
  type User,
  type WorkflowAuditEvent,
  type WorkflowAuditListParams,
} from '@/lib/models';
import { Can } from '@/components/auth';
import { P } from '@/lib/permission-codes';

const PAGE_SIZE = 20;
const ALL = 'all';
const ACTION_OPTIONS = Object.values(WorkflowAuditAction);
const ROLE_OPTIONS = ['ADMIN', 'PD', 'HM', 'IM', 'DEV', 'SYSTEM'];

function formatDateTime(value?: string | null) {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

function formatJson(value?: Record<string, unknown> | null) {
  if (!value || Object.keys(value).length === 0) return '—';
  return Object.entries(value)
    .map(([key, val]) => `${key}: ${typeof val === 'object' ? JSON.stringify(val) : String(val)}`)
    .join(', ');
}

function actionLabel(code: string, fallback?: string | null) {
  return fallback || WORKFLOW_AUDIT_ACTION_LABELS[code] || code;
}

function roleLabel(code: string) {
  return WORKFLOW_AUDIT_ROLE_LABELS[code] || code;
}

export default function AuditTrailPage() {
  const [rows, setRows] = useState<WorkflowAuditEvent[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search);
  const [action, setAction] = useState(ALL);
  const [role, setRole] = useState(ALL);
  const [actorUserId, setActorUserId] = useState(ALL);
  const [entityType, setEntityType] = useState(ALL);
  const [entityId, setEntityId] = useState('');
  const [projectId, setProjectId] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [actors, setActors] = useState<User[]>([]);
  const { page, setPage } = useSyncedPage(
    `${debouncedSearch}|${action}|${role}|${actorUserId}|${entityType}|${entityId}|${projectId}|${dateFrom}|${dateTo}`
  );

  useEffect(() => {
    void api.users
      .list(0, 200)
      .then((res) => setActors(res.data ?? []))
      .catch(() => setActors([]));
  }, []);

  const filters: WorkflowAuditListParams = useMemo(
    () => ({
      search: debouncedSearch.trim() || undefined,
      action: action === ALL ? undefined : action,
      actor_role: role === ALL ? undefined : role,
      actor_user_id: actorUserId === ALL ? undefined : Number(actorUserId),
      entity_type: entityType === ALL ? undefined : entityType,
      entity_id: entityId.trim() || undefined,
      project_id: projectId.trim() ? Number(projectId) : undefined,
      date_from: dateFrom ? new Date(dateFrom).toISOString() : undefined,
      date_to: dateTo ? new Date(`${dateTo}T23:59:59`).toISOString() : undefined,
    }),
    [
      debouncedSearch,
      action,
      role,
      actorUserId,
      entityType,
      entityId,
      projectId,
      dateFrom,
      dateTo,
    ]
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.auditTrail.list(page * PAGE_SIZE, PAGE_SIZE, filters);
      setRows(res.data ?? []);
      const headerTotal = Number(res.headers?.['x-total-count'] ?? res.data?.length ?? 0);
      setTotal(Number.isFinite(headerTotal) ? headerTotal : res.data?.length ?? 0);
    } catch {
      toast.error('Failed to load audit trail');
      setRows([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [page, filters]);

  useEffect(() => {
    void load();
  }, [load]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const rangeStart = total === 0 ? 0 : page * PAGE_SIZE + 1;
  const rangeEnd = Math.min(total, (page + 1) * PAGE_SIZE);

  async function handleExport() {
    try {
      const res = await api.auditTrail.exportCsv(filters);
      const blob = new Blob([res.data], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = 'audit-trail.csv';
      anchor.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('Failed to export audit trail');
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Audit trail</h1>
          <p className="text-sm text-muted-foreground">
            Immutable who / role / when / old→new history for hierarchy and inventory actions.
          </p>
        </div>
        <Can permission={P.audit_read}>
          <Button variant="outline" onClick={() => void handleExport()}>
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
        </Can>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <History className="h-4 w-4" />
            Events
          </CardTitle>
          <CardDescription>
            Filter by actor, entity, action, role, project, or date. Rows cannot be edited or deleted.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div className="xl:col-span-2">
              <Label htmlFor="audit-search">Search</Label>
              <div className="relative mt-1">
                <Search className="pointer-events-none absolute top-2.5 left-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  id="audit-search"
                  className="pl-8"
                  placeholder="Actor, action, entity, remarks"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>
            <div>
              <Label>Actor</Label>
              {actors.length > 0 ? (
                <Select value={actorUserId} onValueChange={setActorUserId}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="All actors" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL}>All actors</SelectItem>
                    {actors.map((user) => (
                      <SelectItem key={user.id} value={String(user.id)}>
                        {user.full_name || user.username}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  className="mt-1"
                  inputMode="numeric"
                  placeholder="User ID"
                  value={actorUserId === ALL ? '' : actorUserId}
                  onChange={(e) => {
                    const next = e.target.value.replace(/[^\d]/g, '');
                    setActorUserId(next || ALL);
                  }}
                />
              )}
            </div>
            <div>
              <Label>Role</Label>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="All roles" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>All roles</SelectItem>
                  {ROLE_OPTIONS.map((code) => (
                    <SelectItem key={code} value={code}>
                      {roleLabel(code)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Action</Label>
              <Select value={action} onValueChange={setAction}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="All actions" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>All actions</SelectItem>
                  {ACTION_OPTIONS.map((code) => (
                    <SelectItem key={code} value={code}>
                      {actionLabel(code)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Entity type</Label>
              <Select value={entityType} onValueChange={setEntityType}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="All entities" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>All entities</SelectItem>
                  {WORKFLOW_AUDIT_ENTITY_TYPES.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="audit-entity-id">Entity ID</Label>
              <Input
                id="audit-entity-id"
                className="mt-1"
                placeholder="Any"
                value={entityId}
                onChange={(e) => setEntityId(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="audit-project">Project ID</Label>
              <Input
                id="audit-project"
                className="mt-1"
                inputMode="numeric"
                placeholder="Any"
                value={projectId}
                onChange={(e) => setProjectId(e.target.value.replace(/[^\d]/g, ''))}
              />
            </div>
            <div>
              <Label htmlFor="audit-from">From</Label>
              <Input
                id="audit-from"
                className="mt-1"
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="audit-to">To</Label>
              <Input
                id="audit-to"
                className="mt-1"
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>
          </div>

          <ListContentSuspense loading={loading}>
            {rows.length === 0 ? (
              <p className="text-sm text-muted-foreground">No audit events match these filters.</p>
            ) : (
              <div className="overflow-x-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>When</TableHead>
                      <TableHead>Actor</TableHead>
                      <TableHead>Action</TableHead>
                      <TableHead>Entity</TableHead>
                      <TableHead>Old → New</TableHead>
                      <TableHead>Remarks</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell className="whitespace-nowrap text-xs">
                          {formatDateTime(row.occurred_at)}
                          {row.ip_address ? (
                            <div className="text-muted-foreground">{row.ip_address}</div>
                          ) : null}
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">{row.actor_username || row.actor_user_id}</div>
                          <Badge variant="outline" className="mt-1 text-[10px]">
                            {roleLabel(row.actor_role)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">
                          {actionLabel(row.action, row.action_label)}
                        </TableCell>
                        <TableCell className="text-xs">
                          <div>
                            {row.entity_type} #{row.entity_id}
                          </div>
                          {row.project_id ? (
                            <div className="text-muted-foreground">Project {row.project_id}</div>
                          ) : null}
                        </TableCell>
                        <TableCell className="max-w-70 wrap-break-word text-xs">
                          {formatJson(row.old_value)} → {formatJson(row.new_value)}
                        </TableCell>
                        <TableCell className="max-w-45 wrap-break-word text-xs">
                          {row.remarks || '—'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </ListContentSuspense>
          <EntityListPagination
            page={page}
            totalPages={totalPages}
            total={total}
            rangeLabel={`${rangeStart}–${rangeEnd}`}
            hasPrev={page > 0}
            hasNext={page < totalPages - 1}
            onPrev={() => setPage(Math.max(0, page - 1))}
            onNext={() => setPage(Math.min(totalPages - 1, page + 1))}
            loading={loading}
          />
        </CardContent>
      </Card>
    </div>
  );
}

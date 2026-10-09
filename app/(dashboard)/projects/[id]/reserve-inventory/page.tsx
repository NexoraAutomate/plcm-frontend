'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  FoldVertical,
  Info,
  Lock,
  Package,
  RefreshCw,
  UnfoldVertical,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Can } from '@/components/auth';
import { PageLoader } from '@/components/page-loader';
import { StatusBadge } from '@/components/status-badge';
import { P } from '@/lib/permission-codes';
import * as api from '@/lib/api';
import type {
  Project,
  ProjectProgress,
  ProjectProgressSystemNode,
  ReservationPlan,
  ReservationPlanItem,
  User,
} from '@/lib/models';
import { ITEM_STATUS_LABELS, ProjectWorkflowStatus, workflowStatusLabel } from '@/lib/workflow-status';
import { cn } from '@/lib/utils';
import { useDataStore } from '@/lib/data-store';
import { formatUserRef } from '@/lib/user-display';
import { hasWorkflowRole } from '@/lib/workflow-roles';

const NONE_DEVELOPER = '__none__';

function rowKey(row: Pick<ReservationPlanItem, 'target_entity_type' | 'target_entity_id'>) {
  return `${row.target_entity_type}:${row.target_entity_id}`;
}

/** True when the next flat-list item is a direct/deeper child (depth-ordered plan). */
function hasChildRows(items: ReservationPlanItem[], index: number): boolean {
  const depth = items[index]?.depth ?? 0;
  return index + 1 < items.length && items[index + 1].depth > depth;
}

/** Ancestor keys for a depth-ordered item (nearest parent first). */
function ancestorKeys(items: ReservationPlanItem[], index: number): string[] {
  const keys: string[] = [];
  let depth = items[index]?.depth ?? 0;
  for (let i = index - 1; i >= 0 && depth > 0; i -= 1) {
    if (items[i].depth < depth) {
      keys.push(rowKey(items[i]));
      depth = items[i].depth;
    }
  }
  return keys;
}

function isRowVisible(
  items: ReservationPlanItem[],
  index: number,
  collapsedKeys: ReadonlySet<string>
): boolean {
  if (collapsedKeys.size === 0) return true;
  return !ancestorKeys(items, index).some((key) => collapsedKeys.has(key));
}

/** System id owning a depth-ordered plan row (self, payload, or nearest ancestor). */
function resolveSystemId(
  items: ReservationPlanItem[],
  index: number
): number | null {
  const row = items[index];
  if (row.target_entity_type === 'system') return row.target_entity_id;
  if (row.system_id != null) return row.system_id;
  for (const key of ancestorKeys(items, index)) {
    const colon = key.indexOf(':');
    if (colon < 0) continue;
    if (key.slice(0, colon) === 'system') {
      const id = Number(key.slice(colon + 1));
      return Number.isFinite(id) ? id : null;
    }
  }
  return null;
}

function flattenProgressSystems(
  progress: ProjectProgress | null
): Map<number, ProjectProgressSystemNode> {
  const map = new Map<number, ProjectProgressSystemNode>();
  if (!progress) return map;
  for (const flight of progress.flights) {
    for (const sdls of flight.sdls) {
      for (const system of sdls.systems) {
        map.set(system.entity_id, system);
      }
    }
  }
  return map;
}

function planFallbackProgress(
  items: ReservationPlanItem[],
  systemId: number
): { progress_pct: number; verified: number; weight: number } {
  let weight = 0;
  let verified = 0;
  for (let i = 0; i < items.length; i += 1) {
    if (resolveSystemId(items, i) !== systemId) continue;
    weight += 1;
    const row = items[i];
    if (row.status === 'verified' || row.item_status === 'VERIFIED') {
      verified += 1;
    }
  }
  return {
    weight,
    verified,
    progress_pct: weight > 0 ? Math.round((verified / weight) * 100) : 0,
  };
}

type SystemFilterOption = {
  id: number;
  name: string;
  /** Display label — prefers shell serial (SDLS-1) over template name. */
  label: string;
  status?: string | null;
  progress_pct: number;
  verified_leaves: number;
  weight: number;
};

function systemFilterLabel(row: ReservationPlanItem): string {
  const serial = row.entity_serial_number?.trim();
  if (serial) return serial;
  const parts = row.path.split(' / ').map((p) => p.trim()).filter(Boolean);
  // path: Flight / SDLS / System — use SDLS segment when present
  if (parts.length >= 2 && /^SDLS-/i.test(parts[1])) return parts[1];
  return row.entity_name;
}

function apiError(error: unknown, fallback: string): string {
  const detail = (error as { response?: { data?: { detail?: string } } })?.response
    ?.data?.detail;
  return typeof detail === 'string' ? detail : fallback;
}

const COMMITTED_PLAN_STATUSES = new Set([
  'reserved',
  'issued',
  'installing',
  'testing',
  'verified',
  'in_progress',
  'returned',
  'inspection',
  'reusable',
  'repairable',
  'scrapped',
]);

function isCommittedRow(row: ReservationPlanItem): boolean {
  return COMMITTED_PLAN_STATUSES.has(row.status);
}

function lifecycleLabel(row: ReservationPlanItem): string {
  if (row.item_status && row.item_status in ITEM_STATUS_LABELS) {
    return ITEM_STATUS_LABELS[row.item_status as keyof typeof ITEM_STATUS_LABELS];
  }
  return workflowStatusLabel(row.status);
}

function statusBadge(row: ReservationPlanItem) {
  const { status } = row;
  if (status === 'available') {
    return (
      <Badge className="bg-emerald-600/15 text-emerald-800 border-emerald-600/30 hover:bg-emerald-600/15">
        Available
      </Badge>
    );
  }
  if (isCommittedRow(row)) {
    return (
      <Badge variant="secondary" className="gap-1">
        <Lock className="h-3 w-3" />
        {lifecycleLabel(row)}
      </Badge>
    );
  }
  if (status === 'assemble') {
    return (
      <Badge variant="outline" className="gap-1">
        Waiting for children
      </Badge>
    );
  }
  return (
    <Badge variant="destructive" className="gap-1">
      <AlertTriangle className="h-3 w-3" />
      Short
    </Badge>
  );
}

function committedActionLabel(row: ReservationPlanItem): string {
  if (row.status === 'verified') return 'Verified';
  if (row.status === 'testing') return 'Awaiting verification';
  if (row.status === 'installing') return 'Installing';
  if (row.status === 'issued') return 'Issued';
  if (row.status === 'reserved') return 'Reserved';
  return lifecycleLabel(row);
}

function defaultSerial(row: ReservationPlanItem): string {
  const serials = row.serial_numbers?.filter(Boolean) ?? [];
  if (row.suggested_serial && serials.includes(row.suggested_serial)) {
    return row.suggested_serial;
  }
  return serials[0] ?? '';
}

/** Assign unique default serials across available rows that share the same stock. */
function assignDistinctDefaultSerials(
  items: ReservationPlanItem[]
): Record<string, string> {
  const next: Record<string, string> = {};
  const usedByPool = new Map<string, Set<string>>();

  for (const row of items) {
    if (row.status !== 'available') continue;
    const key = rowKey(row);
    const serials = row.serial_numbers?.filter(Boolean) ?? [];
    const poolKey =
      row.inventory_id != null
        ? `id:${row.inventory_id}`
        : `name:${row.inventory_name ?? ''}:${row.part_number ?? ''}`;
    let used = usedByPool.get(poolKey);
    if (!used) {
      used = new Set();
      usedByPool.set(poolKey, used);
    }
    let pick = '';
    if (
      row.suggested_serial &&
      serials.includes(row.suggested_serial) &&
      !used.has(row.suggested_serial)
    ) {
      pick = row.suggested_serial;
    } else {
      pick = serials.find((sn) => !used.has(sn)) ?? '';
    }
    if (pick) used.add(pick);
    next[key] = pick;
  }
  return next;
}

export default function ReserveInventoryPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = Number(params.id);
  const { users: storeUsers } = useDataStore();
  const [project, setProject] = useState<Project | null>(null);
  const [plan, setPlan] = useState<ReservationPlan | null>(null);
  const [progress, setProgress] = useState<ProjectProgress | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [reservingAll, setReservingAll] = useState(false);
  const [extraUsers, setExtraUsers] = useState<User[]>([]);
  const [serialByKey, setSerialByKey] = useState<Record<string, string>>({});
  const [developerByKey, setDeveloperByKey] = useState<Record<string, string>>({});
  const [collapsedKeys, setCollapsedKeys] = useState<Set<string>>(() => new Set());
  const [selectedSystemId, setSelectedSystemId] = useState<number | null>(null);
  const [expandedDetailKeys, setExpandedDetailKeys] = useState<Set<string>>(
    () => new Set()
  );

  const developers = useMemo(() => {
    const merged = new Map<number, User>();
    for (const user of [...storeUsers, ...extraUsers]) {
      if (user?.id != null) merged.set(user.id, user);
    }
    return [...merged.values()]
      .filter((user) => hasWorkflowRole(user.roles ?? [], ['DEV', 'ADMIN']))
      .sort((a, b) => formatUserRef(a).localeCompare(formatUserRef(b)));
  }, [storeUsers, extraUsers]);

  const load = useCallback(async () => {
    if (!Number.isFinite(projectId)) return;
    setLoading(true);
    try {
      const [projectRes, planRes, usersRes, progressRes] = await Promise.all([
        api.projects.get(projectId),
        api.projects.reservationPlan(projectId),
        api.users.list(0, 500).catch(() => ({ data: [] as User[] })),
        api.projects.progress(projectId).catch(() => ({ data: null })),
      ]);
      setProject(projectRes.data);
      setPlan(planRes.data);
      setProgress(progressRes.data);
      setExtraUsers(usersRes.data ?? []);

      const nextSerials = assignDistinctDefaultSerials(planRes.data.items ?? []);
      const nextDevelopers: Record<string, string> = {};
      for (const row of planRes.data.items ?? []) {
        if (row.can_assign_developer && row.assigned_developer_id) {
          nextDevelopers[rowKey(row)] = String(row.assigned_developer_id);
        }
      }
      setSerialByKey(nextSerials);
      setDeveloperByKey(nextDevelopers);
    } catch (error: unknown) {
      toast.error(apiError(error, 'Failed to load reservation plan'));
      setPlan(null);
      setProgress(null);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  const availableItems = useMemo(
    () => (plan?.items ?? []).filter((row) => row.status === 'available'),
    [plan]
  );

  const planItems = plan?.items;

  const systemFilters = useMemo((): SystemFilterOption[] => {
    if (!planItems?.length) return [];
    const progressById = flattenProgressSystems(progress);
    const options: SystemFilterOption[] = [];
    for (const row of planItems) {
      if (row.target_entity_type !== 'system') continue;
      const prog = progressById.get(row.target_entity_id);
      const fallback = prog
        ? null
        : planFallbackProgress(planItems, row.target_entity_id);
      options.push({
        id: row.target_entity_id,
        name: row.entity_name,
        label: systemFilterLabel(row),
        status: prog?.status ?? row.status,
        progress_pct: prog?.progress_pct ?? fallback?.progress_pct ?? 0,
        verified_leaves: prog?.verified_leaves ?? fallback?.verified ?? 0,
        weight: prog?.weight ?? fallback?.weight ?? 0,
      });
    }
    return options;
  }, [planItems, progress]);

  useEffect(() => {
    if (
      selectedSystemId != null &&
      !systemFilters.some((s) => s.id === selectedSystemId)
    ) {
      setSelectedSystemId(null);
    }
  }, [selectedSystemId, systemFilters]);

  /** Parent rows in the current filter scope (selected system, or all). */
  const scopedParentKeys = useMemo(() => {
    if (!planItems?.length) return [] as string[];
    const keys: string[] = [];
    for (let i = 0; i < planItems.length; i += 1) {
      if (
        selectedSystemId != null &&
        resolveSystemId(planItems, i) !== selectedSystemId
      ) {
        continue;
      }
      if (hasChildRows(planItems, i)) keys.push(rowKey(planItems[i]));
    }
    return keys;
  }, [planItems, selectedSystemId]);

  const scopedAllCollapsed =
    scopedParentKeys.length > 0 &&
    scopedParentKeys.every((key) => collapsedKeys.has(key));

  const visibleItemIndexes = useMemo(() => {
    if (!planItems?.length) return [] as number[];
    const indexes: number[] = [];
    for (let i = 0; i < planItems.length; i += 1) {
      if (
        selectedSystemId != null &&
        resolveSystemId(planItems, i) !== selectedSystemId
      ) {
        continue;
      }
      if (isRowVisible(planItems, i, collapsedKeys)) indexes.push(i);
    }
    return indexes;
  }, [planItems, collapsedKeys, selectedSystemId]);

  function toggleCollapsed(key: string) {
    setCollapsedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function toggleExpandCollapseAll() {
    setCollapsedKeys((prev) => {
      const next = new Set(prev);
      if (scopedAllCollapsed) {
        for (const key of scopedParentKeys) next.delete(key);
      } else {
        for (const key of scopedParentKeys) next.add(key);
      }
      return next;
    });
  }

  function toggleDetailExpanded(key: string) {
    setExpandedDetailKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function selectedSerial(row: ReservationPlanItem): string | undefined {
    const key = rowKey(row);
    if (Object.prototype.hasOwnProperty.call(serialByKey, key)) {
      return serialByKey[key] || undefined;
    }
    return defaultSerial(row) || undefined;
  }

  function selectedDeveloperId(row: ReservationPlanItem): number | null {
    const raw = developerByKey[rowKey(row)];
    if (!raw || raw === NONE_DEVELOPER) return null;
    const id = Number(raw);
    return Number.isFinite(id) && id > 0 ? id : null;
  }

  async function assignDeveloperForRow(row: ReservationPlanItem) {
    const key = rowKey(row);
    const developerId = selectedDeveloperId(row);
    if (developerId == null) {
      toast.message('Select a developer to assign');
      return;
    }
    setBusyKey(key);
    try {
      await api.hierarchyWorkflow.assignDeveloper(
        row.target_entity_type,
        row.target_entity_id,
        developerId
      );
      toast.success(`Developer assigned to ${row.entity_name}`);
      await load();
    } catch (error: unknown) {
      toast.error(apiError(error, `Assign developer failed for ${row.entity_name}`));
    } finally {
      setBusyKey(null);
    }
  }

  async function maybeAssignDeveloper(row: ReservationPlanItem) {
    const developerId = selectedDeveloperId(row);
    if (developerId == null) return;
    try {
      await api.hierarchyWorkflow.assignDeveloper(
        row.target_entity_type,
        row.target_entity_id,
        developerId
      );
    } catch (error: unknown) {
      toast.error(
        apiError(
          error,
          `Reserved, but assign developer failed for ${row.entity_name}`
        )
      );
    }
  }

  async function reserveOne(row: ReservationPlanItem) {
    if (row.status !== 'available') return;
    const key = rowKey(row);
    setBusyKey(key);
    try {
      const serial = selectedSerial(row);
      const res = await api.projects.createReservation(projectId, {
        target_entity_type: row.target_entity_type,
        target_entity_id: row.target_entity_id,
        inventory_id: row.inventory_id ?? undefined,
        serial_number: serial,
        flight_id: row.flight_id ?? undefined,
        sdls_id: row.sdls_id ?? undefined,
      });
      if (res.data.outcome === 'shortage') {
        toast.message('Shortage recorded — no free stock at reserve time');
      } else {
        await maybeAssignDeveloper(row);
        const sn = res.data.reservation?.serial_number || serial || row.suggested_serial;
        toast.success(
          `Reserved ${sn || row.inventory_name || row.entity_name}${
            selectedDeveloperId(row) != null ? ' · developer assigned' : ''
          }`
        );
      }
      await load();
    } catch (error: unknown) {
      toast.error(apiError(error, 'Reserve failed'));
    } finally {
      setBusyKey(null);
    }
  }

  async function reserveAllAvailable() {
    if (availableItems.length === 0) {
      toast.message('No available inventory to reserve');
      return;
    }
    setReservingAll(true);
    let ok = 0;
    let failed = 0;
    let assigned = 0;
    try {
      for (const row of availableItems) {
        try {
          const serial = selectedSerial(row);
          const res = await api.projects.createReservation(projectId, {
            target_entity_type: row.target_entity_type,
            target_entity_id: row.target_entity_id,
            inventory_id: row.inventory_id ?? undefined,
            serial_number: serial,
            flight_id: row.flight_id ?? undefined,
            sdls_id: row.sdls_id ?? undefined,
          });
          if (res.data.outcome === 'reserved') {
            ok += 1;
            const beforeAssign = selectedDeveloperId(row);
            if (beforeAssign != null) {
              try {
                await api.hierarchyWorkflow.assignDeveloper(
                  row.target_entity_type,
                  row.target_entity_id,
                  beforeAssign
                );
                assigned += 1;
              } catch {
                /* assignment failure does not undo reserve */
              }
            }
          } else {
            failed += 1;
          }
        } catch {
          failed += 1;
        }
      }
      if (ok > 0) {
        toast.success(
          `Reserved ${ok} item${ok === 1 ? '' : 's'}${
            assigned ? ` · ${assigned} developer${assigned === 1 ? '' : 's'} assigned` : ''
          }${failed ? ` · ${failed} skipped` : ''}`
        );
      } else {
        toast.error('Could not reserve available items');
      }
      await load();
    } finally {
      setReservingAll(false);
    }
  }

  if (!Number.isFinite(projectId)) {
    return (
      <div className="py-20 text-center">
        <h2 className="text-xl font-semibold">Invalid project</h2>
        <Link href="/projects" className="mt-2 text-sm text-primary underline">
          Back to Projects
        </Link>
      </div>
    );
  }

  if (loading && !plan) {
    return <PageLoader />;
  }

  const status = project?.status_name ?? plan?.project_status ?? '';
  const canReserve = status === ProjectWorkflowStatus.READY_FOR_INVENTORY;
  const isCompleted = status === ProjectWorkflowStatus.COMPLETED;
  const notReady = !canReserve;

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 pb-28">
      <div className="flex flex-wrap items-start gap-3">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0"
          onClick={() => router.push(`/projects/${projectId}`)}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            Reserve inventory
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {project?.name
              ? `${project.name} — reserve TURNKEY stock; BUILD nodes wait for installed and verified children`
              : 'Reserve TURNKEY stock; BUILD nodes wait for installed and verified children'}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          disabled={loading || reservingAll || busyKey != null}
          onClick={() => void load()}
        >
          <RefreshCw className={cn('mr-1.5 h-4 w-4', loading && 'animate-spin')} />
          Refresh
        </Button>
      </div>

      {notReady ? (
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm">
            {isCompleted ? (
              <>
                Project progress reached 100%. Assign developers to assembled parent
                items below; new stock reservations are disabled.
              </>
            ) : (
              <>
                Project must be <strong>Ready for Inventory</strong> before reserving.
                Generate hierarchy first if it is still Approved.
              </>
            )}
        </div>
      ) : null}

      {plan ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          <div className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground">Hierarchy items</p>
            <p className="text-lg font-semibold">{plan.total}</p>
          </div>
          <div className="rounded-lg border border-emerald-600/30 bg-emerald-600/5 p-3">
            <p className="text-xs text-muted-foreground">Available to reserve</p>
            <p className="text-lg font-semibold text-emerald-800">
              {plan.available_count}
            </p>
          </div>
          <div className="rounded-lg border border-amber-600/30 bg-amber-600/5 p-3">
            <p className="text-xs text-muted-foreground">Waiting for children</p>
            <p className="text-lg font-semibold text-amber-900">
              {plan.assemble_count ?? 0}
            </p>
          </div>
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
            <p className="text-xs text-muted-foreground">Short / no match</p>
            <p className="text-lg font-semibold text-destructive">{plan.short_count}</p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground">Already reserved</p>
            <p className="text-lg font-semibold">{plan.reserved_count}</p>
          </div>
        </div>
      ) : null}

      <div className="overflow-hidden rounded-lg border">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-muted/40 px-4 py-2">
          <span className="text-sm font-medium">Hierarchy → matched inventory</span>
          {scopedParentKeys.length > 0 ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 gap-1.5"
              onClick={toggleExpandCollapseAll}
            >
              {scopedAllCollapsed ? (
                <>
                  <UnfoldVertical className="h-3.5 w-3.5" />
                  Expand all
                </>
              ) : (
                <>
                  <FoldVertical className="h-3.5 w-3.5" />
                  Collapse all
                </>
              )}
            </Button>
          ) : null}
        </div>
        {systemFilters.length > 0 ? (
          <div className="flex flex-wrap gap-2 border-b px-4 py-3">
            {systemFilters.map((system) => {
              const selected = selectedSystemId === system.id;
              return (
                <button
                  key={system.id}
                  type="button"
                  onClick={() =>
                    setSelectedSystemId((prev) =>
                      prev === system.id ? null : system.id
                    )
                  }
                  className={cn(
                    'inline-flex min-w-[9.5rem] max-w-full flex-col gap-1.5 rounded-md border px-3 py-2 text-left transition-colors',
                    selected
                      ? 'border-primary bg-primary/10'
                      : 'hover:bg-muted'
                  )}
                  aria-pressed={selected}
                  title={
                    system.label !== system.name
                      ? `${system.label} · ${system.name}`
                      : system.name
                  }
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-medium">
                      {system.label}
                    </span>
                    <span className="shrink-0 tabular-nums text-xs text-muted-foreground">
                      {system.progress_pct}%
                    </span>
                  </span>
                  <Progress value={system.progress_pct} className="h-1.5" />
                  <span className="flex flex-wrap items-center gap-1.5">
                    {system.status ? (
                      <StatusBadge status={system.status} className="text-[10px]" />
                    ) : null}
                    {system.weight > 0 ? (
                      <span className="text-[10px] tabular-nums text-muted-foreground">
                        {system.verified_leaves}/{system.weight} verified
                      </span>
                    ) : null}
                  </span>
                </button>
              );
            })}
          </div>
        ) : null}
        {!plan || !planItems || planItems.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">
            No hierarchy shells found. Generate hierarchy on the project first.
          </p>
        ) : visibleItemIndexes.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">
            No hierarchy items for the selected system.
          </p>
        ) : (
          <ul className="divide-y">
            {visibleItemIndexes.map((index) => {
              const row = planItems[index];
              const key = rowKey(row);
              const isShort = row.status === 'short';
              const isBusy = busyKey === key || reservingAll;
              const serials = (row.serial_numbers ?? []).filter(Boolean);
              const showSerialSelect = row.status === 'available' && serials.length > 1;
              const currentSerial =
                serialByKey[key] !== undefined
                  ? serialByKey[key]
                  : defaultSerial(row);
              const currentDeveloper = developerByKey[key] || NONE_DEVELOPER;
              const isParent = hasChildRows(planItems, index);
              const isCollapsed = collapsedKeys.has(key);
              const detailsOpen = expandedDetailKeys.has(key);

              return (
                <li
                  key={key}
                  className={cn(
                    'flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between',
                    isShort && 'bg-destructive/5'
                  )}
                  style={{ paddingLeft: `${16 + Math.min(row.depth, 6) * 12}px` }}
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      {isParent ? (
                        <button
                          type="button"
                          className={cn(
                            'rounded px-0.5 text-left font-medium hover:underline',
                            isCollapsed && 'text-muted-foreground'
                          )}
                          onClick={() => toggleCollapsed(key)}
                          aria-expanded={!isCollapsed}
                          title={
                            isCollapsed
                              ? `Expand ${row.entity_name} children`
                              : `Collapse ${row.entity_name} children`
                          }
                        >
                          {row.entity_name}
                        </button>
                      ) : (
                        <span className="font-medium">{row.entity_name}</span>
                      )}
                      <span className="text-xs uppercase text-muted-foreground">
                        {row.target_entity_type}
                      </span>
                      {statusBadge(row)}
                      <button
                        type="button"
                        className={cn(
                          'rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground',
                          detailsOpen && 'text-primary'
                        )}
                        onClick={() => toggleDetailExpanded(key)}
                        aria-expanded={detailsOpen}
                        aria-label={
                          detailsOpen
                            ? `Hide details for ${row.entity_name}`
                            : `Show details for ${row.entity_name}`
                        }
                        title={detailsOpen ? 'Hide details' : 'Show details'}
                      >
                        <Info className="h-4 w-4 shrink-0" />
                      </button>
                    </div>
                    {detailsOpen ? (
                      <div className="space-y-1">
                        <p className="truncate text-xs text-muted-foreground">
                          {row.path}
                        </p>
                        {row.status === 'available' ? (
                          <p className="flex flex-wrap items-center gap-x-2 text-xs text-emerald-800">
                            <Package className="inline h-3.5 w-3.5" />
                            <span>
                              {row.inventory_name || 'Stock'}
                              {row.part_number ? ` · PN ${row.part_number}` : ''}
                              {!showSerialSelect && currentSerial
                                ? ` · SN ${currentSerial}`
                                : !showSerialSelect && row.free_quantity != null
                                  ? ` · qty ${row.free_quantity}`
                                  : showSerialSelect
                                    ? ` · ${serials.length} serials available`
                                    : ''}
                            </span>
                          </p>
                        ) : null}
                        {isShort ? (
                          <p className="text-xs text-destructive">
                            {row.reason ||
                              'No matching available inventory for this entity'}
                          </p>
                        ) : null}
                        {row.status === 'assemble' ? (
                          <p className="text-xs text-muted-foreground">
                            {typeof row.children_complete === 'number' &&
                            typeof row.children_total === 'number' &&
                            row.children_total > 0
                              ? `${row.children_complete}/${row.children_total} children installed and verified. `
                              : ''}
                            {row.reason ||
                              'Automatically created when required child items are installed and verified'}
                          </p>
                        ) : null}
                        {row.can_assign_developer ? (
                          <p className="text-xs text-muted-foreground">
                            {row.reason ||
                              (row.assembled
                                ? 'Automatically assembled from verified children'
                                : 'Reserved — assign a developer for IM to issue')}
                            {row.suggested_serial
                              ? ` · SN ${row.suggested_serial}`
                              : ''}
                            {row.part_number ? ` · PN ${row.part_number}` : ''}
                            {row.assigned_developer_name
                              ? ` · Developer: ${row.assigned_developer_name}`
                              : ''}
                          </p>
                        ) : null}
                        {isCommittedRow(row) && !row.can_assign_developer ? (
                          <p className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                            <CheckCircle2 className="inline h-3.5 w-3.5 shrink-0" />
                            <span>
                              {row.reason ||
                                `${lifecycleLabel(row)} for this hierarchy node`}
                              {row.suggested_serial
                                ? ` · SN ${row.suggested_serial}`
                                : ''}
                              {row.part_number ? ` · PN ${row.part_number}` : ''}
                            </span>
                          </p>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                    <Can permission={P.inventory_reserve}>
                      {row.status === 'available' ? (
                        <>
                          {showSerialSelect ? (
                            <Select
                              value={currentSerial || undefined}
                              onValueChange={(value) =>
                                setSerialByKey((prev) => ({ ...prev, [key]: value }))
                              }
                              disabled={isBusy || !canReserve}
                            >
                              <SelectTrigger size="sm" className="w-38" aria-label="Serial number">
                                <SelectValue placeholder="Serial #" />
                              </SelectTrigger>
                              <SelectContent>
                                {serials.map((sn) => (
                                  <SelectItem key={sn} value={sn}>
                                    SN {sn}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : null}
                          <Can permission={P.hierarchy_assign_developer}>
                            <Select
                              value={currentDeveloper}
                              onValueChange={(value) =>
                                setDeveloperByKey((prev) => ({ ...prev, [key]: value }))
                              }
                              disabled={isBusy || !canReserve}
                            >
                              <SelectTrigger
                                size="sm"
                                className="w-42"
                                aria-label="Assign developer (optional)"
                              >
                                <SelectValue placeholder="Developer (optional)" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value={NONE_DEVELOPER}>
                                  No developer
                                </SelectItem>
                                {developers.map((user) => (
                                  <SelectItem key={user.id} value={String(user.id)}>
                                    {formatUserRef(user)}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </Can>
                          <Button
                            size="sm"
                              disabled={isBusy || !canReserve}
                              onClick={() => void reserveOne(row)}
                          >
                            {busyKey === key ? 'Reserving…' : 'Reserve'}
                          </Button>
                        </>
                      ) : row.can_assign_developer ? (
                        <>
                          <Can permission={P.hierarchy_assign_developer}>
                            <Select
                              value={currentDeveloper}
                              onValueChange={(value) =>
                                setDeveloperByKey((prev) => ({ ...prev, [key]: value }))
                              }
                              disabled={isBusy}
                            >
                              <SelectTrigger
                                size="sm"
                                className="w-42"
                                aria-label="Assign developer"
                              >
                                <SelectValue placeholder="Select developer" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value={NONE_DEVELOPER}>
                                  No developer
                                </SelectItem>
                                {developers.map((user) => (
                                  <SelectItem key={user.id} value={String(user.id)}>
                                    {formatUserRef(user)}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </Can>
                          <Can permission={P.hierarchy_assign_developer}>
                            <Button
                              size="sm"
                              variant="secondary"
                              disabled={isBusy}
                              onClick={() => void assignDeveloperForRow(row)}
                            >
                              {busyKey === key
                                ? 'Assigning…'
                                : row.assigned_developer_id
                                  ? 'Update developer'
                                  : 'Assign developer'}
                            </Button>
                          </Can>
                        </>
                      ) : row.status === 'assemble' ? (
                        <Button size="sm" variant="outline" disabled>
                          Waiting for children
                        </Button>
                      ) : row.status === 'short' ? (
                        <Button size="sm" variant="outline" disabled>
                          No stock
                        </Button>
                      ) : isCommittedRow(row) ? (
                        <Button size="sm" variant="secondary" disabled>
                          {committedActionLabel(row)}
                        </Button>
                      ) : (
                        <Button size="sm" variant="secondary" disabled>
                          Unavailable
                        </Button>
                      )}
                    </Can>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/80">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <p className="text-sm text-muted-foreground">
            {availableItems.length > 0
              ? `${availableItems.length} available match${availableItems.length === 1 ? '' : 'es'} ready to lock`
              : 'No available matches left to reserve'}
            {plan && plan.short_count > 0
              ? ` · ${plan.short_count} short (highlighted)`
              : ''}
            {plan && (plan.assemble_count ?? 0) > 0
              ? ` · ${plan.assemble_count} waiting for children`
              : ''}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() => router.push(`/projects/${projectId}`)}
            >
              Back to project
            </Button>
            <Can permission={P.inventory_reserve}>
              <Button
                disabled={
                  !canReserve ||
                  reservingAll ||
                  busyKey != null ||
                  availableItems.length === 0
                }
                onClick={() => void reserveAllAvailable()}
              >
                {reservingAll
                  ? 'Reserving all…'
                  : `Reserve All Available (${availableItems.length})`}
              </Button>
            </Can>
          </div>
        </div>
      </div>
    </div>
  );
}

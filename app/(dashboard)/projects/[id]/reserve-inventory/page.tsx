'use client';

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
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

type PlanTreeNode = {
  index: number;
  row: ReservationPlanItem;
  children: PlanTreeNode[];
};

type FlightTreeGroup = {
  flightName: string;
  children: PlanTreeNode[];
};

function flightNameFromRow(row: ReservationPlanItem): string {
  return (
    row.path.split(' / ').map((p) => p.trim()).filter(Boolean)[0] || 'Flight'
  );
}

function flightCollapseKey(flightName: string): string {
  return `flight:${flightName}`;
}

/** Build a nested tree from the depth-ordered reservation plan. */
function buildPlanTree(items: ReservationPlanItem[]): PlanTreeNode[] {
  const roots: PlanTreeNode[] = [];
  const stack: PlanTreeNode[] = [];
  for (let i = 0; i < items.length; i += 1) {
    const row = items[i];
    const node: PlanTreeNode = { index: i, row, children: [] };
    while (stack.length > 0 && stack[stack.length - 1].row.depth >= row.depth) {
      stack.pop();
    }
    if (stack.length === 0) roots.push(node);
    else stack[stack.length - 1].children.push(node);
    stack.push(node);
  }
  return roots;
}

function filterPlanTreeRoots(
  roots: PlanTreeNode[],
  options: { flightName: string | null; systemId: number | null }
): PlanTreeNode[] {
  const { flightName, systemId } = options;
  return roots.filter((node) => {
    if (flightName != null && flightNameFromRow(node.row) !== flightName) {
      return false;
    }
    if (
      systemId != null &&
      !(
        node.row.target_entity_type === 'system' &&
        node.row.target_entity_id === systemId
      )
    ) {
      return false;
    }
    return true;
  });
}

/** Group system roots under Flight labels from each row path. */
function groupPlanTreeByFlight(roots: PlanTreeNode[]): FlightTreeGroup[] {
  const groups: FlightTreeGroup[] = [];
  const byName = new Map<string, FlightTreeGroup>();
  for (const node of roots) {
    const name = flightNameFromRow(node.row);
    let group = byName.get(name);
    if (!group) {
      group = { flightName: name, children: [] };
      byName.set(name, group);
      groups.push(group);
    }
    group.children.push(node);
  }
  return groups;
}

function rowInFilterScope(
  items: ReservationPlanItem[],
  index: number,
  flightName: string | null,
  systemId: number | null
): boolean {
  const row = items[index];
  if (flightName != null && flightNameFromRow(row) !== flightName) return false;
  if (systemId != null && resolveSystemId(items, index) !== systemId) return false;
  return true;
}

type FlightFilterOption = {
  name: string;
  progress_pct: number;
  verified_leaves: number;
  weight: number;
  system_count: number;
};

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
  flightName: string;
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

function countPlanStatuses(items: ReservationPlanItem[]) {
  let available = 0;
  let assemble = 0;
  let short = 0;
  let reserved = 0;
  for (const row of items) {
    if (row.status === 'available') available += 1;
    else if (row.status === 'assemble') assemble += 1;
    else if (row.status === 'short') short += 1;
    else if (row.status === 'reserved') reserved += 1;
  }
  return {
    total: items.length,
    available,
    assemble,
    short,
    reserved,
  };
}

type CardStatusFilter =
  | 'all'
  | 'available'
  | 'assemble'
  | 'short'
  | 'reserved';

function rowMatchesCardFilter(
  row: ReservationPlanItem,
  filter: CardStatusFilter
): boolean {
  if (filter === 'all') return true;
  return row.status === filter;
}

/** Keep matching nodes and ancestors so the tree path stays visible. */
function pruneTreeByCardFilter(
  nodes: PlanTreeNode[],
  filter: CardStatusFilter
): PlanTreeNode[] {
  if (filter === 'all') return nodes;
  const result: PlanTreeNode[] = [];
  for (const node of nodes) {
    const children = pruneTreeByCardFilter(node.children, filter);
    if (rowMatchesCardFilter(node.row, filter) || children.length > 0) {
      result.push({ ...node, children });
    }
  }
  return result;
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
  const [selectedFlightName, setSelectedFlightName] = useState<string | null>(null);
  const [selectedSystemId, setSelectedSystemId] = useState<number | null>(null);
  const [cardFilter, setCardFilter] = useState<CardStatusFilter>('all');
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

  const planItems = plan?.items;

  const allSystemFilters = useMemo((): SystemFilterOption[] => {
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
        flightName: flightNameFromRow(row),
        label: systemFilterLabel(row),
        status: prog?.status ?? row.status,
        progress_pct: prog?.progress_pct ?? fallback?.progress_pct ?? 0,
        verified_leaves: prog?.verified_leaves ?? fallback?.verified ?? 0,
        weight: prog?.weight ?? fallback?.weight ?? 0,
      });
    }
    return options;
  }, [planItems, progress]);

  const flightFilters = useMemo((): FlightFilterOption[] => {
    if (!allSystemFilters.length) return [];
    const progressByName = new Map(
      (progress?.flights ?? []).map((f) => [f.name, f] as const)
    );
    const systemsByFlight = new Map<string, SystemFilterOption[]>();
    for (const system of allSystemFilters) {
      const list = systemsByFlight.get(system.flightName) ?? [];
      list.push(system);
      systemsByFlight.set(system.flightName, list);
    }
    return [...systemsByFlight.entries()].map(([name, systems]) => {
      const prog = progressByName.get(name);
      if (prog) {
        return {
          name,
          progress_pct: prog.progress_pct,
          verified_leaves: prog.verified_leaves,
          weight: prog.weight,
          system_count: systems.length,
        };
      }
      const verified_leaves = systems.reduce(
        (sum, s) => sum + s.verified_leaves,
        0
      );
      const weight = systems.reduce((sum, s) => sum + s.weight, 0);
      return {
        name,
        verified_leaves,
        weight,
        progress_pct:
          weight > 0 ? Math.round((verified_leaves / weight) * 100) : 0,
        system_count: systems.length,
      };
    });
  }, [progress, allSystemFilters]);

  const systemFilters = useMemo(() => {
    if (selectedFlightName == null) return allSystemFilters;
    return allSystemFilters.filter((s) => s.flightName === selectedFlightName);
  }, [allSystemFilters, selectedFlightName]);

  useEffect(() => {
    if (
      selectedFlightName != null &&
      !flightFilters.some((f) => f.name === selectedFlightName)
    ) {
      setSelectedFlightName(null);
    }
  }, [selectedFlightName, flightFilters]);

  useEffect(() => {
    if (selectedSystemId == null) return;
    const selected = allSystemFilters.find((s) => s.id === selectedSystemId);
    if (!selected) {
      setSelectedSystemId(null);
      return;
    }
    if (
      selectedFlightName != null &&
      selected.flightName !== selectedFlightName
    ) {
      setSelectedSystemId(null);
    }
  }, [selectedSystemId, selectedFlightName, allSystemFilters]);

  const scopedItems = useMemo(() => {
    if (!planItems?.length) return [] as ReservationPlanItem[];
    return planItems.filter((_, index) =>
      rowInFilterScope(planItems, index, selectedFlightName, selectedSystemId)
    );
  }, [planItems, selectedFlightName, selectedSystemId]);

  const scopedStats = useMemo(
    () => countPlanStatuses(scopedItems),
    [scopedItems]
  );

  const availableItems = useMemo(
    () => scopedItems.filter((row) => row.status === 'available'),
    [scopedItems]
  );

  const flightGroups = useMemo(() => {
    if (!planItems?.length) return [] as FlightTreeGroup[];
    const roots = pruneTreeByCardFilter(
      filterPlanTreeRoots(buildPlanTree(planItems), {
        flightName: selectedFlightName,
        systemId: selectedSystemId,
      }),
      cardFilter
    );
    return groupPlanTreeByFlight(roots).filter(
      (group) => group.children.length > 0
    );
  }, [planItems, selectedFlightName, selectedSystemId, cardFilter]);

  /** Parent entity + flight keys in the currently visible tree. */
  const scopedParentKeys = useMemo(() => {
    const keys: string[] = [];
    function walk(nodes: PlanTreeNode[]) {
      for (const node of nodes) {
        if (node.children.length > 0) keys.push(rowKey(node.row));
        walk(node.children);
      }
    }
    for (const group of flightGroups) {
      keys.push(flightCollapseKey(group.flightName));
      walk(group.children);
    }
    return keys;
  }, [flightGroups]);

  const scopedAllCollapsed =
    scopedParentKeys.length > 0 &&
    scopedParentKeys.every((key) => collapsedKeys.has(key));

  function toggleCardFilter(next: CardStatusFilter) {
    setCardFilter((prev) => (prev === next ? 'all' : next));
  }

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

  function renderPlanNode(node: PlanTreeNode): ReactNode {
    const row = node.row;
    const key = rowKey(row);
    const isShort = row.status === 'short';
    const isBusy = busyKey === key || reservingAll;
    const serials = (row.serial_numbers ?? []).filter(Boolean);
    const showSerialSelect = row.status === 'available' && serials.length > 1;
    const currentSerial =
      serialByKey[key] !== undefined ? serialByKey[key] : defaultSerial(row);
    const currentDeveloper = developerByKey[key] || NONE_DEVELOPER;
    const isParent = node.children.length > 0;
    const isCollapsed = collapsedKeys.has(key);
    const detailsOpen = expandedDetailKeys.has(key);
    const isSystem = row.target_entity_type === 'system';

    return (
      <li key={key}>
        <div
          className={cn(
            'flex flex-col gap-2 rounded-md px-2 py-1.5 sm:flex-row sm:items-start sm:justify-between',
            isSystem && 'border border-teal-600/25 bg-teal-600/5',
            isShort && 'bg-destructive/5',
            isShort && isSystem && 'border-destructive/30 bg-destructive/5'
          )}
        >
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-baseline gap-x-1.5 gap-y-1">
              <span
                className={cn(
                  'text-[10px] font-medium uppercase tracking-wide',
                  isSystem ? 'text-teal-700' : 'text-muted-foreground'
                )}
              >
                {row.target_entity_type}
              </span>
              {isParent ? (
                <button
                  type="button"
                  className={cn(
                    'text-left hover:underline',
                    isSystem
                      ? 'font-medium text-teal-950 hover:text-teal-800'
                      : 'text-foreground hover:text-primary',
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
                <span className="text-foreground">{row.entity_name}</span>
              )}
              {statusBadge(row)}
              <button
                type="button"
                className={cn(
                  'inline-flex rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground',
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
                <Info className="h-3.5 w-3.5 shrink-0" />
              </button>
            </div>
            {detailsOpen ? (
              <div className="space-y-1 pl-0.5">
                <p className="truncate text-xs text-muted-foreground">{row.path}</p>
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
                    {row.suggested_serial ? ` · SN ${row.suggested_serial}` : ''}
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
                        <SelectItem value={NONE_DEVELOPER}>No developer</SelectItem>
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
                        <SelectItem value={NONE_DEVELOPER}>No developer</SelectItem>
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
        </div>
        {isParent && !isCollapsed ? (
          <ul
            className={cn(
              'ml-3 mt-1 space-y-1 border-l pl-3',
              isSystem ? 'border-teal-600/35' : 'border-border/60'
            )}
          >
            {node.children.map((child) => renderPlanNode(child))}
          </ul>
        ) : null}
      </li>
    );
  }

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
          <button
            type="button"
            onClick={() => toggleCardFilter('all')}
            aria-pressed={cardFilter === 'all'}
            className={cn(
              'rounded-lg border p-3 text-left transition-colors hover:bg-muted/50',
              cardFilter === 'all' && 'border-primary ring-2 ring-primary/30'
            )}
          >
            <p className="text-xs text-muted-foreground">Hierarchy items</p>
            <p className="text-lg font-semibold">{scopedStats.total}</p>
          </button>
          <button
            type="button"
            onClick={() => toggleCardFilter('available')}
            aria-pressed={cardFilter === 'available'}
            className={cn(
              'rounded-lg border border-emerald-600/30 bg-emerald-600/5 p-3 text-left transition-colors hover:bg-emerald-600/10',
              cardFilter === 'available' &&
                'border-emerald-600 ring-2 ring-emerald-600/40'
            )}
          >
            <p className="text-xs text-muted-foreground">Available to reserve</p>
            <p className="text-lg font-semibold text-emerald-800">
              {scopedStats.available}
            </p>
          </button>
          <button
            type="button"
            onClick={() => toggleCardFilter('assemble')}
            aria-pressed={cardFilter === 'assemble'}
            className={cn(
              'rounded-lg border border-amber-600/30 bg-amber-600/5 p-3 text-left transition-colors hover:bg-amber-600/10',
              cardFilter === 'assemble' &&
                'border-amber-600 ring-2 ring-amber-600/40'
            )}
          >
            <p className="text-xs text-muted-foreground">Waiting for children</p>
            <p className="text-lg font-semibold text-amber-900">
              {scopedStats.assemble}
            </p>
          </button>
          <button
            type="button"
            onClick={() => toggleCardFilter('short')}
            aria-pressed={cardFilter === 'short'}
            className={cn(
              'rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-left transition-colors hover:bg-destructive/10',
              cardFilter === 'short' &&
                'border-destructive ring-2 ring-destructive/40'
            )}
          >
            <p className="text-xs text-muted-foreground">Short / no match</p>
            <p className="text-lg font-semibold text-destructive">
              {scopedStats.short}
            </p>
          </button>
          <button
            type="button"
            onClick={() => toggleCardFilter('reserved')}
            aria-pressed={cardFilter === 'reserved'}
            className={cn(
              'rounded-lg border p-3 text-left transition-colors hover:bg-muted/50',
              cardFilter === 'reserved' &&
                'border-primary ring-2 ring-primary/30'
            )}
          >
            <p className="text-xs text-muted-foreground">Already reserved</p>
            <p className="text-lg font-semibold">{scopedStats.reserved}</p>
          </button>
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
        {flightFilters.length > 0 ? (
          <div className="space-y-2 border-b px-4 py-3">
            <p className="text-[10px] font-medium uppercase tracking-wide text-sky-700">
              Flights
            </p>
            <div className="flex flex-wrap gap-2">
              {flightFilters.map((flight) => {
                const selected = selectedFlightName === flight.name;
                return (
                  <button
                    key={flight.name}
                    type="button"
                    onClick={() =>
                      setSelectedFlightName((prev) =>
                        prev === flight.name ? null : flight.name
                      )
                    }
                    className={cn(
                      'inline-flex min-w-[9.5rem] max-w-full flex-col gap-1.5 rounded-md border px-3 py-2 text-left transition-colors',
                      selected
                        ? 'border-sky-600 bg-sky-600/15'
                        : 'border-sky-600/25 bg-sky-600/5 hover:bg-sky-600/10'
                    )}
                    aria-pressed={selected}
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-medium text-sky-950">
                        {flight.name}
                      </span>
                      <span className="shrink-0 tabular-nums text-xs text-sky-800/80">
                        {flight.progress_pct}%
                      </span>
                    </span>
                    <Progress value={flight.progress_pct} className="h-1.5" />
                    <span className="text-[10px] tabular-nums text-sky-800/70">
                      {flight.system_count} system
                      {flight.system_count === 1 ? '' : 's'}
                      {flight.weight > 0
                        ? ` · ${flight.verified_leaves}/${flight.weight} verified`
                        : ''}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}
        {systemFilters.length > 0 ? (
          <div className="space-y-2 border-b px-4 py-3">
            <p className="text-[10px] font-medium uppercase tracking-wide text-teal-700">
              Systems
              {selectedFlightName ? ` · ${selectedFlightName}` : ''}
            </p>
            <div className="flex flex-wrap gap-2">
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
                        ? 'border-teal-600 bg-teal-600/15'
                        : 'border-teal-600/25 bg-teal-600/5 hover:bg-teal-600/10'
                    )}
                    aria-pressed={selected}
                    title={
                      system.label !== system.name
                        ? `${system.label} · ${system.name}`
                        : system.name
                    }
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-medium text-teal-950">
                        {system.label}
                      </span>
                      <span className="shrink-0 tabular-nums text-xs text-teal-800/80">
                        {system.progress_pct}%
                      </span>
                    </span>
                    <Progress value={system.progress_pct} className="h-1.5" />
                    <span className="flex flex-wrap items-center gap-1.5">
                      {system.status ? (
                        <StatusBadge
                          status={system.status}
                          className="text-[10px]"
                        />
                      ) : null}
                      {system.weight > 0 ? (
                        <span className="text-[10px] tabular-nums text-teal-800/70">
                          {system.verified_leaves}/{system.weight} verified
                        </span>
                      ) : null}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}
        {!plan || !planItems || planItems.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">
            No hierarchy shells found. Generate hierarchy on the project first.
          </p>
        ) : flightGroups.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">
            No hierarchy items for the selected filter.
          </p>
        ) : (
          <div className="bg-muted/20 px-4 py-3 text-sm">
            <ul className="space-y-3">
              {flightGroups.map((group) => {
                const flightKey = flightCollapseKey(group.flightName);
                const flightCollapsed = collapsedKeys.has(flightKey);
                return (
                  <li
                    key={group.flightName}
                    className="rounded-md border border-sky-600/30 bg-sky-600/5 px-2 py-2"
                  >
                    <button
                      type="button"
                      className="flex w-full flex-wrap items-baseline gap-x-1.5 gap-y-0.5 rounded px-1 py-0.5 text-left hover:bg-sky-600/10"
                      onClick={() => toggleCollapsed(flightKey)}
                      aria-expanded={!flightCollapsed}
                      title={
                        flightCollapsed
                          ? `Expand ${group.flightName}`
                          : `Collapse ${group.flightName}`
                      }
                    >
                      <span className="text-[10px] font-medium uppercase tracking-wide text-sky-700">
                        Flight
                      </span>
                      <span className="font-medium text-sky-950">
                        {group.flightName}
                      </span>
                      <span className="text-[10px] text-sky-800/70">
                        {flightCollapsed
                          ? `(${group.children.length} systems collapsed)`
                          : null}
                      </span>
                    </button>
                    {!flightCollapsed ? (
                      <ul className="ml-3 mt-1 space-y-1.5 border-l border-sky-600/40 pl-3">
                        {group.children.map((node) => renderPlanNode(node))}
                      </ul>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/80">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <p className="text-sm text-muted-foreground">
            {availableItems.length > 0
              ? `${availableItems.length} available match${availableItems.length === 1 ? '' : 'es'} ready to lock`
              : 'No available matches left to reserve'}
            {scopedStats.short > 0
              ? ` · ${scopedStats.short} short (highlighted)`
              : ''}
            {scopedStats.assemble > 0
              ? ` · ${scopedStats.assemble} waiting for children`
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

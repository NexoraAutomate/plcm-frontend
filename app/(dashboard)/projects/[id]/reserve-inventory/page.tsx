'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Lock,
  Package,
  RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Can } from '@/components/auth';
import { PageLoader } from '@/components/page-loader';
import { P } from '@/lib/permission-codes';
import * as api from '@/lib/api';
import type { Project, ReservationPlan, ReservationPlanItem } from '@/lib/models';
import { ProjectWorkflowStatus } from '@/lib/workflow-status';
import { cn } from '@/lib/utils';

function apiError(error: unknown, fallback: string): string {
  const detail = (error as { response?: { data?: { detail?: string } } })?.response
    ?.data?.detail;
  return typeof detail === 'string' ? detail : fallback;
}

function statusBadge(status: string) {
  if (status === 'available') {
    return (
      <Badge className="bg-emerald-600/15 text-emerald-800 border-emerald-600/30 hover:bg-emerald-600/15">
        Available
      </Badge>
    );
  }
  if (status === 'reserved') {
    return (
      <Badge variant="secondary" className="gap-1">
        <Lock className="h-3 w-3" />
        Reserved
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

export default function ReserveInventoryPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = Number(params.id);
  const [project, setProject] = useState<Project | null>(null);
  const [plan, setPlan] = useState<ReservationPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [reservingAll, setReservingAll] = useState(false);

  const load = useCallback(async () => {
    if (!Number.isFinite(projectId)) return;
    setLoading(true);
    try {
      const [projectRes, planRes] = await Promise.all([
        api.projects.get(projectId),
        api.projects.reservationPlan(projectId),
      ]);
      setProject(projectRes.data);
      setPlan(planRes.data);
    } catch (error: unknown) {
      toast.error(apiError(error, 'Failed to load reservation plan'));
      setPlan(null);
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

  async function reserveOne(row: ReservationPlanItem) {
    if (row.status !== 'available') return;
    const key = `${row.target_entity_type}:${row.target_entity_id}`;
    setBusyKey(key);
    try {
      const res = await api.projects.createReservation(projectId, {
        target_entity_type: row.target_entity_type,
        target_entity_id: row.target_entity_id,
        inventory_id: row.inventory_id ?? undefined,
        serial_number: row.suggested_serial ?? undefined,
        flight_id: row.flight_id ?? undefined,
        sdls_id: row.sdls_id ?? undefined,
      });
      if (res.data.outcome === 'shortage') {
        toast.message('Shortage recorded — no free stock at reserve time');
      } else {
        toast.success(
          `Reserved ${res.data.reservation?.serial_number || row.inventory_name || row.entity_name}`
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
    try {
      for (const row of availableItems) {
        try {
          const res = await api.projects.createReservation(projectId, {
            target_entity_type: row.target_entity_type,
            target_entity_id: row.target_entity_id,
            inventory_id: row.inventory_id ?? undefined,
            serial_number: row.suggested_serial ?? undefined,
            flight_id: row.flight_id ?? undefined,
            sdls_id: row.sdls_id ?? undefined,
          });
          if (res.data.outcome === 'reserved') ok += 1;
          else failed += 1;
        } catch {
          failed += 1;
        }
      }
      if (ok > 0) {
        toast.success(
          `Reserved ${ok} item${ok === 1 ? '' : 's'}${failed ? ` · ${failed} skipped` : ''}`
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
  const notReady = status !== ProjectWorkflowStatus.READY_FOR_INVENTORY;

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
              ? `${project.name} — matched AVAILABLE stock for each hierarchy shell`
              : 'Matched AVAILABLE stock for each hierarchy shell'}
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
          Project must be <strong>Ready for Inventory</strong> before reserving.
          Generate hierarchy first if it is still Approved.
        </div>
      ) : null}

      {plan ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
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
        <div className="border-b bg-muted/40 px-4 py-2 text-sm font-medium">
          Hierarchy → matched inventory
        </div>
        {!plan || plan.items.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">
            No hierarchy shells found. Generate hierarchy on the project first.
          </p>
        ) : (
          <ul className="divide-y">
            {plan.items.map((row) => {
              const key = `${row.target_entity_type}:${row.target_entity_id}`;
              const isShort = row.status === 'short';
              const isBusy = busyKey === key || reservingAll;
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
                      <span className="font-medium">{row.entity_name}</span>
                      <span className="text-xs uppercase text-muted-foreground">
                        {row.target_entity_type}
                      </span>
                      {statusBadge(row.status)}
                    </div>
                    <p className="truncate text-xs text-muted-foreground">{row.path}</p>
                    {row.status === 'available' ? (
                      <p className="flex flex-wrap items-center gap-x-2 text-xs text-emerald-800">
                        <Package className="inline h-3.5 w-3.5" />
                        <span>
                          {row.inventory_name || 'Stock'}
                          {row.part_number ? ` · PN ${row.part_number}` : ''}
                          {row.suggested_serial
                            ? ` · SN ${row.suggested_serial}`
                            : row.free_quantity != null
                              ? ` · qty ${row.free_quantity}`
                              : ''}
                        </span>
                      </p>
                    ) : null}
                    {isShort ? (
                      <p className="text-xs text-destructive">
                        {row.reason || 'No matching available inventory for this entity'}
                      </p>
                    ) : null}
                    {row.status === 'reserved' ? (
                      <p className="flex items-center gap-1 text-xs text-muted-foreground">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Already reserved to this hierarchy node
                      </p>
                    ) : null}
                  </div>
                  <div className="shrink-0">
                    <Can permission={P.inventory_reserve}>
                      {row.status === 'available' ? (
                        <Button
                          size="sm"
                          disabled={isBusy || notReady}
                          onClick={() => void reserveOne(row)}
                        >
                          {busyKey === key ? 'Reserving…' : 'Reserve Inventory'}
                        </Button>
                      ) : row.status === 'short' ? (
                        <Button size="sm" variant="outline" disabled>
                          No stock
                        </Button>
                      ) : (
                        <Button size="sm" variant="secondary" disabled>
                          Reserved
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
                  notReady ||
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

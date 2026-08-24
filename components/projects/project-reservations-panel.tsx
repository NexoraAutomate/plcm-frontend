'use client';

import { useCallback, useEffect, useState } from 'react';
import { ChevronDown, Clock, Unlock } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Can } from '@/components/auth';
import { P } from '@/lib/permission-codes';
import * as api from '@/lib/api';
import type { InventoryReservation, Project } from '@/lib/models';
import { isOpenConfigChange } from '@/lib/config-change';
import { ProjectWorkflowStatus } from '@/lib/workflow-status';
import { useDataStore } from '@/lib/data-store';
import { cn } from '@/lib/utils';
type Props = {
  project: Project;
};

function apiError(error: unknown, fallback: string): string {
  const detail = (error as { response?: { data?: { detail?: string } } })?.response
    ?.data?.detail;
  return typeof detail === 'string' ? detail : fallback;
}

function formatCountdown(iso?: string | null): string {
  if (!iso) return '—';
  const ms = new Date(iso).getTime() - Date.now();
  if (Number.isNaN(ms)) return '—';
  if (ms <= 0) return 'due';
  const days = Math.floor(ms / 86_400_000);
  const hours = Math.floor((ms % 86_400_000) / 3_600_000);
  if (days > 1) return `${days}d`;
  if (days === 1) return hours > 0 ? `1d ${hours}h` : '1d';
  if (hours > 0) return `${hours}h`;
  const mins = Math.max(1, Math.floor(ms / 60_000));
  return `${mins}m`;
}

function isAutoReleased(row: InventoryReservation): boolean {
  return Boolean(row.notes?.includes('AUTO_RELEASE_EXPIRY'));
}

export function ProjectReservationsPanel({ project }: Props) {
  const status = project.status_name ?? '';
  const isReady = status === ProjectWorkflowStatus.READY_FOR_INVENTORY;
  const [configChangeOpen, setConfigChangeOpen] = useState(false);
  const [reservations, setReservations] = useState<InventoryReservation[]>([]);
  const [busy, setBusy] = useState(false);
  const [releaseId, setReleaseId] = useState<number | null>(null);
  const [releaseAllOpen, setReleaseAllOpen] = useState(false);
  const [sectionOpen, setSectionOpen] = useState(false);
  const { ensureHierarchyLoaded } = useDataStore();

  const refresh = useCallback(async () => {
    if (!isReady) return;
    const listRes = await api.projects.listReservations(project.id, false);
    setReservations(listRes.data);
  }, [isReady, project.id]);

  useEffect(() => {
    let cancelled = false;
    void api.projects
      .getConfigChange(project.id)
      .then((res) => {
        const open = isOpenConfigChange(res.data?.status);
        if (!cancelled) setConfigChangeOpen(open);
      })
      .catch(() => {
        if (!cancelled) setConfigChangeOpen(false);
      });
    return () => {
      cancelled = true;
    };
  }, [project.id, project.status_name]);

  useEffect(() => {
    if (!isReady) {
      setReservations([]);
      return;
    }
    void refresh().catch(() => {
      toast.error('Failed to load reservations');
    });
  }, [isReady, refresh]);

  useEffect(() => {
    if (!isReady) return;
    const id = window.setInterval(() => {
      void refresh().catch(() => undefined);
    }, 12_000);
    const onFocus = () => {
      void refresh().catch(() => undefined);
    };
    window.addEventListener('focus', onFocus);
    return () => {
      window.clearInterval(id);
      window.removeEventListener('focus', onFocus);
    };
  }, [isReady, refresh]);

  async function handleRelease() {
    if (releaseId == null) return;
    setBusy(true);
    try {
      await api.projects.releaseReservation(project.id, releaseId);
      toast.success('Reservation released — assignment removed from developer');
      setReleaseId(null);
      await Promise.all([refresh(), ensureHierarchyLoaded({ force: true })]);
    } catch (error: unknown) {
      toast.error(apiError(error, 'Release failed'));
    } finally {
      setBusy(false);
    }
  }

  async function handleReleaseAll() {
    const ids = reservations.filter((row) => row.status === 'active').map((row) => row.id);
    if (ids.length === 0) return;
    setBusy(true);
    try {
      for (const id of ids) {
        await api.projects.releaseReservation(project.id, id);
      }
      toast.success(
        `Released ${ids.length} reservation${ids.length === 1 ? '' : 's'} — developer assignments removed`
      );
      setReleaseAllOpen(false);
      await Promise.all([refresh(), ensureHierarchyLoaded({ force: true })]);
    } catch (error: unknown) {
      toast.error(apiError(error, 'Release all failed'));
    } finally {
      setBusy(false);
    }
  }

  async function handleExtend(reservationId: number) {
    setBusy(true);
    try {
      await api.projects.extendReservation(project.id, reservationId);
      toast.success('Reservation extended — idle timer delayed');
      await refresh();
    } catch (error: unknown) {
      toast.error(apiError(error, 'Extend failed'));
    } finally {
      setBusy(false);
    }
  }

  if (!isReady || configChangeOpen) return null;

  const active = reservations.filter((r) => r.status === 'active');
  const history = reservations.filter((r) => r.status !== 'active');

  return (
    <Collapsible open={sectionOpen} onOpenChange={setSectionOpen}>
      <div className="rounded-lg border">
        <div className="flex items-start justify-between gap-3 p-4">
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="min-w-0 flex-1 rounded-md text-left outline-none transition-colors hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring"
            >
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-medium">Inventory reservations</h3>
                {active.length > 0 ? (
                  <span className="rounded-full bg-muted px-2 py-0.5 text-xs tabular-nums text-muted-foreground">
                    {active.length} active
                  </span>
                ) : null}
                <ChevronDown
                  className={cn(
                    'h-4 w-4 shrink-0 text-muted-foreground transition-transform',
                    sectionOpen && 'rotate-180'
                  )}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Active holds for this project. Use Reserve inventory to lock stock. Idle
                reservations remind at 30 days, then auto-release after a 7-day grace (Spec 06).
              </p>
            </button>
          </CollapsibleTrigger>
          {active.length > 0 ? (
            <Can permission={P.inventory_release}>
              <Button
                size="sm"
                variant="outline"
                className="shrink-0"
                disabled={busy}
                onClick={() => setReleaseAllOpen(true)}
              >
                <Unlock className="mr-1 h-3.5 w-3.5" />
                Release all
              </Button>
            </Can>
          ) : null}
        </div>

        <CollapsibleContent>
          <div className="space-y-4 border-t px-4 py-4">
            {active.length === 0 ? (
              <p className="text-xs text-muted-foreground">No active project reservations.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {active.map((r) => (
                  <li
                    key={r.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-muted/20 px-3 py-2"
                  >
                    <div>
                      <div className="font-medium">
                        {r.flight_name || `Flight #${r.flight_id}`} /{' '}
                        {r.sdls_name || `SDLS #${r.sdls_id}`} ·{' '}
                        {r.inventory_name || r.target_entity_type}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {r.serial_number ? `SN ${r.serial_number}` : 'Qty unit'}
                        {r.part_number ? ` · PN ${r.part_number}` : ''}
                        {' · '}
                        by {r.reserved_by_name || r.reserved_by_user_id}
                        {r.notes?.includes('shortage fulfillment')
                          ? ' · auto-reserved (shortage)'
                          : ''}
                        {r.extension_count > 0 ? ` · extended ×${r.extension_count}` : ''}
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          reminder {formatCountdown(r.expires_at)}
                          {' · '}
                          {new Date(r.expires_at).toLocaleDateString()}
                        </span>
                        <span>
                          auto-release {formatCountdown(r.auto_release_at)}
                          {r.auto_release_at
                            ? ` · ${new Date(r.auto_release_at).toLocaleDateString()}`
                            : ''}
                        </span>
                        {r.last_reminder_at ? (
                          <span>
                            last reminder {new Date(r.last_reminder_at).toLocaleString()}
                          </span>
                        ) : (
                          <span>last reminder —</span>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Can permission={P.inventory_reserve}>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busy}
                          onClick={() => void handleExtend(r.id)}
                        >
                          Extend
                        </Button>
                      </Can>
                      <Can permission={P.inventory_release}>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busy}
                          onClick={() => setReleaseId(r.id)}
                        >
                          <Unlock className="mr-1 h-3.5 w-3.5" />
                          Release
                        </Button>
                      </Can>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            {history.length > 0 ? (
              <div className="space-y-2">
                <h4 className="text-xs font-medium text-muted-foreground">Reservation history</h4>
                <ul className="space-y-2 text-sm">
                  {history.map((r) => (
                    <li
                      key={r.id}
                      className="rounded-md border border-dashed bg-muted/10 px-3 py-2 text-xs text-muted-foreground"
                    >
                      <div className="font-medium text-foreground">
                        {r.flight_name || `Flight #${r.flight_id}`} /{' '}
                        {r.sdls_name || `SDLS #${r.sdls_id}`} ·{' '}
                        {r.inventory_name || r.target_entity_type}
                        {r.serial_number ? ` · SN ${r.serial_number}` : ''}
                      </div>
                      <div>
                        {isAutoReleased(r) ? 'Auto-released (AUTO_RELEASE_EXPIRY)' : 'Released'}
                        {r.released_at ? ` · ${new Date(r.released_at).toLocaleString()}` : ''}
                        {r.last_reminder_at
                          ? ` · last reminder ${new Date(r.last_reminder_at).toLocaleString()}`
                          : ''}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </CollapsibleContent>
      </div>

      <AlertDialog
        open={releaseId != null}
        onOpenChange={(open) => {
          if (!open) setReleaseId(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Release reservation?</AlertDialogTitle>
            <AlertDialogDescription>
              This returns the unit to AVAILABLE. If a developer is assigned to this item, that
              assignment is removed after you confirm, and they will no longer see it. Pending
              handover requests are cancelled.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              onClick={(e) => {
                e.preventDefault();
                void handleRelease();
              }}
            >
              {busy ? 'Releasing…' : 'Release'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={releaseAllOpen}
        onOpenChange={(open) => {
          if (!open) setReleaseAllOpen(false);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Release all reservations?</AlertDialogTitle>
            <AlertDialogDescription>
              {`This releases ${active.length} reserved unit${
                active.length === 1 ? '' : 's'
              } back to AVAILABLE. Developer assignments on those items will also be removed after you confirm.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              onClick={(e) => {
                e.preventDefault();
                void handleReleaseAll();
              }}
            >
              {busy ? 'Releasing…' : 'Release all'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Collapsible>
  );
}

'use client';

import { useCallback, useEffect, useState } from 'react';
import { Clock, Lock, Unlock } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import { ProjectWorkflowStatus } from '@/lib/workflow-status';
import { useDataStore } from '@/lib/data-store';

type HierarchyTree = Awaited<ReturnType<typeof api.projects.hierarchyTree>>['data'];

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
  const [tree, setTree] = useState<HierarchyTree | null>(null);
  const [reservations, setReservations] = useState<InventoryReservation[]>([]);
  const [busy, setBusy] = useState(false);
  const [systemKey, setSystemKey] = useState('');
  const [serial, setSerial] = useState('');
  const [serialOptions, setSerialOptions] = useState<string[]>([]);
  const [releaseId, setReleaseId] = useState<number | null>(null);
  const [releaseAllOpen, setReleaseAllOpen] = useState(false);
  const { ensureHierarchyLoaded } = useDataStore();

  const refresh = useCallback(async () => {
    if (!isReady) return;
    const [treeRes, listRes] = await Promise.all([
      api.projects.hierarchyTree(project.id),
      api.projects.listReservations(project.id, false),
    ]);
    setTree(treeRes.data);
    setReservations(listRes.data);
  }, [isReady, project.id]);

  useEffect(() => {
    if (!isReady) {
      setTree(null);
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

  const systemOptions =
    tree?.flights.flatMap((flight) =>
      flight.sdls.flatMap((sdls) =>
        sdls.systems.map((system) => ({
          key: String(system.id),
          label: `${flight.name} / ${sdls.name} / ${system.name}`,
          systemId: system.id,
        }))
      )
    ) ?? [];

  useEffect(() => {
    if (!systemKey || !isReady) {
      setSerialOptions([]);
      setSerial('');
      return;
    }
    let cancelled = false;
    void api.projects
      .checkReservationAvailability(project.id, {
        target_entity_type: 'system',
        target_entity_id: Number(systemKey),
      })
      .then((res) => {
        if (cancelled) return;
        const sns = res.data.serial_numbers ?? [];
        setSerialOptions(sns.filter(Boolean) as string[]);
        setSerial('');
        if (!res.data.available) {
          toast.message(res.data.reason || 'No free stock for this node');
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) toast.error(apiError(error, 'Availability check failed'));
      });
    return () => {
      cancelled = true;
    };
  }, [systemKey, isReady, project.id]);

  async function handleReserve() {
    if (!systemKey) {
      toast.error('Select a hierarchy system node');
      return;
    }
    setBusy(true);
    try {
      const res = await api.projects.createReservation(project.id, {
        target_entity_type: 'system',
        target_entity_id: Number(systemKey),
        serial_number: serial || undefined,
      });
      if (res.data.outcome === 'shortage' && res.data.shortage) {
        const s = res.data.shortage;
        toast.message('Shortage recorded — HM and IM notified', {
          description: `PN ${s.part_number || '—'}, Qty ${s.qty_short}, ${
            s.flight_name || s.flight_code || 'Flight'
          } / ${s.sdls_name || s.sdls_code || 'SDLS'} / ${s.lru_name || 'item'}`,
        });
      } else {
        const reserved = res.data.reservation;
        toast.success(
          `Reserved ${reserved?.serial_number || reserved?.inventory_name || 'unit'} for project`
        );
      }
      setSystemKey('');
      setSerial('');
      await refresh();
    } catch (error: unknown) {
      toast.error(apiError(error, 'Reserve failed'));
    } finally {
      setBusy(false);
    }
  }

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

  if (!isReady) return null;

  const active = reservations.filter((r) => r.status === 'active');
  const history = reservations.filter((r) => r.status !== 'active');

  return (
    <div className="space-y-4 rounded-lg border p-4">
      <div>
        <h3 className="text-sm font-medium">Inventory reservations</h3>
        <p className="text-xs text-muted-foreground">
          Reserve AVAILABLE stock against Flight → SDLS → System (Spec 04). Idle
          reservations remind at 30 days, then auto-release after a 7-day grace (Spec 06).
        </p>
      </div>

      <Can permission={P.inventory_reserve}>
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-65 space-y-1">
            <Label>Hierarchy node</Label>
            <Select value={systemKey} onValueChange={setSystemKey} disabled={busy}>
              <SelectTrigger>
                <SelectValue placeholder="Select Flight / SDLS / System" />
              </SelectTrigger>
              <SelectContent>
                {systemOptions.map((opt) => (
                  <SelectItem key={opt.key} value={opt.key}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {serialOptions.length > 0 ? (
            <div className="min-w-45 space-y-1">
              <Label>Serial</Label>
              <Select value={serial} onValueChange={setSerial} disabled={busy}>
                <SelectTrigger>
                  <SelectValue placeholder="Pick serial" />
                </SelectTrigger>
                <SelectContent>
                  {serialOptions.map((sn) => (
                    <SelectItem key={sn} value={sn}>
                      {sn}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}
          <Button onClick={() => void handleReserve()} disabled={busy || !systemKey}>
            <Lock className="mr-1.5 h-4 w-4" />
            Reserve
          </Button>
        </div>
      </Can>

      {active.length === 0 ? (
        <p className="text-xs text-muted-foreground">No active project reservations.</p>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center justify-end">
            <Can permission={P.inventory_release}>
              <Button
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() => setReleaseAllOpen(true)}
              >
                <Unlock className="mr-1 h-3.5 w-3.5" />
                Release all
              </Button>
            </Can>
          </div>
        <ul className="space-y-2 text-sm">
          {active.map((r) => (
            <li
              key={r.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-muted/20 px-3 py-2"
            >
              <div>
                <div className="font-medium">
                  {r.flight_name || `Flight #${r.flight_id}`} / {r.sdls_name || `SDLS #${r.sdls_id}`}{' '}
                  · {r.inventory_name || r.target_entity_type}
                </div>
                <div className="text-xs text-muted-foreground">
                  {r.serial_number ? `SN ${r.serial_number}` : 'Qty unit'}
                  {r.part_number ? ` · PN ${r.part_number}` : ''}
                  {' · '}
                  by {r.reserved_by_name || r.reserved_by_user_id}
                  {r.notes?.includes('shortage fulfillment') ? ' · auto-reserved (shortage)' : ''}
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
                    <span>last reminder {new Date(r.last_reminder_at).toLocaleString()}</span>
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
        </div>
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
                  {r.flight_name || `Flight #${r.flight_id}`} / {r.sdls_name || `SDLS #${r.sdls_id}`}{' '}
                  · {r.inventory_name || r.target_entity_type}
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
    </div>
  );
}

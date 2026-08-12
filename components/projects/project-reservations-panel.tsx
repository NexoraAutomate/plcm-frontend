'use client';

import { useCallback, useEffect, useState } from 'react';
import { Lock, Unlock } from 'lucide-react';
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

type HierarchyTree = Awaited<ReturnType<typeof api.projects.hierarchyTree>>['data'];

type Props = {
  project: Project;
};

function apiError(error: unknown, fallback: string): string {
  const detail = (error as { response?: { data?: { detail?: string } } })?.response
    ?.data?.detail;
  return typeof detail === 'string' ? detail : fallback;
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

  const refresh = useCallback(async () => {
    if (!isReady) return;
    const [treeRes, listRes] = await Promise.all([
      api.projects.hierarchyTree(project.id),
      api.projects.listReservations(project.id, true),
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
      toast.success(
        `Reserved ${res.data.serial_number || res.data.inventory_name || 'unit'} for project`
      );
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
      toast.success('Reservation released — unit AVAILABLE');
      setReleaseId(null);
      await refresh();
    } catch (error: unknown) {
      toast.error(apiError(error, 'Release failed'));
    } finally {
      setBusy(false);
    }
  }

  if (!isReady) return null;

  return (
    <div className="space-y-4 rounded-lg border p-4">
      <div>
        <h3 className="text-sm font-medium">Inventory reservations</h3>
        <p className="text-xs text-muted-foreground">
          Reserve AVAILABLE stock against Flight → SDLS → System (Spec 04). Locked until
          released or issued.
        </p>
      </div>

      <Can permission={P.inventory_reserve}>
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-[260px] space-y-1">
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
            <div className="min-w-[180px] space-y-1">
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

      {reservations.length === 0 ? (
        <p className="text-xs text-muted-foreground">No active project reservations.</p>
      ) : (
        <ul className="space-y-2 text-sm">
          {reservations.map((r) => (
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
                  {' · '}
                  expires {new Date(r.expires_at).toLocaleDateString()}
                </div>
              </div>
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
            </li>
          ))}
        </ul>
      )}

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
              This returns the unit to AVAILABLE so other projects can reserve it.
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
    </div>
  );
}

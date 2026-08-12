'use client';

import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, GitBranch, UserCog } from 'lucide-react';
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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
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
import { StatusBadge } from '@/components/status-badge';
import { Can, WorkflowCan } from '@/components/auth';
import { P } from '@/lib/permission-codes';
import * as api from '@/lib/api';
import type { Project, User } from '@/lib/models';
import { ProjectWorkflowStatus } from '@/lib/workflow-status';

type Props = {
  project: Project;
  users: User[];
  onUpdated: (project: Project) => void;
};

type HierarchyTree = Awaited<
  ReturnType<typeof api.projects.hierarchyTree>
>['data'];

export function ProjectWorkflowActions({ project, users, onUpdated }: Props) {
  const [busy, setBusy] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [tree, setTree] = useState<HierarchyTree | null>(null);
  const [hmId, setHmId] = useState<string>(
    project.assigned_hm_id ? String(project.assigned_hm_id) : ''
  );

  useEffect(() => {
    setHmId(project.assigned_hm_id ? String(project.assigned_hm_id) : '');
  }, [project.assigned_hm_id]);

  const status = project.status_name ?? '';
  const isDraft = status === ProjectWorkflowStatus.DRAFT;
  const isApproved = status === ProjectWorkflowStatus.APPROVED;
  const isReady =
    status === ProjectWorkflowStatus.READY_FOR_INVENTORY ||
    status === ProjectWorkflowStatus.HIERARCHY_GENERATED;

  useEffect(() => {
    if (!isReady) {
      setTree(null);
      return;
    }
    let cancelled = false;
    void api.projects
      .hierarchyTree(project.id)
      .then((res) => {
        if (!cancelled) setTree(res.data);
      })
      .catch(() => {
        if (!cancelled) setTree(null);
      });
    return () => {
      cancelled = true;
    };
  }, [project.id, isReady, status]);

  const hmCandidates = useMemo(() => {
    return users.filter((u) => {
      const roles = (u.roles ?? []).map((r) => r.toLowerCase());
      return (
        roles.includes('hierarchymanager') ||
        roles.includes('projectmanager') ||
        roles.includes('admin')
      );
    });
  }, [users]);

  const expectedSdls =
    (project.flight_count ?? 0) * (project.sdls_per_flight ?? 0);

  async function handleApprove() {
    setBusy(true);
    try {
      const res = await api.projects.approve(project.id);
      onUpdated(res.data);
      toast.success('Project approved');
    } catch (error: unknown) {
      const detail =
        (error as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail || 'Approve failed';
      toast.error(typeof detail === 'string' ? detail : 'Approve failed');
    } finally {
      setBusy(false);
    }
  }

  async function handleAssignHm() {
    if (!hmId) {
      toast.error('Select a Hierarchy Manager');
      return;
    }
    setBusy(true);
    try {
      const res = await api.projects.assignHm(project.id, Number(hmId));
      onUpdated(res.data);
      toast.success('Hierarchy Manager assigned');
    } catch (error: unknown) {
      const detail =
        (error as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail || 'Assign HM failed';
      toast.error(typeof detail === 'string' ? detail : 'Assign HM failed');
    } finally {
      setBusy(false);
    }
  }

  async function handleGenerate() {
    setBusy(true);
    try {
      const res = await api.projects.generateHierarchy(project.id);
      if (res.data.project) {
        onUpdated(res.data.project);
      } else {
        const refreshed = await api.projects.get(project.id);
        onUpdated(refreshed.data);
      }
      const c = res.data.counts;
      toast.success(
        `Hierarchy ready: ${c.flights} flights · ${c.sdls} SDLS · ${c.systems} systems`
      );
      setConfirmOpen(false);
    } catch (error: unknown) {
      const detail =
        (error as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail || 'Generate Hierarchy failed';
      toast.error(typeof detail === 'string' ? detail : 'Generate Hierarchy failed');
    } finally {
      setBusy(false);
    }
  }

  const generateDisabled = !isApproved;
  const generateTooltip = isDraft
    ? 'Approval required before Generate Hierarchy'
    : isApproved
      ? 'Generate Flight → SDLS → System tree from the selected configuration'
      : isReady
        ? 'Hierarchy already generated'
        : 'Project must be APPROVED before hierarchy generation';

  return (
    <div className="space-y-4 rounded-lg border p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium">Workflow</span>
        <StatusBadge status={status || 'Unknown'} />
        {project.product_type ? (
          <span className="text-xs text-muted-foreground">
            {project.product_type} · {project.flight_count ?? '—'} flights ·{' '}
            {project.sdls_per_flight ?? '—'} SDLS/flight
          </span>
        ) : null}
      </div>

      <Can permission={P.project_assign_hm}>
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-[220px] space-y-1">
            <Label>Assign Hierarchy Manager</Label>
            <Select value={hmId} onValueChange={setHmId} disabled={busy}>
              <SelectTrigger>
                <SelectValue placeholder="Select HM" />
              </SelectTrigger>
              <SelectContent>
                {hmCandidates.map((u) => (
                  <SelectItem key={u.id} value={String(u.id)}>
                    {u.full_name || u.username}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button variant="outline" onClick={() => void handleAssignHm()} disabled={busy}>
            <UserCog className="mr-1.5 h-4 w-4" />
            Assign HM
          </Button>
        </div>
      </Can>

      <div className="flex flex-wrap gap-2">
        <Can permission={P.project_approve}>
          <Button onClick={() => void handleApprove()} disabled={busy || !isDraft}>
            <CheckCircle2 className="mr-1.5 h-4 w-4" />
            Approve
          </Button>
        </Can>

        <Can permission={P.hierarchy_generate}>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <Button
                    variant="outline"
                    disabled={busy || generateDisabled}
                    onClick={() => setConfirmOpen(true)}
                  >
                    <GitBranch className="mr-1.5 h-4 w-4" />
                    Generate Hierarchy
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent>{generateTooltip}</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </Can>

        <WorkflowCan role={['HM', 'ADMIN']}>
          {!isApproved && !isReady ? (
            <p className="w-full text-xs text-muted-foreground">
              Generate Hierarchy stays disabled until Admin approval.
            </p>
          ) : null}
          {isReady ? (
            <p className="w-full text-xs text-muted-foreground">
              Hierarchy generated — project is ready for inventory reservation (Spec 04).
            </p>
          ) : null}
        </WorkflowCan>
      </div>

      {tree && tree.flights.length > 0 ? (
        <div className="rounded-md border bg-muted/30 p-3 text-sm">
          <p className="mb-2 font-medium">Generated hierarchy</p>
          <ul className="space-y-2">
            {tree.flights.map((flight) => (
              <li key={flight.id}>
                <span className="font-medium">{flight.name}</span>
                <ul className="ml-4 mt-1 space-y-1 text-muted-foreground">
                  {flight.sdls.map((sdls) => (
                    <li key={sdls.id}>
                      {sdls.name}
                      {sdls.systems.length > 0 ? (
                        <span className="text-xs">
                          {' '}
                          · {sdls.systems.map((s) => s.name).join(', ')}
                        </span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Generate hierarchy?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>
                  This creates the project tree from the selected configuration and cannot be
                  re-run.
                </p>
                <ul className="list-disc space-y-1 pl-4">
                  <li>
                    Product type: <strong>{project.product_type || '—'}</strong>
                  </li>
                  <li>
                    Flights: <strong>{project.flight_count ?? '—'}</strong>
                  </li>
                  <li>
                    SDLS per flight: <strong>{project.sdls_per_flight ?? '—'}</strong>
                  </li>
                  <li>
                    Total SDLS nodes: <strong>{expectedSdls || '—'}</strong>
                  </li>
                </ul>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              onClick={(e) => {
                e.preventDefault();
                void handleGenerate();
              }}
            >
              {busy ? 'Generating…' : 'Generate'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

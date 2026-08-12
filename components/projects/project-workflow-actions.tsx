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

export function ProjectWorkflowActions({ project, users, onUpdated }: Props) {
  const [busy, setBusy] = useState(false);
  const [hmId, setHmId] = useState<string>(
    project.assigned_hm_id ? String(project.assigned_hm_id) : ''
  );

  useEffect(() => {
    setHmId(project.assigned_hm_id ? String(project.assigned_hm_id) : '');
  }, [project.assigned_hm_id]);

  const status = project.status_name ?? '';
  const isDraft = status === ProjectWorkflowStatus.DRAFT;
  const isApproved = status === ProjectWorkflowStatus.APPROVED;

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
      await api.projects.generateHierarchy(project.id);
      toast.success('Hierarchy generation started');
    } catch (error: unknown) {
      const detail =
        (error as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail || 'Generate Hierarchy is not available yet';
      toast.error(typeof detail === 'string' ? detail : 'Generate Hierarchy blocked');
    } finally {
      setBusy(false);
    }
  }

  const generateDisabled = !isApproved;
  const generateTooltip = isDraft
    ? 'Approval required before Generate Hierarchy'
    : isApproved
      ? 'Generate Hierarchy ships in Spec 03'
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

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <span>
                <Button
                  variant="outline"
                  disabled={busy || generateDisabled}
                  onClick={() => void handleGenerate()}
                >
                  <GitBranch className="mr-1.5 h-4 w-4" />
                  Generate Hierarchy
                </Button>
              </span>
            </TooltipTrigger>
            <TooltipContent>{generateTooltip}</TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <WorkflowCan role={['HM', 'ADMIN']}>
          {!isApproved ? (
            <p className="w-full text-xs text-muted-foreground">
              Generate Hierarchy stays disabled until Admin approval (Spec 02). Execution
              lands in Spec 03.
            </p>
          ) : null}
        </WorkflowCan>
      </div>
    </div>
  );
}

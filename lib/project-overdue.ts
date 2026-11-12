import type { Project } from '@/lib/models';
import { workflowStatusLabel } from '@/lib/workflow-status';

function isTerminalStatus(statusName: string): boolean {
  const label = workflowStatusLabel(statusName).toLowerCase();
  return label === 'completed' || label === 'cancelled' || label === 'superseded';
}

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Schedule-derived overdue: past end_date while the project is still active.
 * Not a workflow status — keep separate from StatusBadge.
 */
export function isProjectOverdue(
  project: Pick<Project, 'end_date'> | null | undefined,
  statusName?: string | null
): boolean {
  if (!project?.end_date) return false;
  if (statusName && isTerminalStatus(statusName)) return false;
  const end = new Date(project.end_date);
  if (Number.isNaN(end.getTime())) return false;
  return end < startOfToday();
}

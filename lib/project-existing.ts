import type { Project } from '@/lib/models';
import { isProjectCompleted } from '@/lib/workflow-status';

export function isExistingProject(project?: Pick<Project, 'is_existing_project'> | null): boolean {
  return Boolean(project?.is_existing_project);
}

/**
 * Replace unlocks after a normal project is marked COMPLETED.
 * Existing (in-service) projects keep Replace without that gate.
 */
export function projectAllowsReplace(
  project?: Pick<Project, 'is_existing_project' | 'status_name'> | null
): boolean {
  if (!project) return false;
  if (isExistingProject(project)) return true;
  return isProjectCompleted(project.status_name);
}

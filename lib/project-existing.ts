import type { Project } from '@/lib/models';

export function isExistingProject(project?: Pick<Project, 'is_existing_project'> | null): boolean {
  return Boolean(project?.is_existing_project);
}

'use client';

import {
  buildEntityDisplayContexts,
  getCaseDisplayStatus,
  getCaseStatusMeta,
  mapCaseStatusFromApi,
  type MaintenanceCaseWorkflowStatus,
} from '@/lib/maintenance-workflow';
import type { MaintenanceAction, MaintenanceCase, FaultyEntity } from '@/lib/models';
import { WorkflowStatusBadge } from './workflow-status-badge';

interface MaintenanceCaseStatusBadgeProps {
  apiStatus?: string;
  displayStatus?: MaintenanceCaseWorkflowStatus;
  maintenanceCase?: MaintenanceCase | null;
  entities?: FaultyEntity[];
  actions?: MaintenanceAction[];
  className?: string;
}

export function MaintenanceCaseStatusBadge({
  apiStatus,
  displayStatus,
  maintenanceCase,
  entities = [],
  actions = [],
  className,
}: MaintenanceCaseStatusBadgeProps) {
  const contexts = buildEntityDisplayContexts(entities, actions);
  const resolvedDisplay =
    displayStatus ??
    (maintenanceCase
      ? getCaseDisplayStatus(maintenanceCase, contexts, actions)
      : apiStatus
      ? mapCaseStatusFromApi(apiStatus, { entities: contexts, actions })
      : undefined);

  if (!resolvedDisplay) return null;

  return (
    <WorkflowStatusBadge
      meta={getCaseStatusMeta(resolvedDisplay)}
      className={className}
    />
  );
}

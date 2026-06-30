'use client';

import {
  getFaultyEntityStatusMeta,
  isPotentiallyAffected,
  mapFaultyEntityStatusFromApi,
} from '@/lib/maintenance-workflow';
import type { FaultyEntity, MaintenanceAction } from '@/lib/models';
import { WorkflowStatusBadge } from './workflow-status-badge';
import { PotentiallyAffectedBadge } from './potentially-affected-badge';

interface FaultyEntityStatusBadgeProps {
  entity: FaultyEntity;
  allEntities?: FaultyEntity[];
  actions?: MaintenanceAction[];
  className?: string;
  showPotentiallyAffected?: boolean;
}

export function FaultyEntityStatusBadge({
  entity,
  allEntities = [],
  actions = [],
  className,
  showPotentiallyAffected = true,
}: FaultyEntityStatusBadgeProps) {
  const entityActions = actions.filter((a) => a.faulty_entity_id === entity.id);
  const displayStatus = mapFaultyEntityStatusFromApi(entity, entityActions);
  const potentiallyAffected =
    showPotentiallyAffected &&
    isPotentiallyAffected(entity, allEntities.length ? allEntities : [entity], actions);

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <WorkflowStatusBadge
        meta={getFaultyEntityStatusMeta(displayStatus)}
        className={className}
      />
      {potentiallyAffected && <PotentiallyAffectedBadge />}
    </div>
  );
}

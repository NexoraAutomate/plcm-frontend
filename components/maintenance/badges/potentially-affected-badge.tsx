'use client';

import { POTENTIALLY_AFFECTED_META } from '@/lib/maintenance-workflow';
import { WorkflowStatusBadge } from './workflow-status-badge';

interface PotentiallyAffectedBadgeProps {
  className?: string;
}

export function PotentiallyAffectedBadge({ className }: PotentiallyAffectedBadgeProps) {
  return (
    <WorkflowStatusBadge meta={POTENTIALLY_AFFECTED_META} className={className} />
  );
}

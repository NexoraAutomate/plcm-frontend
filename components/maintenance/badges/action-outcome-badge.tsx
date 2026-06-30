'use client';

import { getActionOutcomeMeta } from '@/lib/maintenance-workflow';
import { WorkflowStatusBadge } from './workflow-status-badge';

interface ActionOutcomeBadgeProps {
  outcome: string;
  className?: string;
}

export function ActionOutcomeBadge({ outcome, className }: ActionOutcomeBadgeProps) {
  return (
    <WorkflowStatusBadge
      meta={getActionOutcomeMeta(outcome)}
      className={className}
    />
  );
}

'use client';

import { getResolutionTypeMeta } from '@/lib/maintenance-workflow';
import { WorkflowStatusBadge } from './workflow-status-badge';

interface ResolutionTypeBadgeProps {
  resolutionType?: string | null;
  className?: string;
}

export function ResolutionTypeBadge({ resolutionType, className }: ResolutionTypeBadgeProps) {
  if (!resolutionType) return null;
  const meta = getResolutionTypeMeta(resolutionType);
  if (!meta) return null;

  return <WorkflowStatusBadge meta={meta} className={className} />;
}

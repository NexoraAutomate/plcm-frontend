'use client';

import { StatusBadge } from '@/components/status-badge';

interface EntityStatusBadgeProps {
  status: string;
  className?: string;
}

/** Legacy badge for raw API status strings outside workflow surfaces. */
export function EntityStatusBadge({ status, className }: EntityStatusBadgeProps) {
  return <StatusBadge status={status} className={className} />;
}

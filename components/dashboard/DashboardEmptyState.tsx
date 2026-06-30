'use client';

import { cn } from '@/lib/utils';

interface DashboardEmptyStateProps {
  message?: string;
  compact?: boolean;
}

export function DashboardEmptyState({
  message = 'No data available',
  compact = false,
}: DashboardEmptyStateProps) {
  return (
    <div
      className={cn(
        'flex items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground',
        compact ? 'h-24' : 'h-48'
      )}
    >
      {message}
    </div>
  );
}

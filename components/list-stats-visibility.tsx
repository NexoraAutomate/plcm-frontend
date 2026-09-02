'use client';

import { useCallback, useEffect, useState } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { PageRefreshButton } from '@/components/page-data-refresh';
import { cn } from '@/lib/utils';

const STORAGE_KEY = 'list-stats-visible';

export function useListStatsVisibility(defaultVisible = false) {
  const [showStats, setShowStatsState] = useState(defaultVisible);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'true') setShowStatsState(true);
    else if (stored === 'false') setShowStatsState(false);
  }, []);

  const setShowStats = useCallback((next: boolean) => {
    setShowStatsState(next);
    localStorage.setItem(STORAGE_KEY, String(next));
  }, []);

  return { showStats, setShowStats };
}

type ListStatsVisibilityControlsProps = {
  showStats: boolean;
  onShowStatsChange: (next: boolean) => void;
  onRefresh?: () => void | Promise<unknown>;
  className?: string;
};

/** Checkbox (left) + Refresh — place in the list page header actions. */
export function ListStatsVisibilityControls({
  showStats,
  onShowStatsChange,
  onRefresh,
  className,
}: ListStatsVisibilityControlsProps) {
  return (
    <div className={cn('flex flex-wrap items-center gap-3', className)}>
      <label
        htmlFor="list-stats-visible"
        className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground select-none"
      >
        <Checkbox
          id="list-stats-visible"
          checked={showStats}
          onCheckedChange={(value) => onShowStatsChange(value === true)}
          aria-label="View KPIs"
        />
        View KPIs
      </label>
      <PageRefreshButton onRefresh={onRefresh} />
    </div>
  );
}

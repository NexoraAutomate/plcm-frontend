'use client';

import { cn } from '@/lib/utils';

interface MmhdMaintenanceSummaryProps {
  replacedCount: number;
  onShowReplacedParts?: () => void;
  className?: string;
}

export function MmhdMaintenanceSummary({
  replacedCount,
  onShowReplacedParts,
  className,
}: MmhdMaintenanceSummaryProps) {
  const hasReplacements = replacedCount > 0;

  if (!hasReplacements) {
    return (
      <div
        className={cn(
          'nodrag nopan absolute top-3 right-3 z-20 rounded-md border border-emerald-500/50 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-800 shadow-sm dark:bg-emerald-950/80 dark:text-emerald-200',
          className
        )}
      >
        No maintenance/ replacement performed
      </div>
    );
  }

  const label =
    replacedCount === 1
      ? '1 part replaced — click to show all'
      : `${replacedCount} parts replaced — click to show all`;

  return (
    <button
      type="button"
      className={cn(
        'nodrag nopan absolute top-3 right-3 z-20 cursor-pointer rounded-md border border-orange-400/60 bg-orange-50 px-3 py-2 text-left text-xs font-medium text-orange-900 shadow-sm transition-colors hover:bg-orange-100 dark:bg-orange-950/80 dark:text-orange-100 dark:hover:bg-orange-900/80',
        className
      )}
      onClick={onShowReplacedParts}
      title="Expand hierarchy to show all replaced parts"
    >
      {label}
    </button>
  );
}

'use client';

import { Badge } from '@/components/ui/badge';
import { ItemStatus } from '@/lib/workflow-status';
import { cn } from '@/lib/utils';

/** RL-005 — Discarded chip for scrapped / never-reusable inventory S/N rows. */
export function isDiscardedInventoryStatus(status?: string | null): boolean {
  const key = (status || '').trim().toUpperCase();
  return key === ItemStatus.SCRAPPED || key === 'DISCARDED' || key === 'SCRAPPED';
}

export function DiscardedBadge({
  status,
  className,
  force,
}: {
  status?: string | null;
  className?: string;
  /** Show even when status string is absent (e.g. dual-track board flag). */
  force?: boolean;
}) {
  if (!force && !isDiscardedInventoryStatus(status)) return null;
  return (
    <Badge
      variant="outline"
      className={cn(
        'border-zinc-600 bg-zinc-800 text-[10px] font-semibold uppercase tracking-wide text-white',
        className
      )}
      title="Discarded — not selectable for reserve or issue"
    >
      Discarded
    </Badge>
  );
}

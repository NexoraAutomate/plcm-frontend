'use client';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface BulkActionsToolbarProps {
  selectedCount: number;
  isLoading?: boolean;
  onConfirmFaulty: () => void;
  onStartInspection: () => void;
  onNoFaultFound: () => void;
  onResolve: () => void;
}

export function BulkActionsToolbar({
  selectedCount,
  isLoading = false,
  onConfirmFaulty,
  onStartInspection,
  onNoFaultFound,
  onResolve,
}: BulkActionsToolbarProps) {
  if (selectedCount === 0) {
    return null;
  }

  return (
    <div
      className={cn(
        'sticky bottom-0 z-20 border-t border-border bg-background/95 px-4 py-3 backdrop-blur-md shadow-sm',
        isLoading && 'opacity-80'
      )}
    >
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <p className="text-sm text-muted-foreground">
          {selectedCount} selected for investigation actions
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" size="sm" onClick={onStartInspection} disabled={isLoading}>
            Start Inspection
          </Button>
          <Button variant="secondary" size="sm" onClick={onConfirmFaulty} disabled={isLoading}>
            Confirm Fault
          </Button>
          <Button variant="secondary" size="sm" onClick={onNoFaultFound} disabled={isLoading}>
            No Fault Found
          </Button>
          <Button variant="secondary" size="sm" onClick={onResolve} disabled={isLoading}>
            Resolve Selected
          </Button>
        </div>
      </div>
    </div>
  );
}

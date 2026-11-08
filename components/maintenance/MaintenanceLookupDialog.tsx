'use client';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import {
  MaintenanceLookupPanel,
  type MaintenanceLookupPanelProps,
} from './maintenance-lookup-panel';

interface MaintenanceLookupDialogProps extends MaintenanceLookupPanelProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MaintenanceLookupDialog({
  isOpen,
  onOpenChange,
  lookupResponse,
  lookupLoading,
  ...panelProps
}: MaintenanceLookupDialogProps) {
  const canClear =
    Boolean(panelProps.serialNumber.trim()) ||
    Boolean(lookupResponse) ||
    Boolean(panelProps.lookupError) ||
    Boolean(panelProps.caseId);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          'flex max-h-[92vh] w-[calc(100vw-1.5rem)] max-w-[calc(100vw-1.5rem)] flex-col gap-0 overflow-hidden rounded-2xl border-border/80 p-0 shadow-2xl sm:max-w-6xl lg:max-w-7xl'
        )}
      >
        <DialogHeader className="border-b border-border/70 px-5 py-3">
          <DialogTitle className="text-base tracking-tight">
            Maintenance Entity Lookup
          </DialogTitle>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-auto p-4">
          <MaintenanceLookupPanel
            {...panelProps}
            lookupResponse={lookupResponse}
            lookupLoading={lookupLoading}
            active={isOpen}
          />
        </div>

        <DialogFooter className="border-t border-border/70 px-5 py-2.5">
          <Button
            variant="outline"
            size="sm"
            disabled={lookupLoading || !canClear}
            onClick={panelProps.onClearLookup}
          >
            Clear
          </Button>
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { EntityLookupTree } from './EntityLookupTree';
import {
  MaintenanceEntityStockDetailDialog,
  type MaintenanceEntityStockSelection,
} from './maintenance-entity-stock-detail-dialog';
import type { EntityLookupNode, lookUpResponse } from '@/lib/models';

interface MaintenanceCaseHierarchyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  caseNumber?: string | null;
  serialNumber?: string | null;
  lookupResponse: lookUpResponse | null;
  loading?: boolean;
  error?: string | null;
  caseId?: number | null;
}

export function MaintenanceCaseHierarchyDialog({
  open,
  onOpenChange,
  caseNumber,
  serialNumber,
  lookupResponse,
  loading = false,
  error = null,
  caseId = null,
}: MaintenanceCaseHierarchyDialogProps) {
  const [stockDetailOpen, setStockDetailOpen] = useState(false);
  const [stockSelection, setStockSelection] =
    useState<MaintenanceEntityStockSelection | null>(null);

  const handleViewEntity = (node: EntityLookupNode) => {
    setStockSelection({
      entityType: node.entity_type,
      entityId: node.entity_id,
      label: node.label || node.entity_name,
      partNumber: node.entity_PartNumber,
      serialNumber: node.entity_SerialNumber,
    });
    setStockDetailOpen(true);
  };

  const title = caseNumber
    ? `Hierarchy · Case ${caseNumber}`
    : 'Entity Hierarchy';

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="flex max-h-[92vh] w-[calc(100vw-1.5rem)] max-w-[calc(100vw-1.5rem)] flex-col gap-0 overflow-hidden rounded-2xl border-border/80 p-0 shadow-2xl sm:max-w-6xl lg:max-w-7xl">
          <DialogHeader className="border-b border-border/70 px-5 py-3">
            <DialogTitle className="text-base tracking-tight">{title}</DialogTitle>
            {serialNumber ? (
              <p className="text-sm text-muted-foreground">
                Serial number {serialNumber}
              </p>
            ) : null}
          </DialogHeader>

          <div className="min-h-[360px] flex-1 overflow-auto bg-background p-3 sm:p-4">
            {loading ? (
              <div className="flex h-full min-h-[280px] items-center justify-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading hierarchy…
              </div>
            ) : error ? (
              <div className="flex h-full min-h-[280px] items-center justify-center rounded-xl border border-dashed border-destructive/40 bg-destructive/5 p-6 text-center text-sm text-destructive">
                {error}
              </div>
            ) : lookupResponse ? (
              <EntityLookupTree
                response={lookupResponse}
                caseId={caseId}
                onViewEntity={handleViewEntity}
              />
            ) : (
              <div className="flex h-full min-h-[280px] items-center justify-center rounded-xl border border-dashed border-border/80 bg-muted/20 p-6 text-center text-sm text-muted-foreground">
                Hierarchy results appear here once the serial number is resolved.
              </div>
            )}
          </div>

          <DialogFooter className="border-t border-border/70 px-5 py-2.5">
            <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <MaintenanceEntityStockDetailDialog
        open={stockDetailOpen}
        onOpenChange={setStockDetailOpen}
        selection={stockSelection}
      />
    </>
  );
}

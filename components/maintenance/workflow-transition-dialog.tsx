'use client';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  getCaseStatusMeta,
  getFaultyEntityStatusMeta,
  type MaintenanceCaseWorkflowStatus,
  type FaultyEntityWorkflowStatus,
} from '@/lib/maintenance-workflow';

interface WorkflowTransitionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  message: string;
  suggestedCaseStatus?: MaintenanceCaseWorkflowStatus;
  suggestedEntityStatus?: FaultyEntityWorkflowStatus;
  onConfirm: () => void | Promise<void>;
  onCancel?: () => void;
  isLoading?: boolean;
}

export function WorkflowTransitionDialog({
  open,
  onOpenChange,
  title = 'Confirm Status Change',
  message,
  suggestedCaseStatus,
  suggestedEntityStatus,
  onConfirm,
  onCancel,
  isLoading = false,
}: WorkflowTransitionDialogProps) {
  const caseLabel = suggestedCaseStatus
    ? getCaseStatusMeta(suggestedCaseStatus).label
    : undefined;
  const entityLabel = suggestedEntityStatus
    ? getFaultyEntityStatusMeta(suggestedEntityStatus).label
    : undefined;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {message || 'Confirm the suggested workflow status change.'}
          </DialogDescription>
        </DialogHeader>

        {(caseLabel || entityLabel) && (
          <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm space-y-1">
            {caseLabel && (
              <p>
                <span className="text-muted-foreground">Case status: </span>
                <span className="font-medium">{caseLabel}</span>
              </p>
            )}
            {entityLabel && (
              <p>
                <span className="text-muted-foreground">Entity status: </span>
                <span className="font-medium">{entityLabel}</span>
              </p>
            )}
          </div>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              onCancel?.();
              onOpenChange(false);
            }}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            onClick={async () => {
              await onConfirm();
              onOpenChange(false);
            }}
            disabled={isLoading}
          >
            Proceed
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

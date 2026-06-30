'use client';

import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  CASE_WORKFLOW_ORDER,
  CASE_STATUS_META,
  type MaintenanceCaseWorkflowStatus,
} from '@/lib/maintenance-workflow';

interface CaseProgressStepperProps {
  displayStatus: MaintenanceCaseWorkflowStatus;
  className?: string;
}

export function CaseProgressStepper({ displayStatus, className }: CaseProgressStepperProps) {
  const currentIndex = CASE_WORKFLOW_ORDER.indexOf(displayStatus);

  return (
    <ol className={cn('space-y-0', className)}>
      {CASE_WORKFLOW_ORDER.map((step, index) => {
        const meta = CASE_STATUS_META[step];
        const isCompleted = index < currentIndex;
        const isCurrent = index === currentIndex;
        const isFuture = index > currentIndex;
        const Icon = meta.icon;

        return (
          <li key={step} className="flex gap-3">
            <div className="flex flex-col items-center">
              <div
                className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-full border-2',
                  isCompleted && 'border-emerald-500 bg-emerald-50 text-emerald-600 dark:bg-emerald-950',
                  isCurrent && 'border-primary bg-primary/10 text-primary',
                  isFuture && 'border-muted bg-muted/40 text-muted-foreground'
                )}
              >
                {isCompleted ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <Icon className="h-4 w-4" />
                )}
              </div>
              {index < CASE_WORKFLOW_ORDER.length - 1 && (
                <div
                  className={cn(
                    'my-1 h-6 w-0.5',
                    isCompleted ? 'bg-emerald-500' : 'bg-border'
                  )}
                />
              )}
            </div>
            <div className={cn('pb-4 pt-1', isFuture && 'opacity-50')}>
              <p
                className={cn(
                  'text-sm font-medium',
                  isCurrent && 'text-foreground',
                  isCompleted && 'text-emerald-700 dark:text-emerald-400',
                  isFuture && 'text-muted-foreground'
                )}
              >
                {meta.label}
              </p>
              {isCurrent && (
                <p className="mt-0.5 text-xs text-muted-foreground">{meta.tooltip}</p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

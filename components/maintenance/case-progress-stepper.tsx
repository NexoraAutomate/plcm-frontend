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
    <ol
      className={cn(
        'flex w-full items-start justify-between gap-1 overflow-visible px-2 py-3',
        className
      )}
    >
      {CASE_WORKFLOW_ORDER.map((step, index) => {
        const meta = CASE_STATUS_META[step];
        const isCompleted = index < currentIndex;
        const isCurrent = index === currentIndex;
        const isFuture = index > currentIndex;
        const Icon = meta.icon;

        return (
          <li
            key={step}
            className="relative flex min-w-0 flex-1 flex-col items-center overflow-visible text-center"
          >
            {index < CASE_WORKFLOW_ORDER.length - 1 ? (
              <div
                className={cn(
                  'absolute left-[calc(50%+18px)] right-[calc(-50%+18px)] top-[22px] h-0.5',
                  isCompleted ? 'bg-emerald-500' : 'bg-border'
                )}
                aria-hidden
              />
            ) : null}

            {/* Larger hit box so animate-ping (scale 2) is not clipped */}
            <div className="relative z-10 flex h-11 w-11 items-center justify-center overflow-visible">
              {isCurrent ? (
                <span
                  className="absolute h-8 w-8 animate-ping rounded-full bg-primary/45 [animation-duration:1.25s]"
                  aria-hidden
                />
              ) : null}
              <div
                className={cn(
                  'relative flex h-8 w-8 items-center justify-center rounded-full border-2 bg-background',
                  isCompleted &&
                    'border-emerald-500 bg-emerald-50 text-emerald-600 dark:bg-emerald-950',
                  isCurrent && 'border-primary bg-primary/15 text-primary',
                  isFuture && 'border-muted bg-muted/40 text-muted-foreground'
                )}
              >
                {isCompleted ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
              </div>
            </div>

            <div className={cn('mt-1.5 px-1', isFuture && 'opacity-50')}>
              <p
                className={cn(
                  'text-[11px] font-medium leading-tight sm:text-xs',
                  isCurrent && 'text-foreground',
                  isCompleted && 'text-emerald-700 dark:text-emerald-400',
                  isFuture && 'text-muted-foreground'
                )}
              >
                {meta.label}
              </p>
              {isCurrent ? (
                <p className="mt-0.5 hidden text-[10px] text-muted-foreground sm:block">
                  {meta.tooltip}
                </p>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

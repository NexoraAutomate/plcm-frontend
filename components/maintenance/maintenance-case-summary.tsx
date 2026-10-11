'use client';

import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { MaintenanceCaseStatusBadge } from './badges';
import type { MaintenanceCase, MaintenanceAction, FaultyEntity } from '@/lib/models';
import { formatUserRef } from '@/lib/user-display';
import { FaultyEntityWorkflowStatus } from '@/lib/maintenance-workflow';

export interface EntityWorkflowCounts {
  total: number;
  identified: number;
  under_inspection: number;
  confirmed_faulty: number;
  under_repair: number;
  repaired: number;
  replaced: number;
  no_fault_found: number;
}

interface MaintenanceCaseSummaryProps {
  maintenanceCase: MaintenanceCase;
  entities?: FaultyEntity[];
  actions?: MaintenanceAction[];
  projectName?: string;
  counts: EntityWorkflowCounts;
}

const STATUS_METRICS: Array<{
  key: keyof EntityWorkflowCounts;
  label: string;
  tone: string;
}> = [
  { key: 'identified', label: 'Identified', tone: 'bg-sky-500/15 text-sky-700 dark:text-sky-300' },
  {
    key: 'under_inspection',
    label: 'Under inspection',
    tone: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
  },
  {
    key: 'confirmed_faulty',
    label: 'Confirmed faulty',
    tone: 'bg-red-500/15 text-red-700 dark:text-red-300',
  },
  {
    key: 'under_repair',
    label: 'Under repair',
    tone: 'bg-violet-500/15 text-violet-700 dark:text-violet-300',
  },
  { key: 'repaired', label: 'Repaired', tone: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300' },
  { key: 'replaced', label: 'Replaced', tone: 'bg-slate-500/15 text-slate-700 dark:text-slate-300' },
  {
    key: 'no_fault_found',
    label: 'No fault found',
    tone: 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300',
  },
];

export function MaintenanceCaseSummary({
  maintenanceCase,
  entities = [],
  actions = [],
  projectName,
  counts,
}: MaintenanceCaseSummaryProps) {
  const activeStatuses = STATUS_METRICS.filter((metric) => counts[metric.key] > 0);
  const projectLabel = projectName || maintenanceCase.project_name || '—';
  const reporterLabel = formatUserRef(maintenanceCase.reported_by_user) || '—';
  const resolvedLabel = maintenanceCase.resolved_at
    ? new Date(maintenanceCase.resolved_at).toLocaleDateString()
    : 'Pending';
  const notesLabel = maintenanceCase.resolution_notes?.trim() || 'No notes yet';

  return (
    <div className="space-y-3">
      <Card className="p-3 sm:p-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-lg font-semibold tracking-tight">{maintenanceCase.case_number}</h1>
              <MaintenanceCaseStatusBadge
                maintenanceCase={maintenanceCase}
                entities={entities}
                actions={actions}
                className="rounded-full px-2 py-0.5 text-[11px]"
              />
            </div>
            <p className="text-sm text-muted-foreground">{maintenanceCase.description}</p>
          </div>
          <p className="text-xs text-muted-foreground whitespace-nowrap">
            Reported {new Date(maintenanceCase.reported_at).toLocaleDateString()}
          </p>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border/70 pt-2 text-xs text-muted-foreground">
          <p>
            <span className="font-medium text-foreground/80">Project</span>{' '}
            <span className="text-foreground">{projectLabel}</span>
          </p>
          <p>
            <span className="font-medium text-foreground/80">Reported by</span>{' '}
            <span className="text-foreground">{reporterLabel}</span>
          </p>
          <p>
            <span className="font-medium text-foreground/80">Resolved</span>{' '}
            <span className="text-foreground">{resolvedLabel}</span>
          </p>
          <p className="min-w-0 flex-1 basis-full sm:basis-auto">
            <span className="font-medium text-foreground/80">Notes</span>{' '}
            <span className="text-foreground/90">{notesLabel}</span>
          </p>
        </div>
      </Card>

      <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-border/80 bg-card px-2.5 py-2">
        <div className="flex items-center gap-1.5 rounded-md bg-primary/10 px-2 py-1 text-primary">
          <span className="text-[11px] font-medium uppercase tracking-wide">Entities</span>
          <span className="text-sm font-semibold tabular-nums">{counts.total}</span>
        </div>

        {activeStatuses.length === 0 ? (
          <p className="text-xs text-muted-foreground">No workflow activity yet</p>
        ) : (
          activeStatuses.map((metric) => (
            <div
              key={metric.key}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-md px-2 py-1',
                metric.tone
              )}
            >
              <span className="text-[11px] font-medium">{metric.label}</span>
              <span className="text-sm font-semibold tabular-nums">{counts[metric.key]}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export { FaultyEntityWorkflowStatus };

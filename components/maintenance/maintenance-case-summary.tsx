'use client';

import { useMemo, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { MaintenanceCaseStatusBadge } from './badges';
import { CaseStatus, type MaintenanceCase, type MaintenanceAction, type FaultyEntity } from '@/lib/models';
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
}

const STATUS_METRICS: Array<{
  key: keyof EntityWorkflowCounts;
  label: string;
  tone: string;
}> = [
  { key: 'identified', label: 'Identified', tone: 'text-sky-700 dark:text-sky-300' },
  {
    key: 'under_inspection',
    label: 'Under inspection',
    tone: 'text-amber-700 dark:text-amber-300',
  },
  {
    key: 'confirmed_faulty',
    label: 'Confirmed faulty',
    tone: 'text-red-700 dark:text-red-300',
  },
  {
    key: 'under_repair',
    label: 'Under repair',
    tone: 'text-violet-700 dark:text-violet-300',
  },
  {
    key: 'repaired',
    label: 'Repaired',
    tone: 'text-emerald-700 dark:text-emerald-300',
  },
  {
    key: 'replaced',
    label: 'Replaced',
    tone: 'text-slate-700 dark:text-slate-300',
  },
  {
    key: 'no_fault_found',
    label: 'No fault found',
    tone: 'text-indigo-700 dark:text-indigo-300',
  },
];

function MetaField({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className={cn('min-w-0', className)}>
      <dt className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/80">
        {label}
      </dt>
      <dd className="mt-0.5 truncate text-sm font-medium text-foreground">{value}</dd>
    </div>
  );
}

export function EntityWorkflowMetrics({ counts }: { counts: EntityWorkflowCounts }) {
  const activeStatuses = STATUS_METRICS.filter((metric) => counts[metric.key] > 0);

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm">
      <div className="inline-flex items-baseline gap-1.5 text-foreground">
        <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          Entities
        </span>
        <span className="font-semibold tabular-nums">{counts.total}</span>
      </div>

      {activeStatuses.length === 0 ? (
        <span className="text-xs text-muted-foreground">No workflow activity yet</span>
      ) : (
        activeStatuses.map((metric) => (
          <div
            key={metric.key}
            className={cn('inline-flex items-baseline gap-1.5', metric.tone)}
          >
            <span className="text-[11px] font-medium text-muted-foreground">{metric.label}</span>
            <span className="font-semibold tabular-nums">{counts[metric.key]}</span>
          </div>
        ))
      )}
    </div>
  );
}

export function MaintenanceCaseSummary({
  maintenanceCase,
  entities = [],
  actions = [],
  projectName,
}: MaintenanceCaseSummaryProps) {
  const [showKpis, setShowKpis] = useState(false);

  const projectLabel = projectName || maintenanceCase.project_name || '—';
  const reporterLabel = formatUserRef(maintenanceCase.reported_by_user) || '—';
  const isCaseResolved =
    maintenanceCase.status === CaseStatus.Resolved ||
    maintenanceCase.status === CaseStatus.Closed;
  const resolvedLabel =
    isCaseResolved && maintenanceCase.resolved_at
      ? new Date(maintenanceCase.resolved_at).toLocaleDateString()
      : 'Pending';
  const notesLabel = maintenanceCase.resolution_notes?.trim() || 'No notes yet';
  const reportedLabel = new Date(maintenanceCase.reported_at).toLocaleDateString();

  const entityLabel = useMemo(() => {
    const named = entities.find((entity) => entity.entity_name?.trim());
    if (named?.entity_name?.trim()) return named.entity_name.trim();
    if (maintenanceCase.part_number?.trim()) return maintenanceCase.part_number.trim();
    return null;
  }, [entities, maintenanceCase.part_number]);

  return (
    <Collapsible open={showKpis} onOpenChange={setShowKpis}>
      <Card className="overflow-hidden border-border/80 shadow-sm">
        <div
          className={cn(
            'flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 sm:px-5',
            showKpis && 'border-b border-border/60 bg-muted/30'
          )}
        >
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2.5 gap-y-1.5">
            <h1 className="text-lg font-semibold tracking-tight text-foreground sm:text-xl">
              {maintenanceCase.case_number}
            </h1>
            <MaintenanceCaseStatusBadge
              maintenanceCase={maintenanceCase}
              entities={entities}
              actions={actions}
              className="rounded-full px-2.5 py-0.5 text-[11px] font-medium"
            />
            <span className="hidden text-muted-foreground/40 sm:inline" aria-hidden>
              ·
            </span>
            <p className="min-w-0 truncate text-sm text-muted-foreground">
              <span className="font-medium text-foreground/85">{projectLabel}</span>
              {entityLabel ? (
                <>
                  <span className="mx-1.5 text-muted-foreground/40">·</span>
                  <span>{entityLabel}</span>
                </>
              ) : null}
            </p>
          </div>

          <CollapsibleTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="shrink-0 text-muted-foreground"
              aria-label={showKpis ? 'Hide case details' : 'Show case details'}
            >
              {showKpis ? 'Hide details' : 'Details'}
              <ChevronDown
                className={cn(
                  'h-4 w-4 transition-transform duration-200',
                  showKpis && 'rotate-180'
                )}
              />
            </Button>
          </CollapsibleTrigger>
        </div>

        <CollapsibleContent>
          <div className="space-y-0">
            <div className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-start sm:justify-between sm:px-5 sm:py-3.5">
              <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">
                {maintenanceCase.description}
              </p>
              <div className="shrink-0 rounded-md border border-border/70 bg-muted/20 px-3 py-2 text-right">
                <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/80">
                  Reported
                </p>
                <p className="mt-0.5 text-sm font-medium tabular-nums text-foreground">
                  {reportedLabel}
                </p>
              </div>
            </div>

            <dl className="grid grid-cols-1 gap-x-6 gap-y-3 border-t border-border/60 px-4 py-3.5 sm:grid-cols-2 sm:px-5 lg:grid-cols-4">
              <MetaField label="Project" value={projectLabel} />
              <MetaField label="Reported by" value={reporterLabel} />
              <MetaField label="Resolved" value={resolvedLabel} />
              <MetaField
                label="Notes"
                value={notesLabel}
                className="sm:col-span-2 lg:col-span-1"
              />
            </dl>
          </div>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

export { FaultyEntityWorkflowStatus };

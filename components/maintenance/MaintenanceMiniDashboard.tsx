'use client';

import { cn } from '@/lib/utils';
import type { MaintenanceCase } from '@/lib/models';
import { CASE_STATUS_META, mapCaseStatusFromApi } from '@/lib/maintenance-workflow';
import type { MaintenanceCaseStatusCounts } from '@/hooks/use-maintenance-case-status-counts';

interface MaintenanceMiniDashboardProps {
  cases?: MaintenanceCase[];
  counts?: MaintenanceCaseStatusCounts | null;
  onStatusFilter?: (status: string) => void;
  activeStatus?: string;
}

const FILTER_STATUSES = [
  'open',
  'under_inspection',
  'under_repair',
  'resolved',
  'closed',
] as const;

const STATUS_TONES: Record<(typeof FILTER_STATUSES)[number], string> = {
  open: 'bg-sky-500/15 text-sky-700 hover:bg-sky-500/25 dark:text-sky-300',
  under_inspection: 'bg-amber-500/15 text-amber-700 hover:bg-amber-500/25 dark:text-amber-300',
  under_repair: 'bg-orange-500/15 text-orange-700 hover:bg-orange-500/25 dark:text-orange-300',
  resolved: 'bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/25 dark:text-emerald-300',
  closed: 'bg-slate-500/15 text-slate-700 hover:bg-slate-500/25 dark:text-slate-300',
};

export function MaintenanceMiniDashboard({
  cases = [],
  counts,
  onStatusFilter,
  activeStatus = 'all',
}: MaintenanceMiniDashboardProps) {
  const totalCount = counts?.total ?? cases.length;

  const statusItems = FILTER_STATUSES.map((apiStatus) => {
    const display = mapCaseStatusFromApi(apiStatus);
    const meta = CASE_STATUS_META[display];
    return {
      status: apiStatus,
      label: meta.label,
      count:
        counts?.byStatus[apiStatus] ??
        cases.filter((c) => c.status === apiStatus).length,
      tone: STATUS_TONES[apiStatus],
    };
  }).filter((item) => item.count > 0);

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border/80 bg-card px-3 py-2.5">
      <button
        type="button"
        onClick={() => onStatusFilter?.('all')}
        className={cn(
          'inline-flex items-center gap-2 rounded-md px-2.5 py-1.5 transition-colors',
          activeStatus === 'all'
            ? 'bg-primary text-primary-foreground'
            : 'bg-primary/10 text-primary hover:bg-primary/15'
        )}
      >
        <span className="text-[11px] font-medium uppercase tracking-wide">Cases</span>
        <span className="text-sm font-semibold tabular-nums">{totalCount}</span>
      </button>

      {statusItems.length === 0 ? (
        <p className="text-xs text-muted-foreground">No cases yet</p>
      ) : (
        statusItems.map((item) => {
          const selected = activeStatus === item.status;
          return (
            <button
              key={item.status}
              type="button"
              onClick={() => onStatusFilter?.(item.status)}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 transition-colors',
                item.tone,
                selected && 'ring-2 ring-offset-1 ring-offset-background ring-current/40'
              )}
            >
              <span className="text-[11px] font-medium">{item.label}</span>
              <span className="text-sm font-semibold tabular-nums">{item.count}</span>
            </button>
          );
        })
      )}
    </div>
  );
}

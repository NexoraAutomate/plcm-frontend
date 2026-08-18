'use client';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { CalendarDays, ExternalLink, RefreshCw } from 'lucide-react';
import { DashboardCard } from './DashboardCard';
import type { ExecFilterOption, ExecFiltersState, ExecInsight } from './types';
import { useAppDefinitions } from '@/lib/app-definitions-context';

interface FiltersPanelProps {
  filters: ExecFiltersState;
  customers: ExecFilterOption[];
  programs: ExecFilterOption[];
  projects: ExecFilterOption[];
  onChange: (patch: Partial<ExecFiltersState>) => void;
  lastUpdated?: string | null;
  fetching?: boolean;
  onRefresh?: () => void;
  className?: string;
  insight?: ExecInsight;
}

const DATE_RANGE_OPTIONS: ExecFilterOption[] = [
  { value: '30d', label: 'Last 30 days' },
  { value: '90d', label: 'Last 90 days' },
  { value: 'ytd', label: 'Year to date' },
  { value: '12m', label: 'Last 12 months' },
];

function formatDateRangeLabel(value?: string): string {
  const now = new Date();
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  let start = new Date(end);
  if (value === '90d') start.setUTCDate(start.getUTCDate() - 89);
  else if (value === 'ytd') start = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
  else if (value === '12m') start.setUTCFullYear(start.getUTCFullYear() - 1);
  else start.setUTCDate(start.getUTCDate() - 29);

  const fmt = (d: Date) =>
    d.toLocaleDateString(undefined, { month: 'short', day: '2-digit', year: 'numeric' });
  return `${fmt(start)} - ${fmt(end)}`;
}

function FilterSelect({
  label,
  value,
  options,
  displayValue,
  onValueChange,
}: {
  label: string;
  value?: string;
  options: ExecFilterOption[];
  displayValue?: string;
  onValueChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1">
      <p className="text-[10px] font-medium tracking-wide text-white/75">{label}</p>
      <Select value={value ?? 'all'} onValueChange={onValueChange}>
        <SelectTrigger
          size="sm"
          className="h-8 w-full border-white/25 bg-black/25 text-[11px] text-white hover:bg-black/35"
        >
          {displayValue ? (
            <span className="truncate">{displayValue}</span>
          ) : (
            <SelectValue placeholder={`All ${label}`} />
          )}
        </SelectTrigger>
        <SelectContent className="border-[#242424] bg-[#141414] text-[#F5F5F5]">
          <SelectItem value="all">All {label}</SelectItem>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export function FiltersPanel({
  filters,
  customers,
  programs,
  projects,
  onChange,
  lastUpdated,
  fetching,
  onRefresh,
  className,
  insight,
}: FiltersPanelProps) {
  const { entityLabel } = useAppDefinitions();
  return (
    <div className={`flex h-full min-h-0 flex-col gap-2 ${className ?? ''}`}>
      <DashboardCard
        gradient
        className="min-h-0 flex-1"
        title="Filters"
        noPadding
        square
        insight={insight}
        headerRight={<ExternalLink className="h-3.5 w-3.5 text-white/80" aria-hidden />}
      >
        <div className="space-y-2 px-3 pb-3">
          <FilterSelect
            label="Customer"
            value={filters.customerId}
            options={customers}
            onValueChange={(v) => onChange({ customerId: v === 'all' ? undefined : v })}
          />
          <FilterSelect
            label="Program"
            value={filters.programId}
            options={programs}
            onValueChange={(v) => onChange({ programId: v === 'all' ? undefined : v })}
          />
          <FilterSelect
            label={entityLabel('project')}
            value={filters.projectId}
            options={projects}
            onValueChange={(v) => onChange({ projectId: v === 'all' ? undefined : v })}
          />
          <FilterSelect
            label="Date Range"
            value={filters.dateRange ?? '12m'}
            options={DATE_RANGE_OPTIONS}
            displayValue={formatDateRangeLabel(filters.dateRange ?? '12m')}
            onValueChange={(v) => onChange({ dateRange: v === 'all' ? undefined : v })}
          />
        </div>
      </DashboardCard>

      <DashboardCard className="shrink-0" noPadding square>
        <div className="flex items-center justify-between gap-2 px-3 py-2.5">
          <div className="flex min-w-0 items-center gap-2.5">
            <CalendarDays className="h-4 w-4 shrink-0 text-[#A78BFA]" aria-hidden />
            <div className="min-w-0">
              <p className="text-[10px] font-medium text-[#9CA3AF]">Last Updated</p>
              <p className="mt-0.5 truncate text-[12px] font-medium text-[#F5F5F5]">
                {lastUpdated
                  ? new Date(lastUpdated).toLocaleString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                      hour: 'numeric',
                      minute: '2-digit',
                    })
                  : '—'}
              </p>
            </div>
          </div>
          {onRefresh ? (
            <button
              type="button"
              onClick={onRefresh}
              disabled={fetching}
              className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-[#242424] text-[#9CA3AF] transition hover:border-[#8B5CF6]/50 hover:text-[#F5F5F5] disabled:opacity-50"
              aria-label="Refresh dashboard"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${fetching ? 'animate-spin' : ''}`} />
            </button>
          ) : null}
        </div>
      </DashboardCard>
    </div>
  );
}

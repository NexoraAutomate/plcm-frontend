'use client';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { RefreshCw } from 'lucide-react';
import { DashboardCard } from './DashboardCard';
import type { ExecFilterOption, ExecFiltersState, ExecInsight } from './types';

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

function FilterSelect({
  label,
  value,
  options,
  onValueChange,
}: {
  label: string;
  value?: string;
  options: ExecFilterOption[];
  onValueChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1">
      <p className="text-[10px] font-medium uppercase tracking-wider text-white/70">{label}</p>
      <Select value={value ?? 'all'} onValueChange={onValueChange}>
        <SelectTrigger
          size="sm"
          className="h-7 w-full border-white/20 bg-black/20 text-[11px] text-white hover:bg-black/30"
        >
          <SelectValue placeholder={`All ${label}`} />
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
  return (
    <div className={`flex h-full min-h-0 flex-col gap-2 ${className ?? ''}`}>
      <DashboardCard
        gradient
        className="min-h-0 flex-1"
        title="Global Filters"
        noPadding
        insight={insight}
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
            label="Project"
            value={filters.projectId}
            options={projects}
            onValueChange={(v) => onChange({ projectId: v === 'all' ? undefined : v })}
          />
          <FilterSelect
            label="Date Range"
            value={filters.dateRange}
            options={[
              { value: '30d', label: 'Last 30 days' },
              { value: '90d', label: 'Last 90 days' },
              { value: 'ytd', label: 'Year to date' },
              { value: '12m', label: 'Last 12 months' },
            ]}
            onValueChange={(v) => onChange({ dateRange: v === 'all' ? undefined : v })}
          />
        </div>
      </DashboardCard>
      <DashboardCard className="shrink-0" noPadding>
        <div className="flex items-center justify-between gap-2 px-3 py-2">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-[#9CA3AF]">Last Updated</p>
            <p className="mt-0.5 text-[12px] font-medium text-[#F5F5F5]">
              {lastUpdated
                ? new Date(lastUpdated).toLocaleString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })
                : '—'}
            </p>
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

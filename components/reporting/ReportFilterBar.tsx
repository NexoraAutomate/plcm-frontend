'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

export interface FilterOption {
  value: string;
  label: string;
}

export interface ReportFilterBarProps {
  search?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  dateFrom?: string;
  dateTo?: string;
  onDateFromChange?: (value: string) => void;
  onDateToChange?: (value: string) => void;
  projectId?: string;
  onProjectChange?: (value: string) => void;
  projects?: FilterOption[];
  customerId?: string;
  onCustomerChange?: (value: string) => void;
  customers?: FilterOption[];
  status?: string;
  onStatusChange?: (value: string) => void;
  statuses?: FilterOption[];
  mode?: string;
  onModeChange?: (value: string) => void;
  modes?: FilterOption[];
  caseId?: string;
  onCaseChange?: (value: string) => void;
  cases?: FilterOption[];
  extra?: React.ReactNode;
  className?: string;
}

export function ReportFilterBar({
  search,
  onSearchChange,
  searchPlaceholder = 'Search…',
  dateFrom,
  dateTo,
  onDateFromChange,
  onDateToChange,
  projectId,
  onProjectChange,
  projects,
  customerId,
  onCustomerChange,
  customers,
  status,
  onStatusChange,
  statuses,
  mode,
  onModeChange,
  modes,
  caseId,
  onCaseChange,
  cases,
  extra,
  className,
}: ReportFilterBarProps) {
  return (
    <div
      className={cn(
        'grid gap-3 rounded-lg border border-border bg-card p-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4',
        className
      )}
    >
      {onSearchChange && (
        <div className="space-y-1.5">
          <Label htmlFor="report-search">Search</Label>
          <Input
            id="report-search"
            value={search ?? ''}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={searchPlaceholder}
          />
        </div>
      )}
      {onDateFromChange && (
        <div className="space-y-1.5">
          <Label htmlFor="report-date-from">Date From</Label>
          <Input
            id="report-date-from"
            type="date"
            value={dateFrom ?? ''}
            onChange={(e) => onDateFromChange(e.target.value)}
          />
        </div>
      )}
      {onDateToChange && (
        <div className="space-y-1.5">
          <Label htmlFor="report-date-to">Date To</Label>
          <Input
            id="report-date-to"
            type="date"
            value={dateTo ?? ''}
            onChange={(e) => onDateToChange(e.target.value)}
          />
        </div>
      )}
      {onCustomerChange && customers && (
        <div className="space-y-1.5">
          <Label>Customer</Label>
          <Select value={customerId || 'all'} onValueChange={onCustomerChange}>
            <SelectTrigger>
              <SelectValue placeholder="All customers" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All customers</SelectItem>
              {customers.map((c) => (
                <SelectItem key={c.value} value={c.value}>
                  {c.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      {onProjectChange && projects && (
        <div className="space-y-1.5">
          <Label>Project</Label>
          <Select value={projectId || 'all'} onValueChange={onProjectChange}>
            <SelectTrigger>
              <SelectValue placeholder="Select project" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Select project…</SelectItem>
              {projects.map((p) => (
                <SelectItem key={p.value} value={p.value}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      {onCaseChange && cases && (
        <div className="space-y-1.5">
          <Label>Maintenance Case</Label>
          <Select value={caseId || 'all'} onValueChange={onCaseChange}>
            <SelectTrigger>
              <SelectValue placeholder="Select case" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Select case…</SelectItem>
              {cases.map((c) => (
                <SelectItem key={c.value} value={c.value}>
                  {c.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      {onStatusChange && statuses && (
        <div className="space-y-1.5">
          <Label>Status</Label>
          <Select value={status || 'all'} onValueChange={onStatusChange}>
            <SelectTrigger>
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {statuses.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      {onModeChange && modes && (
        <div className="space-y-1.5">
          <Label>Report Mode</Label>
          <Select value={mode || modes[0]?.value} onValueChange={onModeChange}>
            <SelectTrigger>
              <SelectValue placeholder="Mode" />
            </SelectTrigger>
            <SelectContent>
              {modes.map((m) => (
                <SelectItem key={m.value} value={m.value}>
                  {m.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      {extra}
    </div>
  );
}

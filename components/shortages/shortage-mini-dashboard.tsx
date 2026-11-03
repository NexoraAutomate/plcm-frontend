'use client';

import { AlertTriangle, CheckCircle2, Clock3, Layers3, Plane, Radar } from 'lucide-react';
import type { ShortageDashboardStats } from '@/components/shortages/shortage-grouping';
import { cn } from '@/lib/utils';

type Props = {
  stats: ShortageDashboardStats;
  className?: string;
};

function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = 'default',
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon: typeof AlertTriangle;
  tone?: 'default' | 'warn' | 'ok' | 'muted';
}) {
  return (
    <div
      className={cn(
        'rounded-lg border px-3 py-2.5',
        tone === 'warn' && 'border-amber-500/30 bg-amber-500/5',
        tone === 'ok' && 'border-emerald-500/30 bg-emerald-500/5',
        tone === 'muted' && 'bg-muted/30',
        tone === 'default' && 'bg-background'
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            {label}
          </p>
          <p className="mt-1 text-xl font-semibold tracking-tight">{value}</p>
          {hint ? <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p> : null}
        </div>
        <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
      </div>
    </div>
  );
}

function ScopeList({
  title,
  rows,
  empty,
}: {
  title: string;
  rows: ShortageDashboardStats['flights'];
  empty: string;
}) {
  return (
    <div className="rounded-lg border bg-muted/20 p-3">
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </p>
      {rows.length === 0 ? (
        <p className="text-xs text-muted-foreground">{empty}</p>
      ) : (
        <ul className="space-y-1.5">
          {rows.map((row) => (
            <li
              key={row.key}
              className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 text-xs"
            >
              <span className="min-w-0 truncate font-medium">
                {row.parentLabel ? (
                  <span className="text-muted-foreground">{row.parentLabel} / </span>
                ) : null}
                {row.label}
              </span>
              <span className="shrink-0 text-muted-foreground">
                pending {row.pendingQty}
                {row.fulfilledQty > 0 ? ` · fulfilled ${row.fulfilledQty}` : ''}
                {row.oldestPendingDays != null && row.pendingQty > 0
                  ? ` · ${row.oldestPendingDays}d overdue`
                  : ''}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function ShortageMiniDashboard({ stats, className }: Props) {
  return (
    <div className={cn('space-y-3', className)}>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Pending qty"
          value={stats.pendingQty}
          hint={`${stats.openCount + stats.partialCount} open rows · ${stats.itemCount} items`}
          icon={AlertTriangle}
          tone={stats.pendingQty > 0 ? 'warn' : 'ok'}
        />
        <StatCard
          label="Fulfilled qty"
          value={stats.fulfilledQty}
          hint={`${stats.fulfilledCount} closed shortage${stats.fulfilledCount === 1 ? '' : 's'}`}
          icon={CheckCircle2}
          tone="ok"
        />
        <StatCard
          label="Flights / SDLS short"
          value={`${stats.flightCount} / ${stats.sdlsCount}`}
          hint="Scopes still waiting for stock"
          icon={Plane}
        />
        <StatCard
          label="Oldest overdue"
          value={stats.oldestPendingDays == null ? '—' : `${stats.oldestPendingDays}d`}
          hint="Days since earliest open report"
          icon={Clock3}
          tone={
            stats.oldestPendingDays != null && stats.oldestPendingDays >= 3 ? 'warn' : 'muted'
          }
        />
      </div>
      <div className="grid gap-2 lg:grid-cols-2">
        <ScopeList
          title="Flight shortages"
          rows={stats.flights.filter((row) => row.pendingQty > 0 || row.fulfilledQty > 0)}
          empty="No flight shortage activity yet."
        />
        <ScopeList
          title="SDLS shortages"
          rows={stats.sdls.filter((row) => row.pendingQty > 0 || row.fulfilledQty > 0)}
          empty="No SDLS shortage activity yet."
        />
      </div>
      {stats.partialCount > 0 || stats.cancelledCount > 0 ? (
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Layers3 className="h-3.5 w-3.5" />
            Partial {stats.partialCount}
          </span>
          <span className="inline-flex items-center gap-1">
            <Radar className="h-3.5 w-3.5" />
            Cancelled {stats.cancelledCount}
          </span>
        </p>
      ) : null}
    </div>
  );
}

'use client';

import {
  AlertTriangle,
  ClipboardList,
  Package,
  PackageCheck,
  PackageMinus,
  PackageX,
  SearchCheck,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { InventoryStatsSummary } from '@/lib/models';

type InventoryKpiDashboardProps = {
  stats?: InventoryStatsSummary | null;
  loading?: boolean;
};

function formatTopNames(names: string[] | undefined): string | undefined {
  if (!names?.length) return undefined;
  return names.join(', ');
}

function KpiTile({
  label,
  value,
  sub,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: LucideIcon;
}) {
  return (
    <div className="rounded-xl border bg-card p-4 text-left shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {label}
          </p>
          <p className="mt-1 text-2xl font-bold tabular-nums">{value}</p>
          {sub ? (
            <p className="mt-1 text-xs text-muted-foreground line-clamp-2" title={sub}>
              {sub}
            </p>
          ) : null}
        </div>
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
          <Icon className="h-5 w-5 text-primary" />
        </div>
      </div>
    </div>
  );
}

function LoadingTile() {
  return (
    <div className={cn('rounded-xl border bg-card p-4 shadow-sm animate-pulse')}>
      <div className="h-4 w-24 rounded bg-muted" />
      <div className="mt-3 h-8 w-16 rounded bg-muted" />
    </div>
  );
}

export function InventoryKpiDashboard({ stats, loading = false }: InventoryKpiDashboardProps) {
  if (loading && !stats) {
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 7 }).map((_, index) => (
          <LoadingTile key={index} />
        ))}
      </div>
    );
  }

  const data = stats ?? {
    total_catalog_items: 0,
    available_units: 0,
    reserved_issued_open_units: 0,
    out_of_stock_catalog_items: 0,
    out_of_stock_top_names: [],
    open_shortages: 0,
    open_shortage_top_names: [],
    pending_issue_requests: 0,
    return_pending_inspect: 0,
  };

  const outOfStockNames = formatTopNames(data.out_of_stock_top_names);
  const shortageNames = formatTopNames(data.open_shortage_top_names);

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <KpiTile label="Total catalog items" value={data.total_catalog_items} icon={Package} />
      <KpiTile label="Available units" value={data.available_units} icon={PackageCheck} />
      <KpiTile
        label="Reserved / issued (open)"
        value={data.reserved_issued_open_units}
        icon={PackageMinus}
      />
      <KpiTile
        label="Out of stock"
        value={data.out_of_stock_catalog_items}
        sub={outOfStockNames ? `Top: ${outOfStockNames}` : undefined}
        icon={PackageX}
      />
      <KpiTile
        label="Open shortages"
        value={data.open_shortages}
        sub={shortageNames ? `Top: ${shortageNames}` : undefined}
        icon={AlertTriangle}
      />
      <KpiTile
        label="Pending issue requests"
        value={data.pending_issue_requests}
        icon={ClipboardList}
      />
      <KpiTile
        label="Return pending / inspect"
        value={data.return_pending_inspect}
        icon={SearchCheck}
      />
    </div>
  );
}

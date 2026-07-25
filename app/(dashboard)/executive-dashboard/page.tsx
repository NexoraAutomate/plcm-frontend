'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Inter } from 'next/font/google';
import { Loader2 } from 'lucide-react';
import {
  useCustomersQuery,
  useOrdersQuery,
  useProjectsQuery,
} from '@/hooks/queries';
import { LIST_BOOTSTRAP_SIZE } from '@/lib/data-loading';
import { useExecutiveDashboard } from '@/hooks/use-executive-dashboard';
import { buildCommandCenterViewModel } from '@/lib/executive-command-center';
import { ExecutiveCommandGrid } from '@/components/dashboard/executive';
import type { ExecFiltersState } from '@/components/dashboard/executive';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-exec-inter',
  display: 'swap',
});

function dateRangeToFilters(range?: string): { date_from?: string; date_to?: string } {
  if (!range || range === 'all') return {};
  const to = new Date();
  const from = new Date();
  if (range === '30d') from.setDate(from.getDate() - 30);
  else if (range === '90d') from.setDate(from.getDate() - 90);
  else if (range === '12m') from.setFullYear(from.getFullYear() - 1);
  else if (range === 'ytd') {
    from.setMonth(0, 1);
    from.setHours(0, 0, 0, 0);
  }
  return {
    date_from: from.toISOString().slice(0, 10),
    date_to: to.toISOString().slice(0, 10),
  };
}

function inferRange(dateFrom: string): string | undefined {
  const from = new Date(dateFrom).getTime();
  const days = Math.round((Date.now() - from) / 86400000);
  if (days <= 35) return '30d';
  if (days <= 100) return '90d';
  if (days <= 400) return '12m';
  return 'ytd';
}

export default function ExecutiveDashboardPage() {
  const router = useRouter();
  const { data: customers = [] } = useCustomersQuery(0, LIST_BOOTSTRAP_SIZE);
  const { data: orders = [] } = useOrdersQuery(0, LIST_BOOTSTRAP_SIZE);
  const { data: projects = [] } = useProjectsQuery(0, LIST_BOOTSTRAP_SIZE);

  const { data, loading, fetching, error, filters, updateFilters, refetch } =
    useExecutiveDashboard();

  const model = useMemo(() => buildCommandCenterViewModel(data), [data]);

  const uiFilters: ExecFiltersState = useMemo(
    () => ({
      customerId: filters.customer_id != null ? String(filters.customer_id) : undefined,
      programId: filters.order_id != null ? String(filters.order_id) : undefined,
      projectId: filters.project_id != null ? String(filters.project_id) : undefined,
      dateRange: filters.date_from ? inferRange(filters.date_from) : undefined,
    }),
    [filters]
  );

  const customerOptions = useMemo(
    () => customers.map((c) => ({ value: String(c.id), label: c.name })),
    [customers]
  );
  const programOptions = useMemo(
    () =>
      orders.map((o) => ({
        value: String(o.id),
        label: o.order_number || `Order ${o.id}`,
      })),
    [orders]
  );
  const projectOptions = useMemo(
    () => projects.map((p) => ({ value: String(p.id), label: p.name })),
    [projects]
  );

  const handleFiltersChange = (patch: Partial<ExecFiltersState>) => {
    const next: Parameters<typeof updateFilters>[0] = {};
    if ('customerId' in patch) {
      next.customer_id = patch.customerId ? Number(patch.customerId) : undefined;
    }
    if ('programId' in patch) {
      next.order_id = patch.programId ? Number(patch.programId) : undefined;
    }
    if ('projectId' in patch) {
      next.project_id = patch.projectId ? Number(patch.projectId) : undefined;
    }
    if ('dateRange' in patch) {
      Object.assign(next, dateRangeToFilters(patch.dateRange));
      if (!patch.dateRange) {
        next.date_from = undefined;
        next.date_to = undefined;
      }
    }
    updateFilters(next);
  };

  if (loading && !data) {
    return (
      <div
        className={cn(inter.variable, 'flex min-h-0 flex-1 items-center justify-center')}
        style={{ background: '#090909' }}
      >
        <div className="flex items-center gap-2 text-sm text-[#9CA3AF]">
          <Loader2 className="h-5 w-5 animate-spin text-[#8B5CF6]" />
          Loading executive command center…
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(inter.variable, 'relative flex min-h-0 flex-1 flex-col overflow-hidden')}
      style={{ background: '#090909', color: '#F5F5F5' }}
      data-executive-command-center
    >
      {error ? (
        <div className="absolute left-3 right-3 top-3 z-20 rounded-lg border border-[#EF4444]/40 bg-[#141414] p-3 text-sm">
          <p className="font-medium text-[#EF4444]">Failed to load dashboard</p>
          <p className="text-[#9CA3AF]">{error}</p>
          <Button
            variant="outline"
            size="sm"
            className="mt-2 border-[#242424] bg-transparent text-[#F5F5F5]"
            onClick={refetch}
          >
            Retry
          </Button>
        </div>
      ) : null}

      <div className={cn('min-h-0 flex-1 transition-opacity duration-300', fetching && 'opacity-70')}>
        <ExecutiveCommandGrid
          model={model}
          filters={uiFilters}
          customers={customerOptions}
          programs={programOptions}
          projects={projectOptions}
          onFiltersChange={handleFiltersChange}
          onNavigate={(path) => router.push(path)}
          fetching={fetching}
          onRefresh={refetch}
        />
      </div>
    </div>
  );
}

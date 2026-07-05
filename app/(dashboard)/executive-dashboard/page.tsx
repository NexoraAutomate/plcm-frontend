'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Users,
  ShoppingCart,
  Rocket,
  Zap,
  CheckCircle,
  Clock,
  Wrench,
  AlertTriangle,
  Puzzle,
  Settings,
  RefreshCw,
} from 'lucide-react';
import {
  useCustomersQuery,
  useOrdersQuery,
  useProjectsQuery,
  useStatusesQuery,
  useUsersQuery,
} from '@/hooks/queries';
import { LIST_BOOTSTRAP_SIZE } from '@/lib/data-loading';
import { useExecutiveDashboard } from '@/hooks/use-executive-dashboard';
import { DashboardFilterBar } from '@/components/dashboard/DashboardFilterBar';
import { DashboardSection } from '@/components/dashboard/DashboardSection';
import { ExecutiveKPICard } from '@/components/dashboard/ExecutiveKPICard';
import { DonutChartCard } from '@/components/dashboard/DonutChartCard';
import { AreaChartCard } from '@/components/dashboard/AreaChartCard';
import { LineChartCard } from '@/components/dashboard/LineChartCard';
import { BarChartCard } from '@/components/dashboard/BarChartCard';
import { HorizontalBarChartCard } from '@/components/dashboard/HorizontalBarChartCard';
import { TreemapChartCard } from '@/components/dashboard/TreemapChartCard';
import { GaugeChartCard } from '@/components/dashboard/GaugeChartCard';
import { RecentActivityTable } from '@/components/dashboard/RecentActivityTable';
import { DashboardSkeleton } from '@/components/dashboard/DashboardSkeleton';
import { GlobalSearchDialog } from '@/components/global-search-dialog';
import { Button } from '@/components/ui/button';
import {
  activityLink,
  kpiRoute,
  maintenanceStatusLink,
  projectLinkByName,
  projectStatusLink,
  resourceBarLink,
  treemapLink,
} from '@/lib/dashboard-navigation';
import type { KpiMetric } from '@/lib/types/dashboard';

const KPI_META: Record<
  string,
  { icon: typeof Users; accent: 'blue' | 'green' | 'red' | 'amber' | 'orange' | 'slate' | 'emerald' | 'violet' | 'cyan' }
> = {
  total_customers: { icon: Users, accent: 'blue' },
  total_orders: { icon: ShoppingCart, accent: 'emerald' },
  total_projects: { icon: Rocket, accent: 'violet' },
  active_projects: { icon: Zap, accent: 'amber' },
  completed_projects: { icon: CheckCircle, accent: 'green' },
  delayed_projects: { icon: Clock, accent: 'red' },
  open_maintenance_cases: { icon: Wrench, accent: 'orange' },
  open_faulty_entities: { icon: AlertTriangle, accent: 'red' },
  components_under_investigation: { icon: Puzzle, accent: 'cyan' },
  config_changes_this_month: { icon: Settings, accent: 'slate' },
};

export default function ExecutiveDashboardPage() {
  const router = useRouter();
  const { data: customers = [] } = useCustomersQuery(0, LIST_BOOTSTRAP_SIZE);
  const { data: orders = [] } = useOrdersQuery(0, LIST_BOOTSTRAP_SIZE);
  const { data: projects = [] } = useProjectsQuery(0, LIST_BOOTSTRAP_SIZE);
  const { data: users = [] } = useUsersQuery(0, LIST_BOOTSTRAP_SIZE);
  const { data: statuses = [] } = useStatusesQuery();
  const [searchOpen, setSearchOpen] = useState(false);
  const {
    data,
    loading,
    error,
    filters,
    updateFilters,
    clearFilters,
    refetch,
    isSectionHighlighted,
  } = useExecutiveDashboard();

  const projectStatuses = useMemo(
    () => statuses.filter((s) => s.status_type === 'project'),
    [statuses]
  );

  const resourceContext = useMemo(
    () => ({ customers, orders, projects, users }),
    [customers, orders, projects, users]
  );

  if (loading && !data) {
    return <DashboardSkeleton />;
  }

  const kpis = data?.kpis.metrics ?? [];

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Executive Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Production analytics across projects, maintenance, configuration, and reliability
          </p>
          {data?.generated_at ? (
            <p className="mt-1 text-xs text-muted-foreground">
              Updated {new Date(data.generated_at).toLocaleString()}
            </p>
          ) : null}
        </div>
        <Button variant="outline" size="sm" onClick={refetch} disabled={loading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      <DashboardFilterBar
        filters={filters}
        customers={customers}
        orders={orders}
        projects={projects}
        projectStatuses={projectStatuses}
        onChange={updateFilters}
        onClear={clearFilters}
        onSearchOpen={() => setSearchOpen(true)}
      />

      <GlobalSearchDialog open={searchOpen} onOpenChange={setSearchOpen} />

      {error ? (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm">
          <p className="font-medium text-destructive">Failed to load dashboard</p>
          <p className="text-muted-foreground">{error}</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={refetch}>
            Retry
          </Button>
        </div>
      ) : null}

      <DashboardSection title="Key Performance Indicators" description="Click a KPI to open the related list">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {kpis.map((metric: KpiMetric) => {
            const meta = KPI_META[metric.key] ?? { icon: Rocket, accent: 'blue' as const };
            return (
              <ExecutiveKPICard
                key={metric.key}
                label={metric.label}
                value={metric.value}
                changePercent={metric.change_percent}
                icon={meta.icon}
                accentColor={meta.accent}
                onClick={() => router.push(kpiRoute(metric.key))}
              />
            );
          })}
        </div>
      </DashboardSection>

      <DashboardSection
        title="Project Analytics"
        description="Status distribution, creation timeline, and progress by status weight"
        highlighted={isSectionHighlighted('projects')}
      >
        <div className="grid gap-4 lg:grid-cols-3">
          <DonutChartCard
            title="Projects by Status"
            data={data?.projects.status_distribution ?? []}
            onSliceClick={(item) => router.push(projectStatusLink(item.name))}
          />
          <AreaChartCard
            title="Projects Created (Monthly)"
            data={data?.projects.timeline ?? []}
            onClick={() => router.push('/projects')}
          />
          <HorizontalBarChartCard
            title="Project Progress"
            data={data?.projects.progress ?? []}
            valueKey="progress"
            onBarClick={(item) => {
              if ('id' in item && item.id) router.push(`/projects/${item.id}`);
            }}
          />
        </div>
      </DashboardSection>

      <DashboardSection
        title="Maintenance Analytics"
        description="Case status, fault distribution, and monthly trend"
        highlighted={isSectionHighlighted('maintenance')}
      >
        <div className="grid gap-4 lg:grid-cols-3">
          <DonutChartCard
            title="Cases by Status"
            data={data?.maintenance.cases_by_status ?? []}
            onSliceClick={(item) => router.push(maintenanceStatusLink(item.name))}
          />
          <BarChartCard
            title="Faults by Project"
            data={data?.maintenance.fault_by_project[0]?.series[0]?.data ?? []}
            onBarClick={(item) => {
              const href = projectLinkByName(item.name, projects);
              router.push(href ?? '/projects');
            }}
          />
          <LineChartCard
            title="Cases Opened (Monthly)"
            data={data?.maintenance.monthly_trend ?? []}
            onClick={() => router.push('/maintenance')}
          />
        </div>
      </DashboardSection>

      <DashboardSection
        title="Product Structure"
        description="Customer → Order → Project hierarchy"
        highlighted={isSectionHighlighted('product_structure')}
      >
        <TreemapChartCard
          title="Hierarchy Treemap"
          tree={data?.product_structure.tree ?? []}
          onNodeClick={(node) => router.push(treemapLink(node))}
        />
      </DashboardSection>

      <DashboardSection
        title="Configuration Analytics"
        description="Change volume, top modified components, recent timeline"
        highlighted={isSectionHighlighted('configuration')}
      >
        <div className="grid gap-4 lg:grid-cols-3">
          <BarChartCard
            title="Config Changes by Month"
            data={data?.configuration.changes_by_month ?? []}
            onBarClick={() => router.push('/maintenance')}
          />
          <HorizontalBarChartCard
            title="Top Modified Components"
            data={data?.configuration.top_modified_components ?? []}
            onBarClick={() => router.push('/components')}
          />
          <RecentActivityTable
            title="Recent Config Changes"
            items={data?.configuration.recent_timeline ?? []}
            onRowClick={(item) => router.push(activityLink(item))}
          />
        </div>
      </DashboardSection>

      <DashboardSection
        title="Reliability Metrics"
        description="Fault patterns, MTTR, and MTBF"
        highlighted={isSectionHighlighted('reliability')}
      >
        <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
          <BarChartCard
            title="Top Faulty Components"
            data={data?.reliability.top_faulty_components ?? []}
            onBarClick={() => router.push('/maintenance')}
          />
          <DonutChartCard
            title="Faults by Type"
            data={data?.reliability.fault_type_distribution ?? []}
            onSliceClick={() => router.push('/maintenance')}
          />
          {data?.reliability.mttr ? (
            <GaugeChartCard
              metric={data.reliability.mttr}
              onClick={() => router.push('/maintenance')}
            />
          ) : null}
          {data?.reliability.mtbf ? (
            <GaugeChartCard
              metric={data.reliability.mtbf}
              onClick={() => router.push('/maintenance')}
            />
          ) : null}
        </div>
      </DashboardSection>

      <DashboardSection
        title="Resource Allocation"
        description="Projects by owner, customer, and order"
        highlighted={isSectionHighlighted('resources')}
      >
        <div className="grid gap-4 lg:grid-cols-3">
          <BarChartCard
            title="Projects by Owner"
            data={data?.resources.projects_by_owner ?? []}
            onBarClick={(item) =>
              router.push(resourceBarLink('Projects by Owner', item, resourceContext))
            }
          />
          <BarChartCard
            title="Projects by Customer"
            data={data?.resources.projects_by_customer ?? []}
            onBarClick={(item) =>
              router.push(resourceBarLink('Projects by Customer', item, resourceContext))
            }
          />
          <BarChartCard
            title="Projects by Order"
            data={data?.resources.projects_by_order ?? []}
            onBarClick={(item) =>
              router.push(resourceBarLink('Projects by Order', item, resourceContext))
            }
          />
        </div>
      </DashboardSection>

      <DashboardSection
        title="Recent Activities"
        description="Latest cases, config changes, projects, and user actions"
        highlighted={isSectionHighlighted('activities')}
      >
        <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
          <RecentActivityTable
            title="Maintenance Cases"
            items={data?.activities.maintenance_cases ?? []}
            onRowClick={(item) => router.push(activityLink(item))}
          />
          <RecentActivityTable
            title="Configuration Changes"
            items={data?.activities.configuration_changes ?? []}
            onRowClick={(item) => router.push(activityLink(item))}
          />
          <RecentActivityTable
            title="Projects"
            items={data?.activities.projects ?? []}
            onRowClick={(item) => router.push(activityLink(item))}
          />
          <RecentActivityTable
            title="Fault Confirmations"
            items={data?.activities.fault_confirmations ?? []}
            onRowClick={(item) => router.push(activityLink(item))}
          />
          <RecentActivityTable
            title="User Activities"
            items={data?.activities.user_activities ?? []}
            onRowClick={(item) => router.push(activityLink(item))}
          />
        </div>
      </DashboardSection>
    </div>
  );
}

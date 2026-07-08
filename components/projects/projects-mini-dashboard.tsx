'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
} from 'recharts';
import {
  Rocket,
  Layers,
  TrendingUp,
  CheckCircle2,
  type LucideIcon,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { Order, Project, Status, System } from '@/lib/models';
import { CHART_COLORS } from '@/lib/dashboard-chart-theme';
import {
  ChartLegend,
  ChartValueLabelList,
  HorizontalChartValueLabelList,
  renderPieSliceLabel,
} from '@/components/dashboard/chart-overlays';
import { getSystemCountByProjectId } from '@/lib/entity-counts';

const PROJECT_STATUS_COLORS: Record<string, string> = {
  Initiation: 'oklch(0.55 0.02 250)',
  Planning: 'oklch(0.62 0.15 250)',
  Execution: 'oklch(0.65 0.15 165)',
  Monitoring: 'oklch(0.70 0.18 45)',
  Completed: 'oklch(0.65 0.15 165)',
  'On Hold': 'oklch(0.55 0.2 15)',
};

interface ProjectsMiniDashboardProps {
  projects: Project[];
  systems: System[];
  projectStatuses: Status[];
  activeStatusFilter: string;
  onStatusFilter: (status: string) => void;
  filteredOrder?: Order | null;
  totalCount?: number;
}

function KpiTile({
  label,
  value,
  sub,
  icon: Icon,
  active,
  onClick,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: LucideIcon;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-xl border bg-card p-4 text-left shadow-sm transition-all hover:scale-[1.01] hover:shadow-md',
        active && 'ring-2 ring-primary/40',
        onClick && 'cursor-pointer'
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
          <p className="mt-1 text-2xl font-bold tabular-nums">{value}</p>
          {sub ? <p className="mt-1 text-xs text-muted-foreground">{sub}</p> : null}
        </div>
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
          <Icon className="h-5 w-5 text-primary" />
        </div>
      </div>
    </button>
  );
}

export function ProjectsMiniDashboard({
  projects,
  systems,
  projectStatuses,
  activeStatusFilter,
  onStatusFilter,
  filteredOrder,
  totalCount,
}: ProjectsMiniDashboardProps) {
  const router = useRouter();
  const [activeChart, setActiveChart] = useState<'status' | 'progress' | 'systems' | 'timeline'>(
    'status'
  );

  const systemCountByProject = useMemo(
    () => getSystemCountByProjectId(systems),
    [systems]
  );

  const getProjectStatusName = (project: Project) =>
    projectStatuses.find((s) => s.id === project.status_id)?.status_name ??
    project.status_name ??
    'Unknown';

  const projectStatusData = useMemo(() => {
    const counts = new Map<string, { name: string; value: number }>();
    for (const status of projectStatuses) {
      counts.set(status.status_name, { name: status.status_name, value: 0 });
    }
    for (const project of projects) {
      const name = getProjectStatusName(project);
      const entry = counts.get(name) ?? { name, value: 0 };
      entry.value += 1;
      counts.set(name, entry);
    }
    return Array.from(counts.values()).filter((d) => d.value > 0);
  }, [projects, projectStatuses]);

  const progressData = useMemo(
    () =>
      [...projects]
        .sort((a, b) => (b.progress ?? 0) - (a.progress ?? 0))
        .slice(0, 8)
        .map((p) => ({
          name: p.name.length > 14 ? `${p.name.slice(0, 14)}…` : p.name,
          value: p.progress ?? 0,
          id: p.id,
        })),
    [projects]
  );

  const systemsData = useMemo(
    () =>
      [...projects]
        .map((p) => ({
          name: p.name.length > 12 ? `${p.name.slice(0, 12)}…` : p.name,
          value: systemCountByProject.get(p.id) ?? 0,
          id: p.id,
        }))
        .filter((row) => row.value > 0)
        .sort((a, b) => b.value - a.value)
        .slice(0, 8),
    [projects, systemCountByProject]
  );

  const projectsTimeline = useMemo(() => {
    const byMonth = new Map<string, number>();
    for (const project of projects) {
      if (!project.start_date) continue;
      const key = project.start_date.slice(0, 7);
      byMonth.set(key, (byMonth.get(key) ?? 0) + 1);
    }
    return Array.from(byMonth.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, value]) => ({ name, value }));
  }, [projects]);

  const totalSystems = projects.reduce(
    (sum, p) => sum + (systemCountByProject.get(p.id) ?? 0),
    0
  );
  const avgProgress =
    projects.length > 0
      ? Math.round(
          projects.reduce((sum, p) => sum + (p.progress ?? 0), 0) / projects.length
        )
      : 0;
  const completedCount = projects.filter(
    (p) => getProjectStatusName(p) === 'Completed'
  ).length;

  const scopeLabel = filteredOrder
    ? `Order ${filteredOrder.order_number}`
    : 'All projects';

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiTile
          label="Total Projects"
          value={totalCount ?? projects.length}
          sub={scopeLabel}
          icon={Rocket}
          active={activeStatusFilter === 'Total'}
          onClick={() => onStatusFilter('Total')}
        />
        <KpiTile
          label="Linked Systems"
          value={totalSystems}
          sub="Across shown projects"
          icon={Layers}
          onClick={() => router.push('/systems')}
        />
        <KpiTile
          label="Avg Progress"
          value={`${avgProgress}%`}
          sub={`${completedCount} completed`}
          icon={TrendingUp}
          onClick={() => router.push('/projects')}
        />
        <KpiTile
          label="Completed"
          value={completedCount}
          sub="Click chart to filter"
          icon={CheckCircle2}
          active={activeStatusFilter === 'Completed'}
          onClick={() => onStatusFilter('Completed')}
        />
      </div>

      <div className="flex flex-wrap gap-2">
        {(['status', 'progress', 'systems', 'timeline'] as const).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setActiveChart(key)}
            className={cn(
              'rounded-full border px-3 py-1 text-xs font-medium capitalize transition-colors',
              activeChart === key
                ? 'border-primary bg-primary text-primary-foreground'
                : 'bg-muted/50 text-muted-foreground hover:bg-muted'
            )}
          >
            {key === 'timeline' ? 'Start timeline' : `${key} chart`}
          </button>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {activeChart === 'status' && (
          <>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Projects by Status</CardTitle>
                <CardDescription>Click a segment to filter the table below</CardDescription>
              </CardHeader>
              <CardContent>
                {projectStatusData.length === 0 ? (
                  <p className="py-12 text-center text-sm text-muted-foreground">No projects yet</p>
                ) : (
                  <ResponsiveContainer width="100%" height={260}>
                    <PieChart>
                      <Pie
                        data={projectStatusData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="45%"
                        innerRadius={50}
                        outerRadius={80}
                        paddingAngle={2}
                        label={renderPieSliceLabel}
                        labelLine={false}
                        className="cursor-pointer"
                        onClick={(_, index) => {
                          const entry = projectStatusData[index];
                          if (entry?.name) onStatusFilter(entry.name);
                        }}
                      >
                        {projectStatusData.map((entry, i) => (
                          <Cell
                            key={entry.name}
                            fill={
                              PROJECT_STATUS_COLORS[entry.name] ??
                              CHART_COLORS[i % CHART_COLORS.length]
                            }
                            opacity={
                              activeStatusFilter !== 'Total' &&
                              entry.name !== activeStatusFilter
                                ? 0.35
                                : 1
                            }
                          />
                        ))}
                      </Pie>
                      <Tooltip />
                      <ChartLegend />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Recent Projects</CardTitle>
                <CardDescription>Quick access to project details</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {projects.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">No projects yet</p>
                ) : (
                  projects.slice(0, 6).map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      className={cn(
                        'flex w-full items-center gap-2 rounded-lg border p-2 text-left text-sm hover:bg-muted/50',
                        activeStatusFilter !== 'Total' &&
                          getProjectStatusName(p) === activeStatusFilter &&
                          'ring-2 ring-primary/30'
                      )}
                      onClick={() => router.push(`/projects/${p.id}`)}
                    >
                      <span className="min-w-0 flex-1 truncate font-medium">{p.name}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {getProjectStatusName(p)}
                      </span>
                      <span className="tabular-nums text-muted-foreground">{p.progress ?? 0}%</span>
                    </button>
                  ))
                )}
              </CardContent>
            </Card>
          </>
        )}

        {activeChart === 'progress' && (
          <>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Progress by Project</CardTitle>
                <CardDescription>Click a bar to open project</CardDescription>
              </CardHeader>
              <CardContent>
                {progressData.length === 0 ? (
                  <p className="py-12 text-center text-sm text-muted-foreground">No projects yet</p>
                ) : (
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={progressData} layout="vertical" margin={{ left: 8, right: 24, top: 8, bottom: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" horizontal={false} />
                      <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10 }} />
                      <YAxis type="category" dataKey="name" width={72} tick={{ fontSize: 10 }} />
                      <Tooltip formatter={(v: number) => [`${v}%`, 'Progress']} />
                      <Bar
                        dataKey="value"
                        name="Progress"
                        fill="oklch(0.65 0.15 165)"
                        radius={[0, 4, 4, 0]}
                        className="cursor-pointer"
                        onClick={(data) => {
                          const id = (data as { id?: number }).id;
                          if (id) router.push(`/projects/${id}`);
                        }}
                      >
                        <HorizontalChartValueLabelList suffix="%" />
                      </Bar>
                      <ChartLegend />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Status Summary</CardTitle>
                <CardDescription>Lifecycle breakdown</CardDescription>
              </CardHeader>
              <CardContent>
                {projectStatusData.length === 0 ? (
                  <p className="py-12 text-center text-sm text-muted-foreground">No data</p>
                ) : (
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={projectStatusData} margin={{ top: 16, right: 8, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                      <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-15} textAnchor="end" height={50} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                      <Tooltip />
                      <Bar
                        dataKey="value"
                        name="Projects"
                        fill="oklch(0.62 0.15 250)"
                        radius={[4, 4, 0, 0]}
                        className="cursor-pointer"
                        onClick={(data) => {
                          const name = (data as { name?: string }).name;
                          if (name) onStatusFilter(name);
                        }}
                      >
                        <ChartValueLabelList />
                      </Bar>
                      <ChartLegend />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </>
        )}

        {activeChart === 'systems' && (
          <>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Systems per Project</CardTitle>
                <CardDescription>Click a bar to open project</CardDescription>
              </CardHeader>
              <CardContent>
                {systemsData.length === 0 ? (
                  <p className="py-12 text-center text-sm text-muted-foreground">No systems linked yet</p>
                ) : (
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={systemsData} layout="vertical" margin={{ left: 8, right: 24, top: 8, bottom: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" horizontal={false} />
                      <XAxis type="number" allowDecimals={false} tick={{ fontSize: 10 }} />
                      <YAxis type="category" dataKey="name" width={72} tick={{ fontSize: 10 }} />
                      <Tooltip />
                      <Bar
                        dataKey="value"
                        name="Systems"
                        fill="oklch(0.60 0.12 280)"
                        radius={[0, 4, 4, 0]}
                        className="cursor-pointer"
                        onClick={(data) => {
                          const id = (data as { id?: number }).id;
                          if (id) router.push(`/projects/${id}`);
                        }}
                      >
                        <HorizontalChartValueLabelList />
                      </Bar>
                      <ChartLegend />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Project Directory</CardTitle>
                <CardDescription>Systems count per project</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {projects.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">No projects yet</p>
                ) : (
                  projects.slice(0, 6).map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      className="flex w-full items-center justify-between rounded-lg border p-2 text-left text-sm hover:bg-muted/50"
                      onClick={() => router.push(`/projects/${p.id}`)}
                    >
                      <span className="font-medium truncate">{p.name}</span>
                      <span className="text-muted-foreground shrink-0 ml-2">
                        {systemCountByProject.get(p.id) ?? 0} systems
                      </span>
                    </button>
                  ))
                )}
              </CardContent>
            </Card>
          </>
        )}

        {activeChart === 'timeline' && (
          <Card className="lg:col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Projects Over Time</CardTitle>
              <CardDescription>Monthly project starts{filteredOrder ? ` for ${filteredOrder.order_number}` : ''}</CardDescription>
            </CardHeader>
            <CardContent>
              {projectsTimeline.length === 0 ? (
                <p className="py-12 text-center text-sm text-muted-foreground">No start dates recorded</p>
              ) : (
                <ResponsiveContainer width="100%" height={270}>
                  <AreaChart data={projectsTimeline} margin={{ top: 16, right: 8, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="projectsPageFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="oklch(0.65 0.15 165)" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="oklch(0.65 0.15 165)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Area
                      type="monotone"
                      dataKey="value"
                      name="Projects"
                      stroke="oklch(0.65 0.15 165)"
                      fill="url(#projectsPageFill)"
                    >
                      <ChartValueLabelList />
                    </Area>
                    <ChartLegend />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

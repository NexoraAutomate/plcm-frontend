'use client';

import { useMemo, type ReactNode } from 'react';
import { useAppDefinitions } from '@/lib/app-definitions-context';
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
  Activity,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  type LucideIcon,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import type { Order, Project, Status, System } from '@/lib/models';
import { CHART_COLORS } from '@/lib/dashboard-chart-theme';
import { ChartValueLabelList } from '@/components/dashboard/chart-overlays';
import { getSystemCountByProjectId } from '@/lib/entity-counts';
import {
  PROJECT_STATUS_COLORS as WORKFLOW_PROJECT_STATUS_COLORS,
  workflowStatusColor,
  workflowStatusLabel,
} from '@/lib/workflow-status';

const PROJECT_STATUS_COLORS: Record<string, string> = {
  Initiation: 'oklch(0.55 0.02 250)',
  Planning: 'oklch(0.62 0.15 250)',
  Execution: 'oklch(0.65 0.15 165)',
  Monitoring: 'oklch(0.70 0.18 45)',
  Completed: 'oklch(0.65 0.15 165)',
  'On Hold': 'oklch(0.55 0.2 15)',
  ...WORKFLOW_PROJECT_STATUS_COLORS,
};

const PROGRESS_BANDS = [
  { key: '0-24', label: '0–24%', min: 0, max: 24, fill: 'oklch(0.55 0.02 250)' },
  { key: '25-49', label: '25–49%', min: 25, max: 49, fill: 'oklch(0.70 0.18 45)' },
  { key: '50-74', label: '50–74%', min: 50, max: 74, fill: 'oklch(0.62 0.15 250)' },
  { key: '75-100', label: '75–100%', min: 75, max: 100, fill: 'oklch(0.65 0.15 165)' },
] as const;

type Accent = 'blue' | 'emerald' | 'amber' | 'orange' | 'slate';

const ACCENT_BORDER: Record<Accent, string> = {
  blue: 'border-l-blue-500',
  emerald: 'border-l-emerald-500',
  amber: 'border-l-amber-500',
  orange: 'border-l-orange-500',
  slate: 'border-l-slate-500',
};

const ACCENT_ICON: Record<Accent, string> = {
  blue: 'bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400',
  emerald: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400',
  amber: 'bg-amber-50 text-amber-600 dark:bg-amber-950 dark:text-amber-400',
  orange: 'bg-orange-50 text-orange-600 dark:bg-orange-950 dark:text-orange-400',
  slate: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
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

function isTerminalStatus(statusName: string): boolean {
  const label = workflowStatusLabel(statusName).toLowerCase();
  return label === 'completed' || label === 'cancelled' || label === 'superseded';
}

function isCompletedStatus(statusName: string): boolean {
  return workflowStatusLabel(statusName).toLowerCase() === 'completed';
}

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function isOverdue(project: Project, statusName: string): boolean {
  if (isTerminalStatus(statusName) || !project.end_date) return false;
  const end = new Date(project.end_date);
  if (Number.isNaN(end.getTime())) return false;
  return end < startOfToday();
}

function statusFill(code: string, name: string, index: number): string {
  return (
    PROJECT_STATUS_COLORS[code] ??
    PROJECT_STATUS_COLORS[name] ??
    workflowStatusColor(code) ??
    workflowStatusColor(name) ??
    CHART_COLORS[index % CHART_COLORS.length]
  );
}

function KpiTile({
  label,
  value,
  sub,
  icon: Icon,
  accent,
  active,
  onClick,
  progress,
}: {
  label: ReactNode;
  value: string | number;
  sub?: string;
  icon: LucideIcon;
  accent: Accent;
  active?: boolean;
  onClick?: () => void;
  progress?: number;
}) {
  const body = (
    <div className="flex items-center justify-between gap-2 sm:items-start sm:gap-2">
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-3 sm:block">
          <p className="text-[10px] font-medium uppercase leading-tight tracking-wide text-muted-foreground sm:text-xs">
            {label}
          </p>
          <p className="text-lg font-bold tabular-nums tracking-tight sm:mt-1 sm:text-2xl">
            {value}
          </p>
        </div>
        {sub ? (
          <p className="mt-0.5 truncate text-[11px] text-muted-foreground sm:mt-1 sm:text-xs">
            {sub}
          </p>
        ) : null}
        {typeof progress === 'number' ? (
          <Progress value={Math.min(100, Math.max(0, progress))} className="mt-1.5 h-1 sm:mt-2 sm:h-1.5" />
        ) : null}
      </div>
      <div
        className={cn(
          'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg sm:h-10 sm:w-10 sm:rounded-xl',
          ACCENT_ICON[accent]
        )}
      >
        <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
      </div>
    </div>
  );

  const className = cn(
    'rounded-lg border border-l-4 bg-card px-3 py-2 text-left shadow-sm transition-all sm:rounded-xl sm:p-4',
    ACCENT_BORDER[accent],
    onClick && 'cursor-pointer hover:shadow-md hover:scale-[1.01]',
    active && 'ring-2 ring-primary/40'
  );

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={className}>
        {body}
      </button>
    );
  }

  return <div className={className}>{body}</div>;
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
  const { entityLabel } = useAppDefinitions();
  const router = useRouter();

  const systemCountByProject = useMemo(
    () => getSystemCountByProjectId(systems),
    [systems]
  );

  const getProjectStatusName = (project: Project) =>
    projectStatuses.find((s) => s.id === project.status_id)?.status_name ??
    project.status_name ??
    'Unknown';

  const projectStatusData = useMemo(() => {
    const counts = new Map<string, { name: string; code: string; value: number }>();
    for (const status of projectStatuses) {
      counts.set(status.status_name, {
        name: workflowStatusLabel(status.status_name),
        code: status.status_name,
        value: 0,
      });
    }
    for (const project of projects) {
      const code = getProjectStatusName(project);
      const entry = counts.get(code) ?? {
        name: workflowStatusLabel(code),
        code,
        value: 0,
      };
      entry.value += 1;
      counts.set(code, entry);
    }
    return Array.from(counts.values()).filter((d) => d.value > 0);
  }, [projects, projectStatuses]);

  const progressBandData = useMemo(() => {
    const counts = PROGRESS_BANDS.map((band) => ({
      name: band.label,
      value: 0,
      fill: band.fill,
    }));
    for (const project of projects) {
      const pct = Math.min(100, Math.max(0, project.progress ?? 0));
      const index = PROGRESS_BANDS.findIndex((b) => pct >= b.min && pct <= b.max);
      if (index >= 0) counts[index].value += 1;
    }
    return counts;
  }, [projects]);

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

  const attentionProjects = useMemo(() => {
    return [...projects]
      .map((p) => {
        const statusName = getProjectStatusName(p);
        const overdue = isOverdue(p, statusName);
        return {
          project: p,
          statusName,
          overdue,
          progress: p.progress ?? 0,
          systems: systemCountByProject.get(p.id) ?? 0,
        };
      })
      .filter((row) => !isTerminalStatus(row.statusName))
      .sort((a, b) => {
        if (a.overdue !== b.overdue) return a.overdue ? -1 : 1;
        return a.progress - b.progress;
      })
      .slice(0, 6);
  }, [projects, projectStatuses, systemCountByProject]);

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
  const completedCount = projects.filter((p) =>
    isCompletedStatus(getProjectStatusName(p))
  ).length;
  const activeCount = projects.filter(
    (p) => !isTerminalStatus(getProjectStatusName(p))
  ).length;
  const atRiskCount = projects.filter((p) =>
    isOverdue(p, getProjectStatusName(p))
  ).length;

  const statusTotal = projectStatusData.reduce((sum, d) => sum + d.value, 0);
  const displayTotal = totalCount ?? projects.length;

  const scopeLabel = filteredOrder
    ? `Order ${filteredOrder.order_number}`
    : `All ${entityLabel('project', true).toLowerCase()}`;

  return (
    <div className="space-y-3 sm:space-y-4">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-3 lg:grid-cols-5">
        <KpiTile
          label={`Total ${entityLabel('project', true)}`}
          value={displayTotal}
          sub={scopeLabel}
          icon={Rocket}
          accent="blue"
          active={activeStatusFilter === 'Total'}
          onClick={() => onStatusFilter('Total')}
        />
        <KpiTile
          label="Active"
          value={activeCount}
          sub="In pipeline"
          icon={Activity}
          accent="emerald"
        />
        <KpiTile
          label="Avg Progress"
          value={`${avgProgress}%`}
          sub={`${completedCount} completed`}
          icon={TrendingUp}
          accent="amber"
          progress={avgProgress}
        />
        <KpiTile
          label="At Risk"
          value={atRiskCount}
          sub="Past end date"
          icon={AlertTriangle}
          accent="orange"
        />
        <KpiTile
          label="Completed"
          value={completedCount}
          sub="Click to filter"
          icon={CheckCircle2}
          accent="slate"
          active={activeStatusFilter === 'Completed'}
          onClick={() => onStatusFilter('Completed')}
        />
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <Card className="shadow-sm">
          <CardHeader className="px-4 pb-2 pt-4 sm:px-6 sm:pt-6">
            <CardTitle className="text-sm font-medium">
              {entityLabel('project', true)} by Status
            </CardTitle>
            <CardDescription className="hidden sm:block">
              Click a segment or legend item to filter the table
            </CardDescription>
          </CardHeader>
          <CardContent className="px-4 pb-4 sm:px-6 sm:pb-6">
            {projectStatusData.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground sm:py-12">No projects yet</p>
            ) : (
              <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:gap-4">
                <div className="relative mx-auto h-[180px] w-full max-w-[180px] shrink-0 sm:h-[220px] sm:max-w-[220px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={projectStatusData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius="45%"
                        outerRadius="72%"
                        paddingAngle={3}
                        strokeWidth={0}
                        className="cursor-pointer"
                        onClick={(_, index) => {
                          const entry = projectStatusData[index];
                          if (entry?.code) onStatusFilter(entry.code);
                        }}
                      >
                        {projectStatusData.map((entry, i) => (
                          <Cell
                            key={entry.code}
                            fill={statusFill(entry.code, entry.name, i)}
                            opacity={
                              activeStatusFilter !== 'Total' &&
                              entry.code !== activeStatusFilter
                                ? 0.35
                                : 1
                            }
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value: number, name: string) => [value, name]}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-2xl font-bold tabular-nums leading-none">
                      {statusTotal}
                    </span>
                    <span className="mt-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                      Shown
                    </span>
                  </div>
                </div>
                <ul className="flex min-w-0 flex-1 flex-col gap-1.5">
                  {projectStatusData.map((entry, i) => {
                    const fill = statusFill(entry.code, entry.name, i);
                    const isActive =
                      activeStatusFilter !== 'Total' &&
                      entry.code === activeStatusFilter;
                    return (
                      <li key={entry.code}>
                        <button
                          type="button"
                          onClick={() => onStatusFilter(entry.code)}
                          className={cn(
                            'flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition-colors hover:bg-muted/60',
                            isActive && 'bg-muted ring-1 ring-primary/30'
                          )}
                        >
                          <span
                            className="h-2.5 w-2.5 shrink-0 rounded-full"
                            style={{ backgroundColor: fill }}
                          />
                          <span className="min-w-0 flex-1 truncate">{entry.name}</span>
                          <span className="tabular-nums font-medium text-muted-foreground">
                            {entry.value}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="px-4 pb-2 pt-4 sm:px-6 sm:pt-6">
            <CardTitle className="text-sm font-medium">Progress Distribution</CardTitle>
            <CardDescription className="hidden sm:block">
              How {entityLabel('project', true).toLowerCase()} cluster by completion
            </CardDescription>
          </CardHeader>
          <CardContent className="px-4 pb-4 sm:px-6 sm:pb-6">
            {projects.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground sm:py-12">No projects yet</p>
            ) : (
              <div className="h-[180px] w-full sm:h-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={progressBandData}
                    layout="vertical"
                    margin={{ left: 4, right: 20, top: 4, bottom: 4 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" horizontal={false} />
                    <XAxis type="number" allowDecimals={false} tick={{ fontSize: 10 }} />
                    <YAxis type="category" dataKey="name" width={64} tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v: number) => [v, entityLabel('project', true)]} />
                    <Bar dataKey="value" name={entityLabel('project', true)} radius={[0, 6, 6, 0]} barSize={22}>
                      {progressBandData.map((band) => (
                        <Cell key={band.name} fill={band.fill} />
                      ))}
                      <ChartValueLabelList />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="px-4 pb-2 pt-4 sm:px-6 sm:pt-6">
            <CardTitle className="text-sm font-medium">Needs Attention</CardTitle>
            <CardDescription className="hidden sm:block">
              Overdue first, then lowest progress · {totalSystems} linked{' '}
              {entityLabel('system', true).toLowerCase()}
            </CardDescription>
            <CardDescription className="sm:hidden">
              {totalSystems} linked {entityLabel('system', true).toLowerCase()}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-1.5 px-4 pb-4 sm:px-6 sm:pb-6">
            {attentionProjects.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No active {entityLabel('project', true).toLowerCase()} need attention
              </p>
            ) : (
              attentionProjects.map(({ project, statusName, overdue, progress, systems: sysCount }) => {
                const color =
                  workflowStatusColor(statusName) ??
                  PROJECT_STATUS_COLORS[statusName] ??
                  'oklch(0.55 0.02 250)';
                return (
                  <button
                    key={project.id}
                    type="button"
                    className="flex w-full flex-col gap-1.5 rounded-lg border px-3 py-2 text-left transition-colors hover:bg-muted/50"
                    onClick={() => router.push(`/projects/${project.id}`)}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{ backgroundColor: color }}
                      />
                      <span className="min-w-0 flex-1 truncate text-sm font-medium">
                        {project.name}
                      </span>
                      {overdue ? (
                        <span className="shrink-0 rounded-md bg-orange-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-orange-700 dark:bg-orange-950 dark:text-orange-300">
                          Overdue
                        </span>
                      ) : null}
                      <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                        {progress}%
                      </span>
                    </div>
                    <div className="flex items-center gap-2 pl-4">
                      <Progress value={progress} className="h-1.5 flex-1" />
                      <span className="shrink-0 text-[10px] text-muted-foreground">
                        {workflowStatusLabel(statusName)}
                        {sysCount > 0 ? ` · ${sysCount} sys` : ''}
                      </span>
                    </div>
                  </button>
                );
              })
            )}
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="px-4 pb-2 pt-4 sm:px-6 sm:pt-6">
            <CardTitle className="text-sm font-medium">
              {entityLabel('project', true)} Starts
            </CardTitle>
            <CardDescription className="hidden sm:block">
              Monthly start dates
              {filteredOrder ? ` for ${filteredOrder.order_number}` : ''}
            </CardDescription>
            <CardDescription className="sm:hidden">Monthly starts</CardDescription>
          </CardHeader>
          <CardContent className="px-4 pb-4 sm:px-6 sm:pb-6">
            {projectsTimeline.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground sm:py-12">
                No start dates recorded
              </p>
            ) : (
              <div className="h-[180px] w-full sm:h-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={projectsTimeline} margin={{ top: 12, right: 8, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="projectsPageFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="oklch(0.62 0.15 250)" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="oklch(0.62 0.15 250)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 10 }} width={28} />
                    <Tooltip />
                    <Area
                      type="monotone"
                      dataKey="value"
                      name={entityLabel('project', true)}
                      stroke="oklch(0.55 0.14 250)"
                      fill="url(#projectsPageFill)"
                      strokeWidth={2}
                    >
                      <ChartValueLabelList />
                    </Area>
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

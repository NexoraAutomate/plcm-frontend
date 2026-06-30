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
  Server,
  CheckCircle2,
  Network,
  AlertTriangle,
  type LucideIcon,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { Project, Status, System, Subsystem } from '@/lib/models';
import { FaultyEntityStatus } from '@/lib/models';
import { CHART_COLORS } from '@/lib/dashboard-chart-theme';

const SYSTEM_STATUS_COLORS: Record<string, string> = {
  Design: 'oklch(0.62 0.15 250)',
  Development: 'oklch(0.70 0.18 45)',
  Testing: 'oklch(0.60 0.12 280)',
  Operational: 'oklch(0.65 0.15 165)',
  Retired: 'oklch(0.55 0.2 15)',
};

interface SystemsListDashboardProps {
  systems: System[];
  projects: Project[];
  subsystems: Subsystem[];
  systemStatuses: Status[];
  faultMap: Map<string, FaultyEntityStatus>;
  activeStatusName: string;
  activeProjectId: string;
  onStatusFilter: (statusName: string) => void;
  onProjectFilter: (projectId: string) => void;
  getStatusName: (system: System) => string;
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

export function SystemsListDashboard({
  systems,
  projects,
  subsystems,
  systemStatuses,
  faultMap,
  activeStatusName,
  activeProjectId,
  onStatusFilter,
  onProjectFilter,
  getStatusName,
}: SystemsListDashboardProps) {
  const router = useRouter();
  const [activeChart, setActiveChart] = useState<'status' | 'projects' | 'hierarchy' | 'timeline'>(
    'status'
  );

  const statusData = useMemo(() => {
    const counts = new Map<string, { name: string; value: number }>();
    for (const status of systemStatuses) {
      counts.set(status.status_name, { name: status.status_name, value: 0 });
    }
    for (const system of systems) {
      const name = getStatusName(system);
      const entry = counts.get(name) ?? { name, value: 0 };
      entry.value += 1;
      counts.set(name, entry);
    }
    return Array.from(counts.values()).filter((d) => d.value > 0);
  }, [systems, systemStatuses, getStatusName]);

  const projectData = useMemo(() => {
    const counts = new Map<number, { name: string; value: number; projectId: number }>();
    for (const system of systems) {
      if (!system.project_id) continue;
      const project = projects.find((p) => p.id === system.project_id);
      const name = project?.name ?? `Project ${system.project_id}`;
      const entry = counts.get(system.project_id) ?? {
        name: name.length > 14 ? `${name.slice(0, 12)}…` : name,
        value: 0,
        projectId: system.project_id,
      };
      entry.value += 1;
      counts.set(system.project_id, entry);
    }
    return Array.from(counts.values())
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }, [systems, projects]);

  const hierarchyData = useMemo(() => {
    return systems
      .map((s) => ({
        name: s.name.length > 14 ? `${s.name.slice(0, 12)}…` : s.name,
        subsystems: subsystems.filter((sub) => sub.system_id === s.id).length,
        systemId: s.id,
      }))
      .sort((a, b) => b.subsystems - a.subsystems)
      .slice(0, 8);
  }, [systems, subsystems]);

  const timelineData = useMemo(() => {
    const byMonth = new Map<string, number>();
    for (const s of systems) {
      if (!s.created_at) continue;
      const key = s.created_at.slice(0, 7);
      byMonth.set(key, (byMonth.get(key) ?? 0) + 1);
    }
    return Array.from(byMonth.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, value]) => ({ name, value }));
  }, [systems]);

  const operationalCount = systems.filter((s) => getStatusName(s) === 'Operational').length;
  const faultCount = systems.filter((s) => faultMap.has(`system:${s.id}`)).length;
  const totalSubsystems = subsystems.filter((sub) =>
    systems.some((s) => s.id === sub.system_id)
  ).length;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiTile
          label="Total Systems"
          value={systems.length}
          sub="Click chart to filter"
          icon={Server}
          active={activeStatusName === 'all' && activeProjectId === 'all'}
          onClick={() => {
            onStatusFilter('all');
            onProjectFilter('all');
          }}
        />
        <KpiTile
          label="Operational"
          value={operationalCount}
          sub={
            systems.length
              ? `${Math.round((operationalCount / systems.length) * 100)}% fleet ready`
              : 'No systems'
          }
          icon={CheckCircle2}
          active={activeStatusName === 'Operational'}
          onClick={() => onStatusFilter('Operational')}
        />
        <KpiTile
          label="Subsystems"
          value={totalSubsystems}
          sub="Linked to systems"
          icon={Network}
          onClick={() => router.push('/subsystems')}
        />
        <KpiTile
          label="Fault Alerts"
          value={faultCount}
          sub={faultCount > 0 ? 'Open maintenance scope' : 'All clear'}
          icon={AlertTriangle}
          onClick={() => router.push('/maintenance')}
        />
      </div>

      <div className="flex flex-wrap gap-2">
        {(['status', 'projects', 'hierarchy', 'timeline'] as const).map((key) => (
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
            {key === 'timeline' ? 'Fleet timeline' : `${key} chart`}
          </button>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {activeChart === 'status' && (
          <>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Systems by Status</CardTitle>
                <CardDescription>Click a segment to filter the table below</CardDescription>
              </CardHeader>
              <CardContent>
                {statusData.length === 0 ? (
                  <p className="py-12 text-center text-sm text-muted-foreground">No systems yet</p>
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie
                        data={statusData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={80}
                        paddingAngle={2}
                        className="cursor-pointer"
                        onClick={(_, index) => {
                          const entry = statusData[index];
                          if (entry?.name) onStatusFilter(entry.name);
                        }}
                      >
                        {statusData.map((entry, i) => (
                          <Cell
                            key={entry.name}
                            fill={
                              SYSTEM_STATUS_COLORS[entry.name] ??
                              CHART_COLORS[i % CHART_COLORS.length]
                            }
                            opacity={
                              activeStatusName !== 'all' && entry.name !== activeStatusName
                                ? 0.35
                                : 1
                            }
                          />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Lifecycle Stages</CardTitle>
                <CardDescription>Design → Development → Testing → Operational</CardDescription>
              </CardHeader>
              <CardContent>
                {statusData.length === 0 ? (
                  <p className="py-12 text-center text-sm text-muted-foreground">No data</p>
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={statusData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                      <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-15} textAnchor="end" height={50} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                      <Tooltip />
                      <Bar
                        dataKey="value"
                        radius={[4, 4, 0, 0]}
                        className="cursor-pointer"
                        onClick={(data) => {
                          const name = (data as { name?: string }).name;
                          if (name) onStatusFilter(name);
                        }}
                      >
                        {statusData.map((entry, i) => (
                          <Cell
                            key={entry.name}
                            fill={
                              SYSTEM_STATUS_COLORS[entry.name] ??
                              CHART_COLORS[i % CHART_COLORS.length]
                            }
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </>
        )}

        {activeChart === 'projects' && (
          <>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Systems by Project</CardTitle>
                <CardDescription>Click a bar to filter systems for that project</CardDescription>
              </CardHeader>
              <CardContent>
                {projectData.length === 0 ? (
                  <p className="py-12 text-center text-sm text-muted-foreground">No project links</p>
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={projectData} layout="vertical" margin={{ left: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" horizontal={false} />
                      <XAxis type="number" allowDecimals={false} tick={{ fontSize: 10 }} />
                      <YAxis type="category" dataKey="name" width={88} tick={{ fontSize: 10 }} />
                      <Tooltip />
                      <Bar
                        dataKey="value"
                        fill="oklch(0.62 0.15 250)"
                        radius={[0, 4, 4, 0]}
                        className="cursor-pointer"
                        onClick={(data) => {
                          const id = (data as { projectId?: number }).projectId;
                          if (id) onProjectFilter(String(id));
                        }}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Project Directory</CardTitle>
                <CardDescription>Open project or its systems</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {projectData.map((row) => (
                  <button
                    key={row.projectId}
                    type="button"
                    className={cn(
                      'flex w-full items-center justify-between rounded-lg border p-2 text-left text-sm hover:bg-muted/50',
                      activeProjectId === String(row.projectId) && 'ring-2 ring-primary/30'
                    )}
                    onClick={() => router.push(`/projects/${row.projectId}`)}
                  >
                    <span className="font-medium">{row.name}</span>
                    <span className="text-muted-foreground">{row.value} systems</span>
                  </button>
                ))}
              </CardContent>
            </Card>
          </>
        )}

        {activeChart === 'hierarchy' && (
          <>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Subsystems per System</CardTitle>
                <CardDescription>Click a bar to open system detail</CardDescription>
              </CardHeader>
              <CardContent>
                {hierarchyData.length === 0 ? (
                  <p className="py-12 text-center text-sm text-muted-foreground">No systems yet</p>
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={hierarchyData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                      <XAxis dataKey="name" tick={{ fontSize: 9 }} interval={0} angle={-20} textAnchor="end" height={55} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                      <Tooltip />
                      <Bar
                        dataKey="subsystems"
                        fill="oklch(0.60 0.12 280)"
                        radius={[4, 4, 0, 0]}
                        className="cursor-pointer"
                        onClick={(data) => {
                          const id = (data as { systemId?: number }).systemId;
                          if (id) router.push(`/systems/${id}`);
                        }}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Recent Systems</CardTitle>
                <CardDescription>Quick navigation</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {systems.slice(0, 6).map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    className="flex w-full items-center justify-between rounded-lg border p-2 text-left text-sm hover:bg-muted/50"
                    onClick={() => router.push(`/systems/${s.id}`)}
                  >
                    <span className="truncate font-medium">{s.name}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">{getStatusName(s)}</span>
                  </button>
                ))}
              </CardContent>
            </Card>
          </>
        )}

        {activeChart === 'timeline' && (
          <Card className="lg:col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Fleet Growth</CardTitle>
              <CardDescription>Systems added per month</CardDescription>
            </CardHeader>
            <CardContent>
              {timelineData.length === 0 ? (
                <p className="py-12 text-center text-sm text-muted-foreground">No creation dates recorded</p>
              ) : (
                <ResponsiveContainer width="100%" height={240}>
                  <AreaChart data={timelineData}>
                    <defs>
                      <linearGradient id="systemsPageFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="oklch(0.62 0.15 250)" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="oklch(0.62 0.15 250)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Area
                      type="monotone"
                      dataKey="value"
                      stroke="oklch(0.62 0.15 250)"
                      fill="url(#systemsPageFill)"
                    />
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

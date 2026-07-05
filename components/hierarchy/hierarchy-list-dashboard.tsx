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
import { AlertTriangle, CheckCircle2, Layers, Network, type LucideIcon } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { FaultyEntityStatus } from '@/lib/models';
import type { EntityScopeType } from '@/lib/entity-fault-badges';
import { CHART_COLORS } from '@/lib/dashboard-chart-theme';

export interface HierarchyListDashboardConfig {
  entityPlural: string;
  entityScope: EntityScopeType;
  statusNames: string[];
  statusColors: Record<string, string>;
  readyStatusName: string;
  childKpi: { label: string; route: string };
  parentChartTitle: string;
  parentFilterLabel: string;
  hierarchyChartTitle: string;
  hierarchyCountLabel: string;
  timelineLabel: string;
  gradientId: string;
  detailRoute: (id: number) => string;
  parentDetailRoute: (id: number) => string;
}

interface HierarchyListDashboardProps<
  T extends { id: number; name: string; created_at?: string },
  C extends { id: number },
> {
  config: HierarchyListDashboardConfig;
  items: T[];
  parents: Array<{ id: number; name: string }>;
  children: C[];
  getChildParentId: (child: C) => number | undefined;
  getStatusName: (item: T) => string;
  getParentId: (item: T) => number | undefined;
  faultMap: Map<string, FaultyEntityStatus>;
  activeStatusName: string;
  activeParentId: string;
  onStatusFilter: (statusName: string) => void;
  onParentFilter: (parentId: string) => void;
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

function truncateLabel(name: string, max = 14): string {
  return name.length > max ? `${name.slice(0, max - 2)}…` : name;
}

export function HierarchyListDashboard<
  T extends { id: number; name: string; created_at?: string },
  C extends { id: number },
>({
  config,
  items,
  parents,
  children,
  getChildParentId,
  getStatusName,
  getParentId,
  faultMap,
  activeStatusName,
  activeParentId,
  onStatusFilter,
  onParentFilter,
  totalCount,
}: HierarchyListDashboardProps<T, C>) {
  const router = useRouter();
  const [activeChart, setActiveChart] = useState<'status' | 'parent' | 'hierarchy' | 'timeline'>(
    'status'
  );

  const statusData = useMemo(() => {
    const counts = new Map<string, { name: string; value: number }>();
    for (const statusName of config.statusNames) {
      counts.set(statusName, { name: statusName, value: 0 });
    }
    for (const item of items) {
      const name = getStatusName(item);
      const entry = counts.get(name) ?? { name, value: 0 };
      entry.value += 1;
      counts.set(name, entry);
    }
    return Array.from(counts.values()).filter((d) => d.value > 0);
  }, [items, config.statusNames, getStatusName]);

  const parentData = useMemo(() => {
    const counts = new Map<number, { name: string; value: number; parentId: number }>();
    for (const item of items) {
      const parentId = getParentId(item);
      if (!parentId) continue;
      const parent = parents.find((p) => p.id === parentId);
      const name = parent?.name ?? `${config.parentFilterLabel} ${parentId}`;
      const entry = counts.get(parentId) ?? {
        name: truncateLabel(name),
        value: 0,
        parentId,
      };
      entry.value += 1;
      counts.set(parentId, entry);
    }
    return Array.from(counts.values())
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }, [items, parents, getParentId, config.parentFilterLabel]);

  const hierarchyData = useMemo(() => {
    return items
      .map((item) => ({
        name: truncateLabel(item.name),
        count: children.filter((child) => getChildParentId(child) === item.id).length,
        entityId: item.id,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
  }, [items, children, getChildParentId]);

  const timelineData = useMemo(() => {
    const byMonth = new Map<string, number>();
    for (const item of items) {
      if (!item.created_at) continue;
      const key = item.created_at.slice(0, 7);
      byMonth.set(key, (byMonth.get(key) ?? 0) + 1);
    }
    return Array.from(byMonth.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, value]) => ({ name, value }));
  }, [items]);

  const readyCount = items.filter((item) => getStatusName(item) === config.readyStatusName).length;
  const faultCount = items.filter((item) =>
    faultMap.has(`${config.entityScope}:${item.id}`)
  ).length;
  const childCount = children.filter((child) =>
    items.some((item) => getChildParentId(child) === item.id)
  ).length;
  const dbTotal = totalCount ?? items.length;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiTile
          label={`Total ${config.entityPlural}`}
          value={dbTotal}
          sub="Click chart to filter"
          icon={Layers}
          active={activeStatusName === 'all' && activeParentId === 'all'}
          onClick={() => {
            onStatusFilter('all');
            onParentFilter('all');
          }}
        />
        <KpiTile
          label={config.readyStatusName}
          value={readyCount}
          sub={
            items.length
              ? `${Math.round((readyCount / items.length) * 100)}% ready on this page`
              : `No ${config.entityPlural.toLowerCase()} on this page`
          }
          icon={CheckCircle2}
          active={activeStatusName === config.readyStatusName}
          onClick={() => onStatusFilter(config.readyStatusName)}
        />
        <KpiTile
          label={config.childKpi.label}
          value={childCount}
          sub={`On this page · linked to ${config.entityPlural.toLowerCase()}`}
          icon={Network}
          onClick={() => router.push(config.childKpi.route)}
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
        {(['status', 'parent', 'hierarchy', 'timeline'] as const).map((key) => (
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
            {key === 'timeline'
              ? config.timelineLabel
              : key === 'parent'
                ? `${config.parentFilterLabel.toLowerCase()} chart`
                : `${key} chart`}
          </button>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {activeChart === 'status' && (
          <>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">{config.entityPlural} by Status</CardTitle>
                <CardDescription>Click a segment to filter the table below</CardDescription>
              </CardHeader>
              <CardContent>
                {statusData.length === 0 ? (
                  <p className="py-12 text-center text-sm text-muted-foreground">
                    No {config.entityPlural.toLowerCase()} yet
                  </p>
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
                              config.statusColors[entry.name] ??
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
                <CardDescription>Status distribution across the fleet</CardDescription>
              </CardHeader>
              <CardContent>
                {statusData.length === 0 ? (
                  <p className="py-12 text-center text-sm text-muted-foreground">No data</p>
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={statusData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                      <XAxis
                        dataKey="name"
                        tick={{ fontSize: 10 }}
                        interval={0}
                        angle={-15}
                        textAnchor="end"
                        height={50}
                      />
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
                              config.statusColors[entry.name] ??
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

        {activeChart === 'parent' && (
          <>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">{config.parentChartTitle}</CardTitle>
                <CardDescription>
                  Click a bar to filter {config.entityPlural.toLowerCase()} by {config.parentFilterLabel.toLowerCase()}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {parentData.length === 0 ? (
                  <p className="py-12 text-center text-sm text-muted-foreground">No parent links</p>
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={parentData} layout="vertical" margin={{ left: 8 }}>
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
                          const id = (data as { parentId?: number }).parentId;
                          if (id) onParentFilter(String(id));
                        }}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">{config.parentFilterLabel} Directory</CardTitle>
                <CardDescription>Quick navigation to parent entities</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {parentData.map((row) => (
                  <button
                    key={row.parentId}
                    type="button"
                    className={cn(
                      'flex w-full items-center justify-between rounded-lg border p-2 text-left text-sm hover:bg-muted/50',
                      activeParentId === String(row.parentId) && 'ring-2 ring-primary/30'
                    )}
                    onClick={() => router.push(config.parentDetailRoute(row.parentId))}
                  >
                    <span className="font-medium">{row.name}</span>
                    <span className="text-muted-foreground">
                      {row.value} {config.entityPlural.toLowerCase()}
                    </span>
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
                <CardTitle className="text-sm font-medium">{config.hierarchyChartTitle}</CardTitle>
                <CardDescription>Click a bar to open entity detail</CardDescription>
              </CardHeader>
              <CardContent>
                {hierarchyData.length === 0 ? (
                  <p className="py-12 text-center text-sm text-muted-foreground">
                    No {config.entityPlural.toLowerCase()} yet
                  </p>
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={hierarchyData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                      <XAxis
                        dataKey="name"
                        tick={{ fontSize: 9 }}
                        interval={0}
                        angle={-20}
                        textAnchor="end"
                        height={55}
                      />
                      <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                      <Tooltip />
                      <Bar
                        dataKey="count"
                        fill="oklch(0.60 0.12 280)"
                        radius={[4, 4, 0, 0]}
                        className="cursor-pointer"
                        onClick={(data) => {
                          const id = (data as { entityId?: number }).entityId;
                          if (id) router.push(config.detailRoute(id));
                        }}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Recent {config.entityPlural}</CardTitle>
                <CardDescription>Quick navigation</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {items.slice(0, 6).map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className="flex w-full items-center justify-between rounded-lg border p-2 text-left text-sm hover:bg-muted/50"
                    onClick={() => router.push(config.detailRoute(item.id))}
                  >
                    <span className="truncate font-medium">{item.name}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">{getStatusName(item)}</span>
                  </button>
                ))}
              </CardContent>
            </Card>
          </>
        )}

        {activeChart === 'timeline' && (
          <Card className="lg:col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Growth Timeline</CardTitle>
              <CardDescription>{config.entityPlural} added per month</CardDescription>
            </CardHeader>
            <CardContent>
              {timelineData.length === 0 ? (
                <p className="py-12 text-center text-sm text-muted-foreground">No creation dates recorded</p>
              ) : (
                <ResponsiveContainer width="100%" height={240}>
                  <AreaChart data={timelineData}>
                    <defs>
                      <linearGradient id={config.gradientId} x1="0" y1="0" x2="0" y2="1">
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
                      fill={`url(#${config.gradientId})`}
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

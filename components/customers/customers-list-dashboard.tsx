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
  Users,
  UserCheck,
  ShoppingCart,
  Rocket,
  type LucideIcon,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { Customer, Order, Project, Status } from '@/lib/models';
import { CHART_COLORS } from '@/lib/dashboard-chart-theme';

const CUSTOMER_STATUS_COLORS: Record<string, string> = {
  Active: 'oklch(0.65 0.15 165)',
  Inactive: 'oklch(0.55 0.02 250)',
  Prospect: 'oklch(0.60 0.12 280)',
  Blacklisted: 'oklch(0.55 0.2 15)',
};

interface CustomersListDashboardProps {
  customers: Customer[];
  orders: Order[];
  projects: Project[];
  customerStatuses: Status[];
  activeStatusId: string;
  onStatusFilter: (statusId: string) => void;
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

export function CustomersListDashboard({
  customers,
  orders,
  projects,
  customerStatuses,
  activeStatusId,
  onStatusFilter,
}: CustomersListDashboardProps) {
  const router = useRouter();
  const [activeChart, setActiveChart] = useState<'status' | 'engagement' | 'projects' | 'timeline'>(
    'status'
  );

  const getCustomerStatusName = (customer: Customer) =>
    customerStatuses.find((s) => s.id === customer.status_id)?.status_name ??
    customer.status_name ??
    'Unknown';

  const statusData = useMemo(() => {
    const counts = new Map<string, { name: string; value: number; statusId: number }>();
    for (const status of customerStatuses) {
      counts.set(status.status_name, { name: status.status_name, value: 0, statusId: status.id });
    }
    for (const customer of customers) {
      const name = getCustomerStatusName(customer);
      const entry = counts.get(name) ?? {
        name,
        value: 0,
        statusId: customer.status_id ?? 0,
      };
      entry.value += 1;
      counts.set(name, entry);
    }
    return Array.from(counts.values()).filter((d) => d.value > 0);
  }, [customers, customerStatuses]);

  const orgTypeData = useMemo(() => {
    const counts = new Map<string, number>();
    for (const c of customers) {
      const key = c.organization_type?.trim() || 'Unspecified';
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);
  }, [customers]);

  const engagementData = useMemo(() => {
    return customers
      .map((c) => {
        const orderCount = orders.filter((o) => o.customer_id === c.id).length;
        const orderIds = new Set(
          orders.filter((o) => o.customer_id === c.id).map((o) => o.id)
        );
        const projectCount = projects.filter(
          (p) => p.order_id != null && orderIds.has(p.order_id)
        ).length;
        return {
          name: c.name.length > 14 ? `${c.name.slice(0, 12)}…` : c.name,
          orders: orderCount,
          projects: projectCount,
          customerId: c.id,
        };
      })
      .sort((a, b) => b.orders - a.orders)
      .slice(0, 8);
  }, [customers, orders, projects]);

  const countryData = useMemo(() => {
    const counts = new Map<string, number>();
    for (const c of customers) {
      const key = c.country?.trim() || 'Unknown';
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);
  }, [customers]);

  const timelineData = useMemo(() => {
    const byMonth = new Map<string, number>();
    for (const c of customers) {
      if (!c.created_at) continue;
      const key = c.created_at.slice(0, 7);
      byMonth.set(key, (byMonth.get(key) ?? 0) + 1);
    }
    return Array.from(byMonth.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, value]) => ({ name, value }));
  }, [customers]);

  const activeCount = customers.filter((c) => getCustomerStatusName(c) === 'Active').length;
  const totalOrders = orders.length;
  const totalProjects = projects.length;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiTile
          label="Total Customers"
          value={customers.length}
          sub="Click chart to filter"
          icon={Users}
          active={activeStatusId === 'all'}
          onClick={() => onStatusFilter('all')}
        />
        <KpiTile
          label="Active"
          value={activeCount}
          sub={`${customers.length ? Math.round((activeCount / customers.length) * 100) : 0}% of portfolio`}
          icon={UserCheck}
          onClick={() => {
            const active = customerStatuses.find((s) => s.status_name === 'Active');
            if (active) onStatusFilter(String(active.id));
          }}
        />
        <KpiTile
          label="Linked Orders"
          value={totalOrders}
          sub="Across all customers"
          icon={ShoppingCart}
          onClick={() => router.push('/orders')}
        />
        <KpiTile
          label="Linked Projects"
          value={totalProjects}
          sub="Across all customers"
          icon={Rocket}
          onClick={() => router.push('/projects')}
        />
      </div>

      <div className="flex flex-wrap gap-2">
        {(['status', 'engagement', 'projects', 'timeline'] as const).map((key) => (
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
            {key === 'timeline' ? 'Growth timeline' : `${key} chart`}
          </button>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {activeChart === 'status' && (
          <>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Customers by Status</CardTitle>
                <CardDescription>Click a segment to filter the table below</CardDescription>
              </CardHeader>
              <CardContent>
                {statusData.length === 0 ? (
                  <p className="py-12 text-center text-sm text-muted-foreground">No customers yet</p>
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
                          if (entry?.statusId) onStatusFilter(String(entry.statusId));
                        }}
                      >
                        {statusData.map((entry, i) => (
                          <Cell
                            key={entry.name}
                            fill={
                              CUSTOMER_STATUS_COLORS[entry.name] ??
                              CHART_COLORS[i % CHART_COLORS.length]
                            }
                            opacity={
                              activeStatusId !== 'all' &&
                              String(entry.statusId) !== activeStatusId
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
                <CardTitle className="text-sm font-medium">Organization Types</CardTitle>
                <CardDescription>Customer mix by organization type</CardDescription>
              </CardHeader>
              <CardContent>
                {orgTypeData.length === 0 ? (
                  <p className="py-12 text-center text-sm text-muted-foreground">No data</p>
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={orgTypeData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                      <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-15} textAnchor="end" height={50} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                      <Tooltip />
                      <Bar dataKey="value" fill="oklch(0.60 0.12 280)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </>
        )}

        {activeChart === 'engagement' && (
          <>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Top Customers by Orders</CardTitle>
                <CardDescription>Click a bar to open customer profile</CardDescription>
              </CardHeader>
              <CardContent>
                {engagementData.length === 0 ? (
                  <p className="py-12 text-center text-sm text-muted-foreground">No data</p>
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={engagementData} layout="vertical" margin={{ left: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" horizontal={false} />
                      <XAxis type="number" allowDecimals={false} tick={{ fontSize: 10 }} />
                      <YAxis type="category" dataKey="name" width={88} tick={{ fontSize: 10 }} />
                      <Tooltip />
                      <Bar
                        dataKey="orders"
                        fill="oklch(0.62 0.15 250)"
                        radius={[0, 4, 4, 0]}
                        className="cursor-pointer"
                        onClick={(data) => {
                          const id = (data as { customerId?: number }).customerId;
                          if (id) router.push(`/customers/${id}`);
                        }}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Customers by Country</CardTitle>
                <CardDescription>Geographic distribution</CardDescription>
              </CardHeader>
              <CardContent>
                {countryData.length === 0 ? (
                  <p className="py-12 text-center text-sm text-muted-foreground">No country data</p>
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={countryData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                      <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                      <Tooltip />
                      <Bar dataKey="value" fill="oklch(0.65 0.15 165)" radius={[4, 4, 0, 0]} />
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
                <CardTitle className="text-sm font-medium">Orders vs Projects</CardTitle>
                <CardDescription>Engagement depth per top customer</CardDescription>
              </CardHeader>
              <CardContent>
                {engagementData.length === 0 ? (
                  <p className="py-12 text-center text-sm text-muted-foreground">No data</p>
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={engagementData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                      <XAxis dataKey="name" tick={{ fontSize: 9 }} interval={0} angle={-20} textAnchor="end" height={55} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                      <Tooltip />
                      <Bar dataKey="orders" fill="oklch(0.62 0.15 250)" radius={[4, 4, 0, 0]} name="Orders" />
                      <Bar dataKey="projects" fill="oklch(0.65 0.15 165)" radius={[4, 4, 0, 0]} name="Projects" />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Customer Directory</CardTitle>
                <CardDescription>Quick navigation to profiles</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {customers.slice(0, 6).map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    className="flex w-full items-center justify-between rounded-lg border p-2 text-left text-sm hover:bg-muted/50"
                    onClick={() => router.push(`/customers/${c.id}`)}
                  >
                    <span className="truncate font-medium">{c.name}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">{c.status_name}</span>
                  </button>
                ))}
              </CardContent>
            </Card>
          </>
        )}

        {activeChart === 'timeline' && (
          <Card className="lg:col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Customer Growth</CardTitle>
              <CardDescription>New customers added per month</CardDescription>
            </CardHeader>
            <CardContent>
              {timelineData.length === 0 ? (
                <p className="py-12 text-center text-sm text-muted-foreground">No creation dates recorded</p>
              ) : (
                <ResponsiveContainer width="100%" height={240}>
                  <AreaChart data={timelineData}>
                    <defs>
                      <linearGradient id="customersPageFill" x1="0" y1="0" x2="0" y2="1">
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
                      stroke="oklch(0.65 0.15 165)"
                      fill="url(#customersPageFill)"
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

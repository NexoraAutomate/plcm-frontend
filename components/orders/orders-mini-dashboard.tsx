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
  ShoppingCart,
  Rocket,
  DollarSign,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { Customer, Order, Project, Status } from '@/lib/models';
import { CHART_COLORS } from '@/lib/dashboard-chart-theme';

const ORDER_STATUS_COLORS: Record<string, string> = {
  Created: 'oklch(0.55 0.02 250)',
  Confirmed: 'oklch(0.62 0.15 250)',
  Processing: 'oklch(0.70 0.18 45)',
  Shipped: 'oklch(0.60 0.12 280)',
  Delivered: 'oklch(0.65 0.15 165)',
  Cancelled: 'oklch(0.55 0.2 15)',
};

interface OrdersMiniDashboardProps {
  orders: Order[];
  projects: Project[];
  customers: Customer[];
  orderStatuses: Status[];
  activeOrderStatusId: string;
  activeCustomerId: string;
  onOrderStatusFilter: (statusId: string) => void;
  onCustomerFilter: (customerId: string) => void;
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

export function OrdersMiniDashboard({
  orders,
  projects,
  customers,
  orderStatuses,
  activeOrderStatusId,
  activeCustomerId,
  onOrderStatusFilter,
  onCustomerFilter,
}: OrdersMiniDashboardProps) {
  const router = useRouter();
  const [activeChart, setActiveChart] = useState<'orders' | 'projects' | 'customers' | 'timeline'>(
    'orders'
  );

  const getOrderStatusName = (order: Order) =>
    orderStatuses.find((s) => s.id === order.status_id)?.status_name ??
    order.status_name ??
    'Unknown';

  const orderStatusData = useMemo(() => {
    const counts = new Map<string, { name: string; value: number; statusId: number }>();
    for (const status of orderStatuses) {
      counts.set(status.status_name, { name: status.status_name, value: 0, statusId: status.id });
    }
    for (const order of orders) {
      const name = getOrderStatusName(order);
      const entry = counts.get(name) ?? { name, value: 0, statusId: order.status_id ?? 0 };
      entry.value += 1;
      counts.set(name, entry);
    }
    return Array.from(counts.values()).filter((d) => d.value > 0);
  }, [orders, orderStatuses]);

  const projectStatusData = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of projects) {
      const name = p.status_name ?? 'Unknown';
      counts.set(name, (counts.get(name) ?? 0) + 1);
    }
    return Array.from(counts.entries()).map(([name, value]) => ({ name, value }));
  }, [projects]);

  const customerOrderData = useMemo(() => {
    const counts = new Map<number, { name: string; value: number; customerId: number }>();
    for (const order of orders) {
      if (!order.customer_id) continue;
      const customer = customers.find((c) => c.id === order.customer_id);
      const name = customer?.name ?? `Customer ${order.customer_id}`;
      const entry = counts.get(order.customer_id) ?? {
        name,
        value: 0,
        customerId: order.customer_id,
      };
      entry.value += 1;
      counts.set(order.customer_id, entry);
    }
    return Array.from(counts.values())
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }, [orders, customers]);

  const ordersTimeline = useMemo(() => {
    const byMonth = new Map<string, number>();
    for (const order of orders) {
      if (!order.order_date) continue;
      const key = order.order_date.slice(0, 7);
      byMonth.set(key, (byMonth.get(key) ?? 0) + 1);
    }
    return Array.from(byMonth.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, value]) => ({ name, value }));
  }, [orders]);

  const orderValueData = useMemo(
    () =>
      [...orders]
        .filter((o) => o.total_value != null && o.total_value > 0)
        .sort((a, b) => (b.total_value ?? 0) - (a.total_value ?? 0))
        .slice(0, 6)
        .map((o) => ({
          name: o.order_number?.slice(0, 12) ?? `Order ${o.id}`,
          value: o.total_value ?? 0,
          id: o.id,
        })),
    [orders]
  );

  const totalValue = orders.reduce((sum:number, o:Order) => sum + Number(o.total_value ?? 0), 0);
  console.log(totalValue);
  const uniqueCustomers = new Set(orders.map((o) => o.customer_id).filter(Boolean)).size;
  const deliveredCount = orders.filter((o) => getOrderStatusName(o) === 'Delivered').length;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiTile
          label="Total Orders"
          value={orders.length}
          sub="Click chart to filter"
          icon={ShoppingCart}
          active={activeOrderStatusId === 'all' && activeCustomerId === 'all'}
          onClick={() => {
            onOrderStatusFilter('all');
            onCustomerFilter('all');
          }}
        />
        <KpiTile
          label="Linked Projects"
          value={projects.length}
          sub="Across all orders"
          icon={Rocket}
          onClick={() => router.push('/projects')}
        />
        <KpiTile
          label="Pipeline Value"
          value={totalValue > 0 ? totalValue.toLocaleString() : '—'}
          sub={`${deliveredCount} delivered`}
          icon={DollarSign}
        />
        <KpiTile
          label="Customers"
          value={uniqueCustomers}
          sub="With active orders"
          icon={Users}
          active={activeCustomerId !== 'all'}
          onClick={() => onCustomerFilter('all')}
        />
      </div>

      <div className="flex flex-wrap gap-2">
        {(['orders', 'projects', 'customers', 'timeline'] as const).map((key) => (
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
            {key === 'timeline' ? 'Order timeline' : `${key} chart`}
          </button>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {activeChart === 'orders' && (
          <>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Orders by Status</CardTitle>
                <CardDescription>Click a segment to filter the table below</CardDescription>
              </CardHeader>
              <CardContent>
                {orderStatusData.length === 0 ? (
                  <p className="py-12 text-center text-sm text-muted-foreground">No orders yet</p>
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie
                        data={orderStatusData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={80}
                        paddingAngle={2}
                        className="cursor-pointer"
                        onClick={(_, index) => {
                          const entry = orderStatusData[index];
                          if (entry?.statusId) onOrderStatusFilter(String(entry.statusId));
                        }}
                      >
                        {orderStatusData.map((entry, i) => (
                          <Cell
                            key={entry.name}
                            fill={
                              ORDER_STATUS_COLORS[entry.name] ??
                              CHART_COLORS[i % CHART_COLORS.length]
                            }
                            opacity={
                              activeOrderStatusId !== 'all' &&
                              String(entry.statusId) !== activeOrderStatusId
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
                <CardTitle className="text-sm font-medium">Top Orders by Value</CardTitle>
                <CardDescription>Click a bar to view projects for that order</CardDescription>
              </CardHeader>
              <CardContent>
                {orderValueData.length === 0 ? (
                  <p className="py-12 text-center text-sm text-muted-foreground">No value data</p>
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={orderValueData} layout="vertical" margin={{ left: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" horizontal={false} />
                      <XAxis type="number" tick={{ fontSize: 10 }} />
                      <YAxis type="category" dataKey="name" width={72} tick={{ fontSize: 10 }} />
                      <Tooltip formatter={(v: number) => [v.toLocaleString(), 'Value']} />
                      <Bar
                        dataKey="value"
                        fill="oklch(0.62 0.15 250)"
                        radius={[0, 4, 4, 0]}
                        className="cursor-pointer"
                        onClick={(data) => {
                          const id = (data as { id?: number }).id;
                          if (id) router.push(`/projects?order_id=${id}`);
                        }}
                      />
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
                <CardTitle className="text-sm font-medium">Projects by Status</CardTitle>
                <CardDescription>Lifecycle across all orders</CardDescription>
              </CardHeader>
              <CardContent>
                {projectStatusData.length === 0 ? (
                  <p className="py-12 text-center text-sm text-muted-foreground">No projects yet</p>
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={projectStatusData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                      <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-15} textAnchor="end" height={50} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                      <Tooltip />
                      <Bar
                        dataKey="value"
                        fill="oklch(0.65 0.15 165)"
                        radius={[4, 4, 0, 0]}
                        className="cursor-pointer"
                        onClick={() => router.push('/projects')}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Recent Projects</CardTitle>
                <CardDescription>Quick access to linked projects</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {projects.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">No projects yet</p>
                ) : (
                  projects.slice(0, 6).map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      className="flex w-full items-center gap-2 rounded-lg border p-2 text-left text-sm hover:bg-muted/50"
                      onClick={() => router.push(`/projects/${p.id}`)}
                    >
                      <span className="min-w-0 flex-1 truncate font-medium">{p.name}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">{p.status_name}</span>
                      <span className="tabular-nums text-muted-foreground">{p.progress ?? 0}%</span>
                    </button>
                  ))
                )}
              </CardContent>
            </Card>
          </>
        )}

        {activeChart === 'customers' && (
          <>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Orders by Customer</CardTitle>
                <CardDescription>Click a bar to filter orders for that customer</CardDescription>
              </CardHeader>
              <CardContent>
                {customerOrderData.length === 0 ? (
                  <p className="py-12 text-center text-sm text-muted-foreground">No customer data</p>
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={customerOrderData} layout="vertical" margin={{ left: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" horizontal={false} />
                      <XAxis type="number" allowDecimals={false} tick={{ fontSize: 10 }} />
                      <YAxis type="category" dataKey="name" width={88} tick={{ fontSize: 10 }} />
                      <Tooltip />
                      <Bar
                        dataKey="value"
                        fill="oklch(0.60 0.12 280)"
                        radius={[0, 4, 4, 0]}
                        className="cursor-pointer"
                        onClick={(data) => {
                          const id = (data as { customerId?: number }).customerId;
                          if (id) onCustomerFilter(String(id));
                        }}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Customer Directory</CardTitle>
                <CardDescription>Open customer profile</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {customerOrderData.map((row) => (
                  <button
                    key={row.customerId}
                    type="button"
                    className={cn(
                      'flex w-full items-center justify-between rounded-lg border p-2 text-left text-sm hover:bg-muted/50',
                      activeCustomerId === String(row.customerId) && 'ring-2 ring-primary/30'
                    )}
                    onClick={() => router.push(`/customers/${row.customerId}`)}
                  >
                    <span className="font-medium">{row.name}</span>
                    <span className="text-muted-foreground">{row.value} orders</span>
                  </button>
                ))}
              </CardContent>
            </Card>
          </>
        )}

        {activeChart === 'timeline' && (
          <Card className="lg:col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Orders Over Time</CardTitle>
              <CardDescription>Monthly order volume</CardDescription>
            </CardHeader>
            <CardContent>
              {ordersTimeline.length === 0 ? (
                <p className="py-12 text-center text-sm text-muted-foreground">No order dates recorded</p>
              ) : (
                <ResponsiveContainer width="100%" height={240}>
                  <AreaChart data={ordersTimeline}>
                    <defs>
                      <linearGradient id="ordersPageFill" x1="0" y1="0" x2="0" y2="1">
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
                      fill="url(#ordersPageFill)"
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

'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useDataStore } from '@/lib/data-store';
import { KPICard } from '@/components/kpi-card';
import { MaintenanceMiniDashboard } from '@/components/maintenance/MaintenanceMiniDashboard';
import { StatusBadge } from '@/components/status-badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Rocket,
  Package,
  Wrench,
  AlertTriangle,
  Zap,
  Pause,
  CheckCircle,
  Clock,
  Users,
  UserCheck,
  ShoppingCart,
  Network,
  AlertCircle,
  ArrowRight,
} from 'lucide-react';
import {
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import {
  getProjectStatusCounts,
  getInProgressProjectCount,
  getCompletedProjectCount,
  getActiveProjectCount,
  getMaintenanceStatusCounts,
  getOpenMaintenanceCaseCount,
  getCustomerStatusCounts,
  getActiveCustomerCount,
  getOrderStatusCounts,
  getActiveFaultyEntityCount,
  getInventoryTotal,
  getHardwareFleetCounts,
  projectStatusToChartData,
  maintenanceStatusToChartData,
  groupOrdersByMonth,
  getRecentMaintenanceCases,
  getRecentOrders,
} from '@/lib/dashboard-stats';

const PIE_COLORS = [
  'oklch(0.62 0.15 250)',
  'oklch(0.55 0.14 250)',
  'oklch(0.65 0.15 165)',
  'oklch(0.70 0.18 45)',
  'oklch(0.55 0.2 15)',
  'oklch(0.60 0.12 280)',
];

const CUSTOMER_STATUS_ICONS: Record<string, typeof Users> = {
  Active: UserCheck,
  Inactive: Users,
  Prospect: Users,
  Blacklisted: AlertCircle,
};

const ORDER_STATUS_COLORS: Record<string, 'blue' | 'green' | 'red' | 'amber' | 'orange' | 'slate' | 'emerald'> = {
  Created: 'blue',
  Confirmed: 'emerald',
  Processing: 'amber',
  Shipped: 'orange',
  Delivered: 'green',
  Cancelled: 'red',
};

export default function DashboardPage() {
  const router = useRouter();
  const {
    customers,
    orders,
    projects,
    systems,
    subsystems,
    modules,
    units,
    components,
    inventory,
    maintenanceCases,
    faultyEntities,
    statuses,
    loading,
  } = useDataStore();

  if (loading) return <div className="p-8 text-center">Loading...</div>;

  const totalProjects = projects.length;
  const totalOrders = orders.length;
  const totalCustomers = customers.length;
  const inventoryItems = getInventoryTotal(inventory);
  const inProgressProjects = getInProgressProjectCount(projects);
  const completedProjects = getCompletedProjectCount(projects);
  const activeProjects = getActiveProjectCount(projects);
  const activeCustomers = getActiveCustomerCount(customers, statuses);
  const openMaintenanceCases = getOpenMaintenanceCaseCount(maintenanceCases);
  const activeFaultyEntities = getActiveFaultyEntityCount(faultyEntities);

  const projectStatuses = getProjectStatusCounts(projects);
  const customerStatuses = getCustomerStatusCounts(customers, statuses);
  const orderStatuses = getOrderStatusCounts(orders, statuses);
  const maintenanceStatuses = getMaintenanceStatusCounts(maintenanceCases);

  const projectStatusData = projectStatusToChartData(projectStatuses);
  const maintenanceStatusData = maintenanceStatusToChartData(maintenanceStatuses);
  const monthlyOrdersData = groupOrdersByMonth(orders, 6);
  const hardwareFleetData = getHardwareFleetCounts({
    systems,
    subsystems,
    modules,
    units,
    components,
  });

  const recentCases = getRecentMaintenanceCases(maintenanceCases, 5);
  const recentOrders = getRecentOrders(orders, 5);

  const handleNavigate = (path: string) => router.push(path);

  const handleMaintenanceFilter = (status: string) => {
    router.push(status === 'all' ? '/maintenance' : `/maintenance?status=${status}`);
  };

  const executiveKPIs = [
    {
      title: 'Total Customers',
      value: totalCustomers,
      icon: Users,
      color: 'blue' as const,
      href: '/customers',
      subtitle: `${activeCustomers} active`,
    },
    {
      title: 'Active Customers',
      value: activeCustomers,
      icon: UserCheck,
      color: 'emerald' as const,
      href: '/customers',
      subtitle: 'Currently active',
    },
    {
      title: 'Total Orders',
      value: totalOrders,
      icon: ShoppingCart,
      color: 'blue' as const,
      href: '/orders',
      subtitle: 'All orders',
    },
    {
      title: 'Active Projects',
      value: activeProjects,
      icon: Rocket,
      color: 'amber' as const,
      href: '/projects',
      subtitle: `${inProgressProjects} in execution`,
    },
    {
      title: 'Open Cases',
      value: openMaintenanceCases,
      icon: AlertCircle,
      color: 'orange' as const,
      href: '/maintenance?status=open',
      subtitle: 'Maintenance cases',
    },
    {
      title: 'Total Systems',
      value: systems.length,
      icon: Network,
      color: 'blue' as const,
      href: '/systems',
      subtitle: 'Hardware systems',
    },
    {
      title: 'Faulty Entities',
      value: activeFaultyEntities,
      icon: Wrench,
      color: 'red' as const,
      href: '/maintenance',
      subtitle: 'Under investigation',
    },
    {
      title: 'Inventory Units',
      value: inventoryItems,
      icon: Package,
      color: 'slate' as const,
      href: '/inventory',
      subtitle: 'Total quantity',
    },
  ];

  const customerStatusItems = Object.entries(customerStatuses).filter(([, count]) => count > 0);
  const orderStatusItems = Object.entries(orderStatuses).filter(([, count]) => count > 0);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Executive Dashboard</h1>
        <p className="text-muted-foreground mt-2">
          Overview of customers, projects, maintenance, and fleet operations
        </p>
      </div>

      {/* Executive KPI strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {executiveKPIs.map((kpi) => (
          <button
            key={kpi.title}
            onClick={() => handleNavigate(kpi.href)}
            className="cursor-pointer transition-transform hover:scale-[1.02] text-left"
          >
            <KPICard
              title={kpi.title}
              value={kpi.value}
              change={0}
              icon={kpi.icon}
              accentColor={kpi.color}
            />
          </button>
        ))}
      </div>

      {/* Maintenance Cases */}
      <Card>
        <CardHeader>
          <CardTitle>Maintenance Cases</CardTitle>
          <CardDescription>Click a status to filter the maintenance list</CardDescription>
        </CardHeader>
        <CardContent>
          <MaintenanceMiniDashboard
            cases={maintenanceCases}
            onStatusFilter={handleMaintenanceFilter}
          />
        </CardContent>
      </Card>

      {/* Customer & Order status breakdowns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Customer Status</CardTitle>
            <CardDescription>Breakdown by customer account status</CardDescription>
          </CardHeader>
          <CardContent>
            {customerStatusItems.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {customerStatusItems.map(([status, count]) => (
                  <button
                    key={status}
                    onClick={() => handleNavigate('/customers')}
                    className="cursor-pointer transition-transform hover:scale-[1.02] text-left"
                  >
                    <KPICard
                      title={status}
                      value={count}
                      change={totalCustomers > 0 ? Math.round((100 * count) / totalCustomers) : 0}
                      icon={CUSTOMER_STATUS_ICONS[status] ?? Users}
                      accentColor={
                        status === 'Active'
                          ? 'green'
                          : status === 'Inactive'
                            ? 'slate'
                            : status === 'Blacklisted'
                              ? 'red'
                              : 'blue'
                      }
                    />
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground py-4">No customer data available</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Order Status</CardTitle>
            <CardDescription>Breakdown by order lifecycle stage</CardDescription>
          </CardHeader>
          <CardContent>
            {orderStatusItems.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {orderStatusItems.map(([status, count]) => (
                  <button
                    key={status}
                    onClick={() => handleNavigate('/orders')}
                    className="cursor-pointer transition-transform hover:scale-[1.02] text-left"
                  >
                    <KPICard
                      title={status}
                      value={count}
                      change={totalOrders > 0 ? Math.round((100 * count) / totalOrders) : 0}
                      icon={Package}
                      accentColor={ORDER_STATUS_COLORS[status] ?? 'blue'}
                    />
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground py-4">No order data available</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Project Status Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Project Status Breakdown</CardTitle>
          <CardDescription>Click on a status card to filter projects</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {(
              [
                { status: 'Initiation', icon: Clock, color: 'text-blue-500' },
                { status: 'Planning', icon: Rocket, color: 'text-amber-500' },
                { status: 'Execution', icon: Zap, color: 'text-yellow-500' },
                { status: 'Monitoring', icon: AlertTriangle, color: 'text-orange-500' },
                { status: 'Completed', icon: CheckCircle, color: 'text-green-500' },
                { status: 'On Hold', icon: Pause, color: 'text-red-500' },
              ] as const
            ).map(({ status, icon: Icon, color }) => (
              <button
                key={status}
                onClick={() =>
                  handleNavigate(
                    `/projects?status=${encodeURIComponent(status)}`
                  )
                }
                className="text-left cursor-pointer transition-transform hover:scale-105"
              >
                <Card className="hover:shadow-lg">
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">{status}</p>
                        <p className="text-2xl font-bold">{projectStatuses[status] ?? 0}</p>
                      </div>
                      <Icon className={`h-8 w-8 ${color}`} />
                    </div>
                  </CardContent>
                </Card>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Project Status Distribution</CardTitle>
            <CardDescription>Current status of all projects</CardDescription>
          </CardHeader>
          <CardContent>
            {projectStatusData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={projectStatusData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, value }) => `${name}: ${value}`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {projectStatusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                No project data available
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Maintenance Cases by Status</CardTitle>
            <CardDescription>Distribution of maintenance case statuses</CardDescription>
          </CardHeader>
          <CardContent>
            {maintenanceStatusData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={maintenanceStatusData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" allowDecimals={false} />
                  <YAxis type="category" dataKey="label" width={120} />
                  <Tooltip />
                  <Bar dataKey="value" fill="oklch(0.62 0.15 250)" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                No maintenance case data available
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Orders Trend</CardTitle>
            <CardDescription>Order volume over the last 6 months</CardDescription>
          </CardHeader>
          <CardContent>
            {monthlyOrdersData.some((d) => d.orders > 0) ? (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={monthlyOrdersData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Line
                    type="monotone"
                    dataKey="orders"
                    stroke="oklch(0.62 0.15 250)"
                    strokeWidth={2}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                No order data available
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Hardware Fleet Overview</CardTitle>
            <CardDescription>Systems hierarchy entity counts</CardDescription>
          </CardHeader>
          <CardContent>
            {hardwareFleetData.some((d) => d.count > 0) ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={hardwareFleetData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="count" fill="oklch(0.65 0.15 165)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                No hardware fleet data available
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Project Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Project Summary</CardTitle>
          <CardDescription>Current project metrics</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Total Projects</p>
              <p className="text-2xl font-bold">{totalProjects}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">In Progress</p>
              <p className="text-2xl font-bold text-blue-600">{inProgressProjects}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Completed</p>
              <p className="text-2xl font-bold text-green-600">{completedProjects}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Completion Rate</p>
              <p className="text-2xl font-bold">
                {totalProjects > 0
                  ? `${Math.round((completedProjects / totalProjects) * 100)}%`
                  : '0%'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Recent Maintenance Cases</CardTitle>
              <CardDescription>Latest reported cases</CardDescription>
            </div>
            <Link href="/maintenance">
              <span className="text-sm text-primary flex items-center gap-1 hover:underline">
                View all <ArrowRight className="h-3 w-3" />
              </span>
            </Link>
          </CardHeader>
          <CardContent>
            {recentCases.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Case #</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Reported</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentCases.map((caseItem) => {
                    const project = projects.find((p) => p.id === caseItem.project_id);
                    return (
                      <TableRow key={caseItem.id}>
                        <TableCell>
                          <Link
                            href={`/maintenance/cases/${caseItem.id}`}
                            className="font-medium hover:underline"
                          >
                            {caseItem.case_number}
                          </Link>
                          {project && (
                            <p className="text-xs text-muted-foreground truncate max-w-[140px]">
                              {project.name}
                            </p>
                          )}
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={caseItem.status} />
                        </TableCell>
                        <TableCell className="text-right text-sm text-muted-foreground">
                          {caseItem.reported_at
                            ? new Date(caseItem.reported_at).toLocaleDateString()
                            : '—'}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            ) : (
              <p className="text-sm text-muted-foreground py-4">No maintenance cases yet</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Recent Orders</CardTitle>
              <CardDescription>Latest customer orders</CardDescription>
            </div>
            <Link href="/orders">
              <span className="text-sm text-primary flex items-center gap-1 hover:underline">
                View all <ArrowRight className="h-3 w-3" />
              </span>
            </Link>
          </CardHeader>
          <CardContent>
            {recentOrders.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Order #</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentOrders.map((order) => {
                    const customer = customers.find((c) => c.id === order.customer_id);
                    return (
                      <TableRow key={order.id}>
                        <TableCell>
                          <Link href="/orders" className="font-medium hover:underline">
                            {order.order_number}
                          </Link>
                          {customer && (
                            <p className="text-xs text-muted-foreground truncate max-w-[140px]">
                              {customer.name}
                            </p>
                          )}
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={order.status_name || 'Unknown'} />
                        </TableCell>
                        <TableCell className="text-right text-sm text-muted-foreground">
                          {order.order_date
                            ? new Date(order.order_date).toLocaleDateString()
                            : '—'}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            ) : (
              <p className="text-sm text-muted-foreground py-4">No orders yet</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

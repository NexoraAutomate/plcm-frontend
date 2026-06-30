import type { ActivityItem, ChartDataPoint, TreemapNode } from '@/lib/types/dashboard';
import type { Customer, Order, Project, User } from '@/lib/models';

const HREF_MAP: Record<string, string> = {
  customers: '/customers',
  orders: '/orders',
  projects: '/projects',
  systems: '/systems',
  subsystems: '/subsystems',
  modules: '/modules',
  units: '/units',
  components: '/components',
};

export const KPI_ROUTES: Record<string, string> = {
  total_customers: '/customers',
  total_orders: '/orders',
  total_projects: '/projects',
  active_projects: '/projects',
  completed_projects: '/projects?status=Completed',
  delayed_projects: '/projects',
  open_maintenance_cases: '/maintenance?status=open',
  open_faulty_entities: '/maintenance',
  components_under_investigation: '/maintenance',
  config_changes_this_month: '/maintenance',
};

export function kpiRoute(key: string): string {
  return KPI_ROUTES[key] ?? '/executive-dashboard';
}

export function activityLink(item: ActivityItem): string {
  switch (item.link_type) {
    case 'maintenance_case':
      return `/maintenance/cases/${item.link_id}`;
    case 'project':
      return `/projects/${item.link_id}`;
    case 'faulty_entity':
      return `/maintenance/cases/${item.link_id}`;
    case 'entity':
      return '/maintenance';
    default:
      return '/maintenance';
  }
}

export function treemapLink(node: TreemapNode): string {
  const base = HREF_MAP[node.href_key ?? ''] ?? '/customers';
  return node.id ? `${base}/${node.id}` : base;
}

export function projectStatusLink(status: string): string {
  return `/projects?status=${encodeURIComponent(status)}`;
}

export function maintenanceStatusLink(status: string): string {
  return `/maintenance?status=${encodeURIComponent(status)}`;
}

export function chartPointLink(
  item: ChartDataPoint,
  fallback: string
): string {
  if (item.id != null) {
    return fallback.replace(/\/$/, '') + `/${item.id}`;
  }
  return fallback;
}

export function customerLinkByName(
  name: string,
  customers: Customer[]
): string | null {
  const match = customers.find((customer) => customer.name === name);
  return match ? `/customers/${match.id}` : null;
}

export function orderLinkByNumber(
  orderNumber: string,
  orders: Order[]
): string | null {
  const match = orders.find((order) => order.order_number === orderNumber);
  return match ? `/orders/${match.id}` : null;
}

export function projectLinkByName(
  name: string,
  projects: Project[]
): string | null {
  const match = projects.find((project) => project.name === name);
  return match ? `/projects/${match.id}` : null;
}

export function projectLinkByOwnerName(
  ownerName: string,
  projects: Project[],
  users: User[]
): string {
  if (!ownerName || ownerName === 'Unassigned') return '/projects';
  const user = users.find(
    (entry) => entry.full_name === ownerName || entry.username === ownerName
  );
  if (!user) return '/projects';
  const owned = projects.find((project) => project.owner_id === user.id);
  return owned ? `/projects/${owned.id}` : '/projects';
}

export function resourceBarLink(
  title: string,
  item: ChartDataPoint,
  context: {
    customers: Customer[];
    orders: Order[];
    projects: Project[];
    users: User[];
  }
): string {
  if (item.id != null) {
    if (title === 'Projects by Customer') return `/customers/${item.id}`;
    if (title === 'Projects by Order') return `/orders/${item.id}`;
    if (title === 'Projects by Owner') {
      const user = context.users.find((entry) => entry.id === item.id);
      if (user) {
        const owned = context.projects.find((project) => project.owner_id === user.id);
        if (owned) return `/projects/${owned.id}`;
      }
      return '/projects';
    }
  }

  if (title === 'Projects by Customer') {
    return customerLinkByName(item.name, context.customers) ?? '/customers';
  }
  if (title === 'Projects by Order') {
    return orderLinkByNumber(item.name, context.orders) ?? '/orders';
  }
  if (title === 'Projects by Owner') {
    return projectLinkByOwnerName(item.name, context.projects, context.users);
  }
  return '/projects';
}

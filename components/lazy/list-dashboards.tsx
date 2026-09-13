'use client';

import dynamic from 'next/dynamic';

function DashboardSkeleton() {
  return <div className="mb-4 h-40 animate-pulse rounded-lg bg-muted/40" aria-hidden />;
}

export const SystemsListDashboard = dynamic(
  () =>
    import('@/components/systems/systems-list-dashboard').then((m) => ({
      default: m.SystemsListDashboard,
    })),
  { ssr: false, loading: DashboardSkeleton }
);

export const ProjectsMiniDashboard = dynamic(
  () =>
    import('@/components/projects/projects-mini-dashboard').then((m) => ({
      default: m.ProjectsMiniDashboard,
    })),
  { ssr: false, loading: DashboardSkeleton }
);

export const CustomersListDashboard = dynamic(
  () =>
    import('@/components/customers/customers-list-dashboard').then((m) => ({
      default: m.CustomersListDashboard,
    })),
  { ssr: false, loading: DashboardSkeleton }
);

export const CustomerMiniDashboard = dynamic(
  () =>
    import('@/components/customers/customer-mini-dashboard').then((m) => ({
      default: m.CustomerMiniDashboard,
    })),
  { ssr: false, loading: DashboardSkeleton }
);

export const OrdersMiniDashboard = dynamic(
  () =>
    import('@/components/orders/orders-mini-dashboard').then((m) => ({
      default: m.OrdersMiniDashboard,
    })),
  { ssr: false, loading: DashboardSkeleton }
);

export const HierarchyListDashboard = dynamic(
  () =>
    import('@/components/hierarchy/hierarchy-list-dashboard').then((m) => ({
      default: m.HierarchyListDashboard,
    })),
  { ssr: false, loading: DashboardSkeleton }
);

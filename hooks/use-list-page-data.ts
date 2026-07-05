'use client';

import type { Customer, Order, Project } from '@/lib/models';
import { LIST_BOOTSTRAP_SIZE } from '@/lib/data-loading';
import {
  useCustomersQuery,
  useOrdersQuery,
  useProjectsQuery,
} from '@/hooks/queries';

/** Prefer store data after mutations; fall back to TanStack query cache. */
export function useCustomersListData(storeCustomers: Customer[], storeLoading: boolean) {
  const { data: queryData = [], isLoading: queryLoading } = useCustomersQuery(0, LIST_BOOTSTRAP_SIZE);
  const customers = storeCustomers.length > 0 ? storeCustomers : queryData;
  const loading = storeLoading && queryLoading && customers.length === 0;
  return { customers, loading };
}

export function useOrdersListData(storeOrders: Order[], storeLoading: boolean) {
  const { data: queryData = [], isLoading: queryLoading } = useOrdersQuery(0, LIST_BOOTSTRAP_SIZE);
  const orders = storeOrders.length > 0 ? storeOrders : queryData;
  const loading = storeLoading && queryLoading && orders.length === 0;
  return { orders, loading };
}

export function useProjectsListData(storeProjects: Project[], storeLoading: boolean) {
  const { data: queryData = [], isLoading: queryLoading } = useProjectsQuery(0, LIST_BOOTSTRAP_SIZE);
  const projects = storeProjects.length > 0 ? storeProjects : queryData;
  const loading = storeLoading && queryLoading && projects.length === 0;
  return { projects, loading };
}

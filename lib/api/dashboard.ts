import api, { buildQueryParams } from '@/lib/api';
import type {
  ExecutiveDashboardFilters,
  ExecutiveDashboardResponse,
} from '@/lib/types/dashboard';

export async function fetchExecutiveDashboard(
  filters: ExecutiveDashboardFilters = {}
): Promise<ExecutiveDashboardResponse> {
  const params = buildQueryParams(
    filters as Record<string, string | number | undefined | null>
  );
  const res = await api.get<ExecutiveDashboardResponse>('/dashboard/executive', {
    params,
  });
  return res.data;
}

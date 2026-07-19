'use client';

import { useQuery } from '@tanstack/react-query';
import { reportsApi } from '@/lib/api/reports';

export const reportQueryKeys = {
  buildHistory: (projectId: number) => ['reports', 'build-history', projectId] as const,
  maintenanceHistory: (caseId: number) =>
    ['reports', 'maintenance-history', caseId] as const,
  inventory: (params: Record<string, unknown>) =>
    ['reports', 'inventory', params] as const,
  maintenanceSummary: (params: Record<string, unknown>) =>
    ['reports', 'maintenance-summary', params] as const,
  executive: (params: Record<string, unknown>) =>
    ['reports', 'executive', params] as const,
  verify: (uuid: string) => ['reports', 'verify', uuid] as const,
};

export function useBuildHistoryReport(projectId: number | null, enabled = false) {
  return useQuery({
    queryKey: reportQueryKeys.buildHistory(projectId ?? 0),
    queryFn: async () => (await reportsApi.buildHistory(projectId!)).data,
    enabled: enabled && !!projectId,
  });
}

export function useMaintenanceHistoryReport(caseId: number | null, enabled = false) {
  return useQuery({
    queryKey: reportQueryKeys.maintenanceHistory(caseId ?? 0),
    queryFn: async () => (await reportsApi.maintenanceHistory(caseId!)).data,
    enabled: enabled && !!caseId,
  });
}

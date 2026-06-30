'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { fetchExecutiveDashboard } from '@/lib/api/dashboard';
import type {
  DashboardSectionKey,
  ExecutiveDashboardFilters,
  ExecutiveDashboardResponse,
} from '@/lib/types/dashboard';
import { KPI_SECTION_MAP } from '@/lib/dashboard-chart-theme';

const DEFAULT_FILTERS: ExecutiveDashboardFilters = {};

export function useExecutiveDashboard() {
  const [filters, setFilters] = useState<ExecutiveDashboardFilters>(DEFAULT_FILTERS);
  const [kpiFilter, setKpiFilter] = useState<string | null>(null);
  const [data, setData] = useState<ExecutiveDashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const activeFilters = useMemo(
    () => ({
      ...filters,
      kpi_filter: kpiFilter ?? undefined,
    }),
    [filters, kpiFilter]
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchExecutiveDashboard(activeFilters);
      setData(response);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to load executive dashboard';
      setError(message);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [activeFilters]);

  useEffect(() => {
    load();
  }, [load]);

  const updateFilters = useCallback((patch: Partial<ExecutiveDashboardFilters>) => {
    setFilters((prev) => {
      const next = { ...prev, ...patch };
      (Object.keys(patch) as (keyof ExecutiveDashboardFilters)[]).forEach((key) => {
        const value = patch[key];
        if (value === undefined || value === null || value === '') {
          delete next[key];
        }
      });
      return next;
    });
  }, []);

  const clearFilters = useCallback(() => {
    setFilters(DEFAULT_FILTERS);
    setKpiFilter(null);
  }, []);

  const selectKpi = useCallback((key: string) => {
    setKpiFilter((prev) => (prev === key ? null : key));
  }, []);

  const highlightedSections = useMemo((): DashboardSectionKey[] => {
    if (!kpiFilter) return [];
    return (KPI_SECTION_MAP[kpiFilter] ?? []) as DashboardSectionKey[];
  }, [kpiFilter]);

  const isSectionHighlighted = useCallback(
    (section: DashboardSectionKey) => highlightedSections.includes(section),
    [highlightedSections]
  );

  return {
    data,
    loading,
    error,
    filters,
    kpiFilter,
    updateFilters,
    clearFilters,
    selectKpi,
    refetch: load,
    isSectionHighlighted,
  };
}

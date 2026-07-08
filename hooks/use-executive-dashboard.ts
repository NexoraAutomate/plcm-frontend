'use client';

import { useCallback, useMemo, useState } from 'react';
import type {
  DashboardSectionKey,
  ExecutiveDashboardFilters,
} from '@/lib/types/dashboard';
import { KPI_SECTION_MAP } from '@/lib/dashboard-chart-theme';
import { useExecutiveDashboardQuery } from '@/hooks/queries';

const DEFAULT_FILTERS: ExecutiveDashboardFilters = {};

export function useExecutiveDashboard() {
  const [filters, setFilters] = useState<ExecutiveDashboardFilters>(DEFAULT_FILTERS);
  const [kpiFilter, setKpiFilter] = useState<string | null>(null);

  const activeFilters = useMemo(
    () => ({
      ...filters,
      kpi_filter: kpiFilter ?? undefined,
    }),
    [filters, kpiFilter]
  );

  const { data, isLoading, isFetching, error, refetch } =
    useExecutiveDashboardQuery(activeFilters);

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
    data: data ?? null,
    loading: isLoading,
    fetching: isFetching,
    error: error instanceof Error ? error.message : error ? String(error) : null,
    filters,
    kpiFilter,
    updateFilters,
    clearFilters,
    selectKpi,
    refetch: () => {
      void refetch();
    },
    isSectionHighlighted,
  };
}

'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { LIST_PAGE_SIZE } from '@/lib/data-loading';
import type { ListFilterParams } from '@/lib/list-filters';
import { normalizeListFilters } from '@/lib/list-filters';
import type { PaginatedResult } from '@/lib/paginated-api';

export interface UsePaginatedListOptions<T> {
  queryKey: readonly unknown[];
  fetchPage: (skip: number, limit: number, filters?: ListFilterParams) => Promise<PaginatedResult<T>>;
  pageSize?: number;
  enabled?: boolean;
  filters?: ListFilterParams;
}

export function usePaginatedList<T>({
  queryKey,
  fetchPage,
  pageSize = LIST_PAGE_SIZE,
  enabled = true,
  filters,
}: UsePaginatedListOptions<T>) {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(0);
  const normalizedFilters = useMemo(() => normalizeListFilters(filters), [filters]);
  const filtersKey = useMemo(() => JSON.stringify(normalizedFilters ?? {}), [normalizedFilters]);

  useEffect(() => {
    setPage(0);
  }, [filtersKey]);

  const skip = page * pageSize;

  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: [...queryKey, page, pageSize],
    queryFn: () => fetchPage(skip, pageSize, normalizedFilters),
    enabled,
    placeholderData: (previous) => previous,
    retry: 1,
  });

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const hasNext = skip + items.length < total;
  const hasPrev = page > 0;

  const goToPage = useCallback(
    (nextPage: number) => {
      setPage(Math.max(0, nextPage));
    },
    []
  );

  const nextPage = useCallback(() => {
    if (hasNext) setPage((p) => p + 1);
  }, [hasNext]);

  const prevPage = useCallback(() => {
    if (hasPrev) setPage((p) => Math.max(0, p - 1));
  }, [hasPrev]);

  const invalidate = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey });
  }, [queryClient, queryKey]);

  const rangeLabel = useMemo(() => {
    if (total === 0) return '0 of 0';
    const from = skip + 1;
    const to = skip + items.length;
    return `${from}–${to} of ${total}`;
  }, [skip, items.length, total]);

  return {
    items,
    total,
    page,
    pageSize,
    totalPages,
    hasNext,
    hasPrev,
    loading: isLoading,
    fetching: isFetching,
    error,
    rangeLabel,
    goToPage,
    nextPage,
    prevPage,
    setPage,
    invalidate,
    refetch,
  };
}

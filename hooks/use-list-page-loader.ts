'use client';

interface ListPageLoaderPagination {
  loading: boolean;
  fetching: boolean;
}

interface UseListPageLoaderOptions {
  pageLoading?: boolean;
  debouncedSearch?: string;
  filtersActive?: boolean;
  /** When true, skip the initial-load loader (e.g. store already has rows). */
  hasData?: boolean;
}

/** Whether to show the full-page centered loader for list endpoints. */
export function useListPageLoader(
  pagination: ListPageLoaderPagination,
  options?: UseListPageLoaderOptions
): boolean {
  const { pageLoading, debouncedSearch, filtersActive, hasData = false } = options ?? {};

  if (pageLoading) return true;
  if (pagination.fetching && Boolean(debouncedSearch?.trim() || filtersActive)) return true;
  if (pagination.loading && !hasData) return true;
  return false;
}

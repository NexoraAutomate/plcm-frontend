'use client';

interface ListPageLoaderPagination {
  loading: boolean;
  fetching: boolean;
}

interface UseListPageLoaderOptions {
  pageLoading?: boolean;
  /** Kept for call-site compatibility; search/filter refetch no longer uses a full-page loader. */
  debouncedSearch?: string;
  filtersActive?: boolean;
  /** When true, skip the initial-load loader (e.g. store already has rows). */
  hasData?: boolean;
}

/** Full-page loader only for the first empty load — not for search or filter refetch. */
export function useListPageLoader(
  pagination: ListPageLoaderPagination,
  options?: UseListPageLoaderOptions
): boolean {
  const { pageLoading, hasData = false } = options ?? {};

  if (pageLoading) return true;
  if (pagination.loading && !hasData) return true;
  return false;
}

'use client';

import { useCallback, useMemo, useState } from 'react';
import type { ListFilterParams } from '@/lib/list-filters';
import {
  EMPTY_SORT,
  cycleSortState,
  sortRowsByState,
  sortStateToParams,
  type TableSortState,
} from '@/lib/sorting';

export interface UseTableSortingOptions {
  initial?: TableSortState;
}

export function useTableSorting(options: UseTableSortingOptions = {}) {
  const [sort, setSort] = useState<TableSortState>(options.initial ?? EMPTY_SORT);

  const cycleSort = useCallback((column: string) => {
    setSort((prev) => cycleSortState(prev, column));
  }, []);

  const clearSort = useCallback(() => {
    setSort(EMPTY_SORT);
  }, []);

  const toListFilters = useCallback((): Pick<ListFilterParams, 'sort_by' | 'sort_order'> => {
    return sortStateToParams(sort);
  }, [sort]);

  const listFilterPatch = useMemo(
    () => sortStateToParams(sort),
    [sort]
  );

  return {
    sort,
    setSort,
    cycleSort,
    clearSort,
    toListFilters,
    listFilterPatch,
    sortBy: sort.sortBy,
    sortOrder: sort.sortOrder,
  };
}

/** Client-side sort for already-loaded table rows (dialogs, queues, pages without API sort). */
export function useClientTableSort<T>(
  rows: T[],
  options: UseTableSortingOptions = {}
) {
  const sorting = useTableSorting(options);
  const sortedRows = useMemo(
    () =>
      sortRowsByState(rows as unknown as Record<string, unknown>[], sorting.sort) as T[],
    [rows, sorting.sort]
  );
  return { ...sorting, sortedRows };
}

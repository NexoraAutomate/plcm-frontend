/** Shared sorting types and helpers for server-side table sorting. */

export type SortDirection = 'asc' | 'desc';

/** Single-column sort. Ready to become SortSpec[] for multi-column later. */
export interface SortSpec {
  field: string;
  order: SortDirection;
}

export interface TableSortState {
  sortBy: string | null;
  sortOrder: SortDirection | null;
}

export const EMPTY_SORT: TableSortState = {
  sortBy: null,
  sortOrder: null,
};

/** Cycle: none → asc → desc → none */
export function cycleSortState(
  current: TableSortState,
  column: string
): TableSortState {
  if (current.sortBy !== column || current.sortOrder == null) {
    return { sortBy: column, sortOrder: 'asc' };
  }
  if (current.sortOrder === 'asc') {
    return { sortBy: column, sortOrder: 'desc' };
  }
  return EMPTY_SORT;
}

export function sortStateToParams(
  state: TableSortState
): { sort_by?: string; sort_order?: SortDirection } {
  if (!state.sortBy || !state.sortOrder) {
    return {};
  }
  return { sort_by: state.sortBy, sort_order: state.sortOrder };
}

export function ariaSortValue(
  state: TableSortState,
  column: string
): 'none' | 'ascending' | 'descending' {
  if (state.sortBy !== column || !state.sortOrder) return 'none';
  return state.sortOrder === 'asc' ? 'ascending' : 'descending';
}

function compareSortValues(av: unknown, bv: unknown, dir: number): number {
  if (av == null && bv == null) return 0;
  if (av == null) return 1;
  if (bv == null) return -1;
  if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir;
  if (typeof av === 'boolean' && typeof bv === 'boolean') {
    return (Number(av) - Number(bv)) * dir;
  }
  const as = String(av);
  const bs = String(bv);
  const aTime = Date.parse(as);
  const bTime = Date.parse(bs);
  if (!Number.isNaN(aTime) && !Number.isNaN(bTime) && /[T:\-\/]/.test(as) && /[T:\-\/]/.test(bs)) {
    return (aTime - bTime) * dir;
  }
  return as.toLowerCase().localeCompare(bs.toLowerCase()) * dir;
}

/** Client-side sort for already-loaded (non-paginated) nested table rows. */
export function sortRowsByState<T extends Record<string, unknown>>(
  rows: T[],
  state: TableSortState,
  getters?: Partial<Record<string, (row: T) => unknown>>
): T[] {
  if (!state.sortBy || !state.sortOrder) return rows;
  const key = state.sortBy;
  const dir = state.sortOrder === 'asc' ? 1 : -1;
  const getter = getters?.[key];
  return [...rows].sort((a, b) => {
    const av = getter ? getter(a) : a[key];
    const bv = getter ? getter(b) : b[key];
    return compareSortValues(av, bv, dir);
  });
}

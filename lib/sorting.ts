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

/** Client-side sort for already-loaded (non-paginated) nested table rows. */
export function sortRowsByState<T extends Record<string, unknown>>(
  rows: T[],
  state: TableSortState
): T[] {
  if (!state.sortBy || !state.sortOrder) return rows;
  const key = state.sortBy;
  const dir = state.sortOrder === 'asc' ? 1 : -1;
  return [...rows].sort((a, b) => {
    const av = a[key];
    const bv = b[key];
    if (av == null && bv == null) return 0;
    if (av == null) return 1;
    if (bv == null) return -1;
    if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir;
    if (typeof av === 'boolean' && typeof bv === 'boolean') {
      return (Number(av) - Number(bv)) * dir;
    }
    const as = String(av).toLowerCase();
    const bs = String(bv).toLowerCase();
    return as.localeCompare(bs) * dir;
  });
}

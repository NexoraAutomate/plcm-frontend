import type { AxiosResponse } from 'axios';
import type { ListFilterParams } from './list-filters';

export interface PaginatedResult<T> {
  items: T[];
  total: number;
}

/** Extract list items from plain array or `{ items }` API response shapes. */
export function unwrapListItems<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[];
  if (data && typeof data === 'object') {
    const record = data as Record<string, unknown>;
    if (Array.isArray(record.items)) return record.items as T[];
  }
  return [];
}

/** Parse total row count from common API response shapes. */
export function parseListTotal(
  response: AxiosResponse,
  items: unknown[],
  skip: number,
  limit: number
): number | null {
  const headers = response.headers ?? {};
  const headerTotal =
    headers['x-total-count'] ??
    headers['X-Total-Count'] ??
    headers['x-total'] ??
    headers['X-Total'];

  if (headerTotal != null && headerTotal !== '') {
    const parsed = Number(headerTotal);
    if (!Number.isNaN(parsed)) return parsed;
  }

  const contentRange = headers['content-range'] ?? headers['Content-Range'];
  if (typeof contentRange === 'string') {
    const match = /\/(\d+)$/.exec(contentRange);
    if (match) return Number(match[1]);
  }

  const data = response.data;
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    const record = data as Record<string, unknown>;
    if (typeof record.total === 'number') return record.total;
    if (typeof record.count === 'number') return record.count;
    if (Array.isArray(record.items)) {
      if (typeof record.total === 'number') return record.total;
      if (typeof record.count === 'number') return record.count;
    }
  }

  if (items.length < limit) {
    return skip + items.length;
  }

  return null;
}

export async function fetchPaginatedList<T>(
  listPage: (
    skip: number,
    limit: number,
    filters?: ListFilterParams
  ) => Promise<AxiosResponse<T[] | { items?: T[]; total?: number; count?: number }>>,
  skip: number,
  limit: number,
  filters?: ListFilterParams
): Promise<PaginatedResult<T>> {
  const response = await listPage(skip, limit, filters);
  const items = unwrapListItems<T>(response.data);

  const parsed = parseListTotal(response, items, skip, limit);
  if (parsed != null) {
    return { items, total: parsed };
  }

  // Last page without total metadata.
  if (items.length < limit) {
    return { items, total: skip + items.length };
  }

  return { items, total: skip + items.length + 1 };
}

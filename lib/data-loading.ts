import type { AxiosResponse } from 'axios';
import { unwrapListItems } from '@/lib/paginated-api';

/** Single-request page size for list endpoints. */
export const LIST_PAGE_SIZE = 20;

/** Page size for store bootstrap and primary list pages. */
export const LIST_BOOTSTRAP_SIZE = 100;

/** Max items pulled per hierarchy entity type during background sync. */
export const HIERARCHY_TYPE_CAP = 500;

/** Hard stop for paginated fetches (safety valve). */
export const ABSOLUTE_FETCH_CAP = 10_000;

export async function fetchCappedPages<T>(
  listPage: (skip: number, limit: number, options?: { includeTotal?: boolean }) => Promise<AxiosResponse<unknown>>,
  options?: { pageSize?: number; maxItems?: number }
): Promise<T[]> {
  const pageSize = options?.pageSize ?? LIST_PAGE_SIZE;
  const maxItems = options?.maxItems ?? ABSOLUTE_FETCH_CAP;
  const all: T[] = [];
  let skip = 0;

  while (all.length < maxItems) {
    const remaining = maxItems - all.length;
    const limit = Math.min(pageSize, remaining);
    const response = await listPage(skip, limit, { includeTotal: false });
    const page = unwrapListItems<T>(response.data);
    all.push(...page);
    if (page.length < limit) break;
    skip += page.length;
  }

  return all;
}

export async function fetchFirstPage<T>(
  listPage: (skip: number, limit: number) => Promise<AxiosResponse<unknown>>,
  limit = LIST_PAGE_SIZE
): Promise<T[]> {
  const response = await listPage(0, limit);
  return unwrapListItems<T>(response.data);
}

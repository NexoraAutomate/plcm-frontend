import * as api from '@/lib/api';

/**
 * Typeahead search for project-installed serial numbers only.
 * Never loads inventory or the full serial population (capped server-side).
 */
export async function searchProjectSerialNumbers(
  query: string,
  limit = 25
): Promise<string[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  const res = await api.entities.serialNumbers({ q, limit });
  if (!Array.isArray(res.data)) return [];

  return res.data
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value));
}

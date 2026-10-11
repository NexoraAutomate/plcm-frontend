import * as api from '@/lib/api';

/**
 * List / search installed/verified serials on completed (shipped) projects.
 * Empty query returns the full eligible list (capped server-side).
 */
export async function searchProjectSerialNumbers(
  query = '',
  limit = 500
): Promise<string[]> {
  const q = query.trim();
  const res = await api.entities.serialNumbers({
    q: q || undefined,
    limit,
  });
  if (!Array.isArray(res.data)) return [];

  return res.data
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value));
}

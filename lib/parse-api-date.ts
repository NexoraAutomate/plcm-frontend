/**
 * Parse API datetime strings into absolute instants.
 *
 * Backend should send UTC with `Z` / offset. Naive ISO values (no zone) are
 * treated as UTC only when they already end with Z via normalization; values
 * with an explicit offset are respected as-is.
 */
export function parseApiDate(value: string | Date | null | undefined): Date {
  if (value == null || value === '') return new Date(NaN);
  if (value instanceof Date) return value;

  let s = String(value).trim();
  if (!s) return new Date(NaN);

  // Normalize "YYYY-MM-DD HH:mm:ss(.sss)(+offset|Z)?" → ISO with T
  s = s.replace(/^(\d{4}-\d{2}-\d{2})[ ]+(\d{2}:\d{2}:\d{2}(?:\.\d+)?)/, '$1T$2');

  // +00:00 / -00:00 → Z
  s = s.replace(/([+-]00:00)$/, 'Z');

  // Naive ISO (no timezone) → assume UTC (backend emits UTC after normalization)
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?$/.test(s)) {
    return new Date(`${s}Z`);
  }

  return new Date(s);
}

export function formatApiDistanceToNow(
  value: string | Date | null | undefined,
  formatDistanceToNow: (
    date: Date | number,
    options?: { addSuffix?: boolean }
  ) => string
): string {
  const date = parseApiDate(value);
  if (Number.isNaN(date.getTime())) return '—';
  return formatDistanceToNow(date, { addSuffix: true });
}

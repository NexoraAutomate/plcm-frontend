/**
 * Parse API datetime strings. Backend stores UTC; naive ISO values (no Z/offset)
 * must be treated as UTC so relative times match the real event.
 */
export function parseApiDate(value: string | Date | null | undefined): Date {
  if (value == null || value === '') return new Date(NaN);
  if (value instanceof Date) return value;
  const s = String(value).trim();
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

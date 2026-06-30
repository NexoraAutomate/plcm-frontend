import type { User } from '@/lib/models';

type UserRef = string | User | null | undefined;

/** Safely display a user field that may be a string, User object, or id. */
export function formatUserRef(value: UserRef, fallback = 'Unknown'): string {
  if (value == null || value === '') return fallback;
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  if (typeof value === 'object') {
    return value.full_name || value.username || fallback;
  }
  return fallback;
}

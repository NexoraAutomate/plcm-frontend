import type { User } from '@/lib/models';

type UserRef = string | User | null | undefined;
type RoleRef = string | { name?: string } | null | undefined;

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

/** Normalize a role that may be a string or `{ name }` object. */
export function roleName(role: RoleRef): string {
  if (role == null) return '';
  if (typeof role === 'string') return role;
  return role.name ?? '';
}

/** Display role names from API (`string[]` or `RoleRead[]`). */
export function formatRoleNames(
  roles: RoleRef[] | null | undefined,
  fallback = 'No role'
): string {
  if (!roles?.length) return fallback;
  const names = roles.map(roleName).filter(Boolean);
  return names.length ? names.join(', ') : fallback;
}

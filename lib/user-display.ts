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

export function findUserById(
  users: User[],
  id?: number | string | null
): User | undefined {
  if (id == null || id === '') return undefined;
  const numericId = Number(id);
  if (!Number.isFinite(numericId)) return undefined;
  return users.find((user) => Number(user.id) === numericId);
}

/** Prefer an API-provided display name, then a loaded user record. */
export function displayUserName(
  users: User[],
  userId?: number | string | null,
  providedName?: string | null,
  fallback = '—'
): string {
  const named = providedName?.trim();
  if (named) return named;
  const user = findUserById(users, userId);
  return user ? formatUserRef(user) : fallback;
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

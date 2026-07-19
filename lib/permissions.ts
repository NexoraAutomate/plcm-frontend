'use client';

import { useAuth } from '@/lib/auth-context';
import { permissionTooltip } from '@/lib/permission-codes';

/**
 * Hook for permission checks in components.
 * Prefer `can('create_users')` over raw string comparisons.
 */
export function usePermissions() {
  const { permissions, can, hasAllPermissions, hasAccess, user } = useAuth();
  return {
    permissions,
    loading: false,
    can,
    hasAllPermissions,
    hasAccess,
    user,
    tooltip: permissionTooltip,
  };
}

/** @deprecated Use usePermissions().can or useAuth().can */
export function hasPermission(permissions: string[], required: string | string[]): boolean {
  if (Array.isArray(required)) {
    return required.some((perm) => permissions.includes(perm));
  }
  return permissions.includes(required);
}

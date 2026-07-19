'use client';

import type { ReactNode } from 'react';
import { useAuth } from '@/lib/auth-context';

interface CanProps {
  /** Permission code(s). OR match — any one grants access. */
  permission?: string | string[];
  /** Role name(s). OR match. */
  role?: string | string[];
  /** When true, every listed permission is required (AND). */
  requireAll?: boolean;
  /** Render when authorized. */
  children: ReactNode;
  /** Optional fallback when not authorized (default: hide). */
  fallback?: ReactNode;
}

/**
 * Component guard — hides children unless the user has the required permission/role.
 * Prefer this for Add/Edit/Delete buttons (hide pattern).
 */
export function Can({ permission, role, requireAll = false, children, fallback = null }: CanProps) {
  const { can, hasAllPermissions, hasAccess } = useAuth();

  let allowed = true;

  if (permission) {
    const list = Array.isArray(permission) ? permission : [permission];
    allowed = requireAll ? hasAllPermissions(list) : can(list);
  }

  if (allowed && role) {
    const roles = Array.isArray(role) ? role : [role];
    allowed = hasAccess(roles);
  }

  if (!allowed) return <>{fallback}</>;
  return <>{children}</>;
}

'use client';

import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { routePermissionForPath } from '@/lib/permission-codes';
import { AccessRestricted } from '@/components/auth/access-restricted';

/**
 * Route-level guard. Place inside the authenticated shell.
 * Renders Access Restricted when the user lacks the page's view permission.
 */
export function RoutePermissionGuard({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { can, authReady, isAuthenticated } = useAuth();

  if (!authReady || !isAuthenticated) {
    return null;
  }

  const required = routePermissionForPath(pathname);
  if (required && !can(required)) {
    return <AccessRestricted />;
  }

  return <>{children}</>;
}

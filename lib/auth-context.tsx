'use client';

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react';
import * as Models from './models';

interface AuthContextType {
  user: Models.User | null;
  permissions: string[];
  isAuthenticated: boolean;
  /** True after localStorage session hydration completes (avoids redirect churn). */
  authReady: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  /**
   * Access check. Admin role always passes.
   * - roles: user must have at least one of the roles (OR)
   * - permissions: user must have at least one of the permissions (OR)
   * - both provided: roles OR permissions must match
   */
  hasAccess: (roles?: string[], permissions?: string[]) => boolean;
  /** True if the user has every listed permission (AND). */
  hasAllPermissions: (permissions: string[]) => boolean;
  can: (permission: string | string[]) => boolean;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function normalizeRoles(roles: unknown): string[] {
  if (!Array.isArray(roles)) return [];
  return roles
    .map((r: { name?: string } | string) => (typeof r === 'string' ? r : r?.name))
    .filter((name): name is string => Boolean(name));
}

function normalizePermissions(data: {
  permissions?: string[];
  roles?: Array<{ permissions?: Array<{ name?: string } | string> } | string>;
}): string[] {
  if (Array.isArray(data.permissions) && data.permissions.length > 0) {
    return Array.from(new Set(data.permissions.filter(Boolean)));
  }
  if (!Array.isArray(data.roles)) return [];
  const nested = data.roles.flatMap((role) => {
    if (typeof role === 'string') return [];
    return (role.permissions ?? []).map((p) => (typeof p === 'string' ? p : p?.name)).filter(Boolean) as string[];
  });
  return Array.from(new Set(nested));
}

function toStoredUser(userData: Record<string, unknown>): Models.User {
  const permissions = normalizePermissions(userData as Parameters<typeof normalizePermissions>[0]);
  return {
    ...(userData as unknown as Models.User),
    roles: normalizeRoles(userData.roles),
    permissions,
  };
}

function apiBase(): string {
  return process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000/api';
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Models.User | null>(null);
  const [authReady, setAuthReady] = useState(false);

  const permissions = user?.permissions ?? [];

  const persistUser = useCallback((next: Models.User) => {
    setUser(next);
    localStorage.setItem('sat-user', JSON.stringify(next));
  }, []);

  const refreshUser = useCallback(async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      setUser(null);
      return;
    }
    try {
      const userResponse = await fetch(`${apiBase()}/auth/me/`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!userResponse.ok) {
        throw new Error('Failed to refresh user');
      }
      const userData = await userResponse.json();
      persistUser(toStoredUser(userData));
    } catch {
      setUser(null);
      localStorage.removeItem('sat-user');
      localStorage.removeItem('token');
    }
  }, [persistUser]);

  useEffect(() => {
    let cancelled = false;

    async function hydrate() {
      const stored = localStorage.getItem('sat-user');
      const token = localStorage.getItem('token');

      if (stored) {
        try {
          const parsed = JSON.parse(stored) as Models.User;
          if (!cancelled) {
            setUser({
              ...parsed,
              roles: normalizeRoles(parsed.roles),
              permissions: Array.isArray(parsed.permissions) ? parsed.permissions : [],
            });
          }
        } catch {
          localStorage.removeItem('sat-user');
          localStorage.removeItem('token');
        }
      }

      if (token) {
        try {
          const userResponse = await fetch(`${apiBase()}/auth/me/`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (userResponse.ok) {
            const userData = await userResponse.json();
            if (!cancelled) {
              persistUser(toStoredUser(userData));
            }
          } else if (!cancelled) {
            setUser(null);
            localStorage.removeItem('sat-user');
            localStorage.removeItem('token');
          }
        } catch {
          // Keep cached user if offline; permissions refresh on next successful fetch
        }
      }

      if (!cancelled) {
        setAuthReady(true);
      }
    }

    void hydrate();
    return () => {
      cancelled = true;
    };
  }, [persistUser]);

  const login = useCallback(
    async (username: string, password: string) => {
      const formData = new URLSearchParams();
      formData.append('username', username);
      formData.append('password', password);

      const response = await fetch(`${apiBase()}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Authentication failed');
      }

      const data = await response.json();
      localStorage.setItem('token', data.access_token);
      document.cookie = `token=${data.access_token}; path=/;`;

      const userResponse = await fetch(`${apiBase()}/auth/me/`, {
        headers: { Authorization: `Bearer ${data.access_token}` },
      });

      if (!userResponse.ok) {
        throw new Error('Failed to fetch user info');
      }

      const userData = await userResponse.json();
      // Prefer permissions from login token payload when /me mirrors JWT
      const merged = {
        ...userData,
        permissions: userData.permissions?.length
          ? userData.permissions
          : data.permissions ?? [],
      };
      persistUser(toStoredUser(merged));
    },
    [persistUser]
  );

  const logout = useCallback(() => {
    setUser(null);
    localStorage.removeItem('sat-user');
    localStorage.removeItem('token');
    document.cookie = 'token=; path=/; max-age=0';
  }, []);

  const isAdmin = useCallback(() => {
    return (user?.roles ?? []).some((role) => role.toLowerCase() === 'admin');
  }, [user?.roles]);

  const can = useCallback(
    (permission: string | string[]) => {
      if (!user) return false;
      if (isAdmin()) return true;
      const required = Array.isArray(permission) ? permission : [permission];
      if (required.length === 0) return true;
      const perms = user.permissions ?? [];
      return required.some((p) => perms.includes(p));
    },
    [user, isAdmin]
  );

  const hasAllPermissions = useCallback(
    (required: string[]) => {
      if (!user) return false;
      if (isAdmin()) return true;
      if (required.length === 0) return true;
      const perms = user.permissions ?? [];
      return required.every((p) => perms.includes(p));
    },
    [user, isAdmin]
  );

  const hasAccess = useCallback(
    (roles?: string[], permissionList?: string[]) => {
      if (!user) return false;
      if (isAdmin()) return true;

      const roleOk =
        !roles?.length ||
        roles.some((role) =>
          (user.roles ?? []).some((r) => r.toLowerCase() === role.toLowerCase())
        );

      const permOk =
        !permissionList?.length ||
        permissionList.some((p) => (user.permissions ?? []).includes(p));

      // If both provided, either matching role OR matching permission grants access
      if (roles?.length && permissionList?.length) return roleOk || permOk;
      if (roles?.length) return roleOk;
      if (permissionList?.length) return permOk;
      return true;
    },
    [user, isAdmin]
  );

  return (
    <AuthContext.Provider
      value={{
        user,
        permissions,
        isAuthenticated: !!user,
        authReady,
        login,
        logout,
        hasAccess,
        hasAllPermissions,
        can,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

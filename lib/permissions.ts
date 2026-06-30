import { useEffect, useState } from "react";
import { auth } from "@/lib/api";

export function usePermissions() {
  const [permissions, setPermissions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchPermissions() {
      setLoading(true);
      try {
        const res = await auth.getMe();
        // Permissions may be a flat array or nested in roles
        if (res.data && res.data.permissions) {
          setPermissions(res.data.permissions);
        } else if (res.data && res.data.roles) {
          // Aggregate permissions from all roles
          const perms = res.data.roles.flatMap((role: any) => role.permissions?.map((p: any) => p.name) || []);
          setPermissions(Array.from(new Set(perms)));
        }
      } catch {
        setPermissions([]);
      } finally {
        setLoading(false);
      }
    }
    fetchPermissions();
  }, []);

  return { permissions, loading };
}

export function hasPermission(permissions: string[], required: string | string[]): boolean {
  if (Array.isArray(required)) {
    return required.some((perm) => permissions.includes(perm));
  }
  return permissions.includes(required);
}

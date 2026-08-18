import { P, SETTINGS_ACCESS_PERMISSIONS, type PermissionCode } from '@/lib/permission-codes';
import type { LucideIcon } from 'lucide-react';
import {
  UserCog,
  Shield,
  ShieldCheck,
  Gauge,
  Bell,
  Lock,
  DatabaseBackup,
  Tags,
} from 'lucide-react';

export type SettingsTabId =
  | 'users'
  | 'roles'
  | 'role-access'
  | 'status'
  | 'alerts'
  | 'security'
  | 'definitions'
  | 'backup';

export type DefinitionsSectionId = 'labels' | 'configurations';

export type SettingsTabConfig = {
  id: SettingsTabId;
  label: string;
  description: string;
  icon: LucideIcon;
  /** Permission(s) required to see this tab (OR). Optional when `role` is set. */
  permission?: PermissionCode | PermissionCode[];
  /** Role name(s) required to see this tab (OR). */
  role?: string | string[];
};

/**
 * Canonical Settings tab registry — extend here for new tabs.
 */
export const SETTINGS_TABS: SettingsTabConfig[] = [
  {
    id: 'users',
    label: 'Users',
    description: 'Manage system users and role assignments',
    icon: UserCog,
    permission: P.view_users,
  },
  {
    id: 'roles',
    label: 'Roles',
    description: 'Create and manage roles',
    icon: Shield,
    permission: P.view_roles,
  },
  {
    id: 'role-access',
    label: 'Role Access',
    description: 'Configure what each role can view, create, edit, and delete',
    icon: ShieldCheck,
    role: 'Admin',
  },
  {
    id: 'status',
    label: 'Status',
    description: 'Manage status values by category with badge colors',
    icon: Gauge,
    permission: P.view_statuses,
  },
  {
    id: 'alerts',
    label: 'Alerts',
    description: 'Configure email and in-app notifications',
    icon: Bell,
    permission: [P.manage_notifications, P.manage_settings],
  },
  {
    id: 'security',
    label: 'Security',
    description: 'Password policy, 2FA, and sessions',
    icon: Lock,
    permission: P.manage_settings,
  },
  {
    id: 'definitions',
    label: 'Definitions',
    description: 'Level names, identifier templates, and named hierarchy configurations',
    icon: Tags,
    permission: [P.manage_settings, P.hierarchy_config_manage, P.view_hierarchy],
  },
  {
    id: 'backup',
    label: 'Backup & Restore',
    description: 'Download a full backup or restore from an archive',
    icon: DatabaseBackup,
    permission: [P.backup_database, P.restore_database],
  },
];

export { SETTINGS_ACCESS_PERMISSIONS };

export function isSettingsTabId(value: string | null | undefined): value is SettingsTabId {
  return SETTINGS_TABS.some((tab) => tab.id === value);
}

export const LEGACY_ADMIN_REDIRECTS: Record<string, SettingsTabId> = {
  '/users': 'users',
  '/roles': 'roles',
  '/statuses': 'status',
  '/hierarchy': 'definitions',
};

/** Old Settings tab ids redirected into Definitions sections. */
export const LEGACY_SETTINGS_TAB_ALIASES: Record<
  string,
  { tab: SettingsTabId; section: DefinitionsSectionId }
> = {
  hierarchy: { tab: 'definitions', section: 'configurations' },
  'hierarchy-configs': { tab: 'definitions', section: 'configurations' },
};

export function isDefinitionsSectionId(
  value: string | null | undefined
): value is DefinitionsSectionId {
  return value === 'labels' || value === 'configurations';
}

import { P, SETTINGS_ACCESS_PERMISSIONS, DEFINITIONS_ACCESS_PERMISSIONS, type PermissionCode } from '@/lib/permission-codes';
import type { LucideIcon } from 'lucide-react';
import {
  UserCog,
  Shield,
  ShieldCheck,
  Gauge,
  Bell,
  Lock,
  DatabaseBackup,
} from 'lucide-react';

export type SettingsTabId =
  | 'users'
  | 'roles'
  | 'role-access'
  | 'status'
  | 'alerts'
  | 'security'
  | 'backup';

export type DefinitionsSectionId = 'labels' | 'entity-list' | 'configurations';

export const DEFINITIONS_SECTION_META: Record<
  DefinitionsSectionId,
  { label: string; description: string; href: string }
> = {
  labels: {
    label: 'Labels & Templates',
    description: 'Level names, abbreviations, and identifier templates',
    href: '/definitions/labels',
  },
  'entity-list': {
    label: 'Entity List',
    description: 'Master catalog of hierarchy entity names',
    href: '/definitions/entity-list',
  },
  configurations: {
    label: 'Configurations',
    description: 'Named hierarchy configuration templates',
    href: '/definitions/configurations',
  },
};

export function definitionsSectionPath(section: DefinitionsSectionId): string {
  return DEFINITIONS_SECTION_META[section].href;
}

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
    id: 'backup',
    label: 'Backup & Restore',
    description: 'Download a full backup or restore from an archive',
    icon: DatabaseBackup,
    permission: [P.backup_database, P.restore_database],
  },
];

export { SETTINGS_ACCESS_PERMISSIONS, DEFINITIONS_ACCESS_PERMISSIONS };

export function isSettingsTabId(value: string | null | undefined): value is SettingsTabId {
  return SETTINGS_TABS.some((tab) => tab.id === value);
}

export const LEGACY_ADMIN_REDIRECTS: Record<string, SettingsTabId> = {
  '/users': 'users',
  '/roles': 'roles',
  '/statuses': 'status',
};

/**
 * Old Settings tab ids that now live under `/definitions`.
 * Used to redirect bookmarks like `/settings?tab=hierarchy-configs`.
 */
export const LEGACY_DEFINITIONS_TAB_ALIASES: Record<string, DefinitionsSectionId> = {
  definitions: 'labels',
  hierarchy: 'entity-list',
  'hierarchy-configs': 'configurations',
  'entity-list': 'entity-list',
};

/** @deprecated Use LEGACY_DEFINITIONS_TAB_ALIASES */
export const LEGACY_SETTINGS_TAB_ALIASES: Record<
  string,
  { tab: 'definitions'; section: DefinitionsSectionId }
> = {
  hierarchy: { tab: 'definitions', section: 'entity-list' },
  'hierarchy-configs': { tab: 'definitions', section: 'configurations' },
  'entity-list': { tab: 'definitions', section: 'entity-list' },
};

export function isDefinitionsSectionId(
  value: string | null | undefined
): value is DefinitionsSectionId {
  return value === 'labels' || value === 'entity-list' || value === 'configurations';
}

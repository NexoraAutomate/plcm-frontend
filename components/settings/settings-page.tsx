'use client';

import { useEffect, useMemo } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Settings as SettingsIcon } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AccessRestricted } from '@/components/auth/access-restricted';
import { useAuth } from '@/lib/auth-context';
import { cn } from '@/lib/utils';
import { UsersPanel } from '@/components/settings/users-panel';
import { RolesPanel } from '@/components/settings/roles-panel';
import { RoleAccessPanel } from '@/components/settings/role-access-panel';
import { PermissionsPanel } from '@/components/settings/permissions-panel';
import { StatusesPanel } from '@/components/settings/statuses-panel';
import { AlertsPanel } from '@/components/settings/alerts-panel';
import { SecurityPanel } from '@/components/settings/security-panel';
import { HierarchyPanel } from '@/components/settings/hierarchy-panel';
import {
  SETTINGS_ACCESS_PERMISSIONS,
  SETTINGS_TABS,
  isSettingsTabId,
  type SettingsTabConfig,
  type SettingsTabId,
} from '@/components/settings/settings-tabs-config';

function SettingsTabContent({ tab }: { tab: SettingsTabId }) {
  switch (tab) {
    case 'users':
      return <UsersPanel embedded />;
    case 'roles':
      return <RolesPanel embedded />;
    case 'role-access':
      return <RoleAccessPanel embedded />;
    case 'permissions':
      return <PermissionsPanel embedded />;
    case 'status':
      return <StatusesPanel embedded />;
    case 'alerts':
      return <AlertsPanel embedded />;
    case 'security':
      return <SecurityPanel embedded />;
    case 'hierarchy':
      return <HierarchyPanel embedded />;
    default:
      return null;
  }
}

function tabIsVisible(
  tab: SettingsTabConfig,
  can: (permission: string | string[]) => boolean,
  hasAccess: (roles?: string[], permissions?: string[]) => boolean
): boolean {
  const roles = tab.role ? (Array.isArray(tab.role) ? tab.role : [tab.role]) : undefined;
  const perms = tab.permission
    ? Array.isArray(tab.permission)
      ? tab.permission
      : [tab.permission]
    : undefined;

  if (roles?.length && perms?.length) {
    return hasAccess(roles, perms);
  }
  if (roles?.length) {
    return hasAccess(roles);
  }
  if (perms?.length) {
    return can(perms);
  }
  return true;
}

export function SettingsPage() {
  const { can, hasAccess } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const visibleTabs = useMemo(
    () => SETTINGS_TABS.filter((tab) => tabIsVisible(tab, can, hasAccess)),
    [can, hasAccess]
  );

  const canAccessSettings = can(SETTINGS_ACCESS_PERMISSIONS);

  const requestedTab = searchParams.get('tab');
  const requestedTabDenied =
    isSettingsTabId(requestedTab) &&
    !visibleTabs.some((t) => t.id === requestedTab);

  const activeTab: SettingsTabId | null = useMemo(() => {
    if (!visibleTabs.length) return null;
    if (isSettingsTabId(requestedTab) && visibleTabs.some((t) => t.id === requestedTab)) {
      return requestedTab;
    }
    if (requestedTabDenied) return null;
    return visibleTabs[0].id;
  }, [requestedTab, requestedTabDenied, visibleTabs]);

  useEffect(() => {
    if (!canAccessSettings || !activeTab) return;
    if (requestedTab === activeTab) return;
    if (requestedTabDenied) return;
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', activeTab);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }, [
    activeTab,
    canAccessSettings,
    pathname,
    requestedTab,
    requestedTabDenied,
    router,
    searchParams,
  ]);

  if (!canAccessSettings) {
    return (
      <AccessRestricted
        title="Access Restricted"
        message="You do not have permission to access the Settings module. Contact an administrator if you need access."
      />
    );
  }

  if (requestedTabDenied || !activeTab) {
    return (
      <AccessRestricted
        title="Access Restricted"
        message="You do not have permission to view this settings section. Contact an administrator if you need access."
      />
    );
  }

  const activeMeta = visibleTabs.find((t) => t.id === activeTab);

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3">
        <div className="mt-1 flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-muted/40">
          <SettingsIcon className="h-5 w-5 text-muted-foreground" />
        </div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
          <p className="mt-1 text-muted-foreground">
            Centralized administration for users, access control, and system configuration
          </p>
        </div>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={(value) => {
          if (!isSettingsTabId(value)) return;
          const params = new URLSearchParams(searchParams.toString());
          params.set('tab', value);
          router.replace(`${pathname}?${params.toString()}`, { scroll: false });
        }}
        className="gap-4"
      >
        <div className="sticky top-0 z-10 -mx-1 border-b border-border bg-background/95 px-1 pb-3 backdrop-blur supports-backdrop-filter:bg-background/80">
          <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1 bg-transparent p-0">
            {visibleTabs.map((tab) => (
              <TabsTrigger
                key={tab.id}
                value={tab.id}
                className={cn(
                  'gap-2 rounded-md border border-transparent px-3 py-2 data-[state=active]:border-border data-[state=active]:bg-muted data-[state=active]:shadow-none'
                )}
              >
                <tab.icon className="h-4 w-4" />
                <span>{tab.label}</span>
              </TabsTrigger>
            ))}
          </TabsList>
          {activeMeta ? (
            <p className="mt-2 text-sm text-muted-foreground">{activeMeta.description}</p>
          ) : null}
        </div>

        {visibleTabs.map((tab) => (
          <TabsContent key={tab.id} value={tab.id} className="mt-0 outline-none">
            <SettingsTabContent tab={tab.id} />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

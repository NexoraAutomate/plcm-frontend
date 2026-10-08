"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Image from "next/image";
import {
  BarChart3,
  Users,
  ShoppingCart,
  Rocket,
  Package,
  Wrench,
  LogOut,
  Gauge,
  PinOff,
  Server,
  Network,
  Box,
  Cpu,
  Puzzle,
  GitBranch,
  Bell,
  FileText,
  AlertTriangle,
  ShieldCheck,
  ClipboardPen,
  ListChecks,
  SearchCheck,
  ScrollText,
  ScanLine,
  ChevronDown,
  ChevronRight,
  Settings,
  Tags,
  ListTree,
  LayoutTemplate,
  PackageCheck,
  MapPinned,
  type LucideIcon,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useAppDefinitions } from "@/lib/app-definitions-context";
import {
  NAV_PERMISSIONS,
  SETTINGS_ACCESS_PERMISSIONS,
  type PermissionCode,
} from "@/lib/permission-codes";
import {
  DEFINITIONS_SECTION_META,
} from "@/components/settings/settings-tabs-config";
import {
  sidebarOrderForRoles,
  type SidebarEntryKey,
} from "@/lib/sidebar-nav";
import { usePendingActionCounts } from "@/hooks/use-pending-action-counts";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const SIDEBAR_PIN_KEY = "sidebar-pinned";

type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  permission?: PermissionCode | PermissionCode[];
};

type NavGroup = {
  label: string;
  icon: LucideIcon;
  href: string;
  permission?: PermissionCode | PermissionCode[];
  children: NavItem[];
};

const NAV_BY_HREF: Record<string, NavItem> = {
  "/executive-dashboard": {
    label: "Executive Dashboard",
    href: "/executive-dashboard",
    icon: BarChart3,
    permission: NAV_PERMISSIONS["/executive-dashboard"] as PermissionCode,
  },
  "/hierarchy-dashboard": {
    label: "Hierarchy Dashboard",
    href: "/hierarchy-dashboard",
    icon: GitBranch,
    permission: NAV_PERMISSIONS["/hierarchy-dashboard"] as PermissionCode,
  },
  "/customers": {
    label: "Customers",
    href: "/customers",
    icon: Users,
    permission: NAV_PERMISSIONS["/customers"] as PermissionCode,
  },
  "/orders": {
    label: "Orders",
    href: "/orders",
    icon: ShoppingCart,
    permission: NAV_PERMISSIONS["/orders"] as PermissionCode,
  },
  "/projects": {
    label: "Projects",
    href: "/projects",
    icon: Rocket,
    permission: NAV_PERMISSIONS["/projects"] as PermissionCode,
  },
  "/inventory": {
    label: "Inventory",
    href: "/inventory",
    icon: Package,
    permission: NAV_PERMISSIONS["/inventory"] as PermissionCode,
  },
  "/scan": {
    label: "Scan Label",
    href: "/scan",
    icon: ScanLine,
    permission: NAV_PERMISSIONS["/scan"] as PermissionCode[],
  },
  "/shortages": {
    label: "Shortages",
    href: "/shortages",
    icon: AlertTriangle,
    permission: NAV_PERMISSIONS["/shortages"] as PermissionCode[],
  },
  "/issue-queue": {
    label: "Issue Queue",
    href: "/issue-queue",
    icon: ClipboardPen,
    permission: NAV_PERMISSIONS["/issue-queue"] as PermissionCode[],
  },
  "/inventory/issuances": {
    label: "Issuances",
    href: "/inventory/issuances",
    icon: PackageCheck,
    permission: NAV_PERMISSIONS["/inventory/issuances"] as PermissionCode,
  },
  "/inventory/storage-locations": {
    label: "Storage Locations",
    href: "/inventory/storage-locations",
    icon: MapPinned,
    permission: NAV_PERMISSIONS["/inventory/storage-locations"] as PermissionCode[],
  },
  "/inspect-queue": {
    label: "Inspect Queue",
    href: "/inspect-queue",
    icon: SearchCheck,
    permission: NAV_PERMISSIONS["/inspect-queue"] as PermissionCode,
  },
  "/config-changes": {
    label: "Config Changes",
    href: "/config-changes",
    icon: GitBranch,
    permission: NAV_PERMISSIONS["/config-changes"] as PermissionCode[],
  },
  "/audit": {
    label: "Audit Trail",
    href: "/audit",
    icon: ScrollText,
    permission: NAV_PERMISSIONS["/audit"] as PermissionCode,
  },
  "/my-assignments": {
    label: "My Assignments",
    href: "/my-assignments",
    icon: ListChecks,
    permission: NAV_PERMISSIONS["/my-assignments"] as PermissionCode[],
  },
  "/verify-queue": {
    label: "Verify Installations",
    href: "/verify-queue",
    icon: ShieldCheck,
    permission: NAV_PERMISSIONS["/verify-queue"] as PermissionCode,
  },
  "/maintenance": {
    label: "Maintenance",
    href: "/maintenance",
    icon: Wrench,
    permission: NAV_PERMISSIONS["/maintenance"] as PermissionCode,
  },
  "/notifications": {
    label: "Notifications",
    href: "/notifications",
    icon: Bell,
    permission: NAV_PERMISSIONS["/notifications"] as PermissionCode,
  },
};

const inventorySystemItems: NavItem[] = [
  NAV_BY_HREF["/inventory"],
  NAV_BY_HREF["/scan"],
  NAV_BY_HREF["/shortages"],
  NAV_BY_HREF["/issue-queue"],
  NAV_BY_HREF["/inventory/issuances"],
  NAV_BY_HREF["/inspect-queue"],
  NAV_BY_HREF["/inventory/storage-locations"],
];

const administrationItems: NavItem[] = [
  {
    label: "Settings",
    href: "/settings",
    icon: Settings,
    permission: SETTINGS_ACCESS_PERMISSIONS,
  },
  NAV_BY_HREF["/audit"],
];

const definitionsItems: NavItem[] = [
  {
    label: DEFINITIONS_SECTION_META.labels.label,
    href: DEFINITIONS_SECTION_META.labels.href,
    icon: Tags,
    permission: NAV_PERMISSIONS["/definitions/labels"] as PermissionCode[],
  },
  {
    label: DEFINITIONS_SECTION_META["entity-list"].label,
    href: DEFINITIONS_SECTION_META["entity-list"].href,
    icon: ListTree,
    permission: NAV_PERMISSIONS["/definitions/entity-list"] as PermissionCode[],
  },
  {
    label: DEFINITIONS_SECTION_META.configurations.label,
    href: DEFINITIONS_SECTION_META.configurations.href,
    icon: LayoutTemplate,
    permission: NAV_PERMISSIONS["/definitions/configurations"] as PermissionCode[],
  },
  NAV_BY_HREF["/config-changes"],
];

const reportingGroup: NavGroup = {
  label: "Reporting",
  icon: FileText,
  href: "/reporting",
  permission: NAV_PERMISSIONS["/reporting"] as PermissionCode,
  children: [
    {
      label: "Build History Dossier",
      href: "/reporting/build-history",
      icon: FileText,
      permission: NAV_PERMISSIONS["/reporting/build-history"] as PermissionCode,
    },
    {
      label: "Maintenance History Dossier",
      href: "/reporting/maintenance-history",
      icon: Wrench,
      permission: NAV_PERMISSIONS["/reporting/maintenance-history"] as PermissionCode,
    },
    {
      label: "Hierarchy Reports",
      href: "/reporting/hierarchy",
      icon: GitBranch,
      permission: NAV_PERMISSIONS["/reporting/hierarchy"] as PermissionCode,
    },
    {
      label: "Inventory Reports",
      href: "/reporting/inventory",
      icon: Package,
      permission: NAV_PERMISSIONS["/reporting/inventory"] as PermissionCode,
    },
    {
      label: "Maintenance Reports",
      href: "/reporting/maintenance",
      icon: Gauge,
      permission: NAV_PERMISSIONS["/reporting/maintenance"] as PermissionCode,
    },
    {
      label: "Executive Reports",
      href: "/reporting/executive",
      icon: BarChart3,
      permission: NAV_PERMISSIONS["/reporting/executive"] as PermissionCode,
    },
  ],
};

const hierarchyItems: NavItem[] = [
  {
    label: "Systems",
    href: "/systems",
    icon: Server,
    permission: NAV_PERMISSIONS["/systems"] as PermissionCode,
  },
  {
    label: "Subsystems",
    href: "/subsystems",
    icon: Network,
    permission: NAV_PERMISSIONS["/subsystems"] as PermissionCode,
  },
  {
    label: "Modules",
    href: "/modules",
    icon: Box,
    permission: NAV_PERMISSIONS["/modules"] as PermissionCode,
  },
  {
    label: "Units",
    href: "/units",
    icon: Cpu,
    permission: NAV_PERMISSIONS["/units"] as PermissionCode,
  },
  {
    label: "Components",
    href: "/components",
    icon: Puzzle,
    permission: NAV_PERMISSIONS["/components"] as PermissionCode,
  },
];

const HIERARCHY_LABEL_BY_HREF: Record<string, string> = {
  "/projects": "project",
  "/systems": "system",
  "/subsystems": "subsystem",
  "/modules": "module",
  "/units": "unit",
  "/components": "component",
};

const ENTRY_HREF: Partial<Record<SidebarEntryKey, string>> = {
  "executive-dashboard": "/executive-dashboard",
  "hierarchy-dashboard": "/hierarchy-dashboard",
  "my-assignments": "/my-assignments",
  customers: "/customers",
  orders: "/orders",
  projects: "/projects",
  "verify-queue": "/verify-queue",
  inventory: "/inventory",
  "issue-queue": "/issue-queue",
  maintenance: "/maintenance",
  notifications: "/notifications",
};

function canSeeItem(
  item: NavItem,
  can: (permission: string | string[]) => boolean
) {
  return !item.permission || can(item.permission);
}

type CollapsibleGroupId =
  | "inventory-system"
  | "project-hierarchy"
  | "definitions"
  | "administration"
  | "reporting";

function pathMatchesItem(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(href + "/");
}

function pathMatchesAny(pathname: string, items: { href: string }[]) {
  return items.some((item) => pathMatchesItem(pathname, item.href));
}

/** All sidebar hrefs — used so parent routes don't stay active on sibling child routes. */
const ALL_NAV_HREFS: string[] = Array.from(
  new Set([
    ...Object.values(NAV_BY_HREF).map((item) => item.href),
    ...inventorySystemItems.map((item) => item.href),
    ...administrationItems.map((item) => item.href),
    ...definitionsItems.map((item) => item.href),
    ...hierarchyItems.map((item) => item.href),
    reportingGroup.href,
    ...reportingGroup.children.map((item) => item.href),
  ])
);

/** Prefer the longest matching nav href so /inventory isn't active on /inventory/storage-locations. */
function isNavItemActive(pathname: string, href: string) {
  if (!pathMatchesItem(pathname, href)) return false;
  return !ALL_NAV_HREFS.some(
    (other) =>
      other !== href &&
      other.length > href.length &&
      pathMatchesItem(pathname, other)
  );
}

function formatPendingCount(count: number) {
  return count > 99 ? "99+" : String(count);
}

function PendingBadge({
  count,
  className,
}: {
  count: number;
  className?: string;
}) {
  if (count <= 0) return null;
  return (
    <span
      className={cn(
        "absolute -left-1 -top-1 z-10 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold leading-none text-white shadow-sm",
        className
      )}
      aria-label={`${count} pending`}
    >
      {formatPendingCount(count)}
    </span>
  );
}

function NavLink({
  item,
  pathname,
  collapsed,
  badgeCount = 0,
}: {
  item: NavItem;
  pathname: string;
  collapsed: boolean;
  badgeCount?: number;
}) {
  const isActive = isNavItemActive(pathname, item.href);

  const link = (
    <Link
      href={item.href}
      className={cn(
        "relative flex items-center rounded-lg border text-sm font-medium transition-colors",
        collapsed ? "justify-center px-2 py-2.5" : "gap-3 px-3 py-2.5",
        isActive
          ? "border-sidebar-primary bg-sidebar-accent text-sidebar-primary"
          : "border-transparent text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
      )}
    >
      <span className="relative shrink-0">
        <PendingBadge count={badgeCount} />
        <item.icon className="h-4.5 w-4.5" />
      </span>
      {!collapsed && <span className="truncate">{item.label}</span>}
    </Link>
  );

  if (!collapsed) return link;

  return (
    <Tooltip delayDuration={0}>
      <TooltipTrigger asChild>{link}</TooltipTrigger>
      <TooltipContent side="right" sideOffset={8}>
        {badgeCount > 0
          ? `${item.label} (${formatPendingCount(badgeCount)} pending)`
          : item.label}
      </TooltipContent>
    </Tooltip>
  );
}

function CollapsibleGroupHeader({
  label,
  icon: Icon,
  open,
  active,
  onToggle,
  href,
  badgeCount = 0,
}: {
  label: string;
  icon: LucideIcon;
  open: boolean;
  active: boolean;
  onToggle: () => void;
  href?: string;
  badgeCount?: number;
}) {
  const iconWithBadge = (
    <span className="relative shrink-0">
      <PendingBadge count={badgeCount} />
      <Icon className="h-4.5 w-4.5" />
    </span>
  );

  return (
    <div
      className={cn(
        "flex w-full items-center rounded-lg border text-sm font-medium transition-colors",
        active
          ? "border-sidebar-primary bg-sidebar-accent text-sidebar-primary"
          : "border-transparent text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
      )}
    >
      {href ? (
        <Link
          href={href}
          className="relative flex min-w-0 flex-1 items-center gap-3 px-3 py-2.5"
        >
          {iconWithBadge}
          <span className="truncate">{label}</span>
        </Link>
      ) : (
        <button
          type="button"
          onClick={onToggle}
          className="relative flex min-w-0 flex-1 items-center gap-3 px-3 py-2.5 text-left"
        >
          {iconWithBadge}
          <span className="truncate">{label}</span>
        </button>
      )}
      <button
        type="button"
        aria-label={open ? `Collapse ${label}` : `Expand ${label}`}
        aria-expanded={open}
        onClick={onToggle}
        className="shrink-0 rounded-md p-2 hover:bg-sidebar-accent/80"
      >
        {open ? (
          <ChevronDown className="h-4 w-4 opacity-70" />
        ) : (
          <ChevronRight className="h-4 w-4 opacity-70" />
        )}
      </button>
    </div>
  );
}

export function AppSidebar() {
  const pathname = usePathname();
  const { logout, can, user } = useAuth();
  const { entityLabel } = useAppDefinitions();
  const { countForHref, sumForHrefs } = usePendingActionCounts(Boolean(user));
  const [pinned, setPinned] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [openGroups, setOpenGroups] = useState<
    Record<CollapsibleGroupId, boolean>
  >({
    "inventory-system": false,
    "project-hierarchy": false,
    definitions: false,
    administration: false,
    reporting: false,
  });

  useEffect(() => {
    setMounted(true);
    const stored = localStorage.getItem(SIDEBAR_PIN_KEY);
    setPinned(stored === "true");
  }, []);

  const collapsed = !pinned;

  const withEntityLabel = (item: NavItem): NavItem => {
    const level = HIERARCHY_LABEL_BY_HREF[item.href];
    return level ? { ...item, label: entityLabel(level, true) } : item;
  };

  const order = useMemo(
    () => sidebarOrderForRoles(user?.roles),
    [user?.roles]
  );

  const visibleReportingChildren = useMemo(
    () => reportingGroup.children.filter((item) => canSeeItem(item, can)),
    [can]
  );
  const canSeeReporting =
    (!reportingGroup.permission || can(reportingGroup.permission)) &&
    visibleReportingChildren.length > 0;

  const visibleInventorySystem = useMemo(
    () =>
      inventorySystemItems
        .filter((item) => canSeeItem(item, can))
        .map((item) => {
          const level = HIERARCHY_LABEL_BY_HREF[item.href];
          return level ? { ...item, label: entityLabel(level, true) } : item;
        }),
    [can, entityLabel]
  );

  const visibleHierarchy = useMemo(
    () =>
      hierarchyItems
        .filter((item) => canSeeItem(item, can))
        .map((item) => {
          const level = HIERARCHY_LABEL_BY_HREF[item.href];
          return level ? { ...item, label: entityLabel(level, true) } : item;
        }),
    [can, entityLabel]
  );

  const visibleAdministration = useMemo(
    () => administrationItems.filter((item) => canSeeItem(item, can)),
    [can]
  );

  const visibleDefinitions = useMemo(
    () => definitionsItems.filter((item) => canSeeItem(item, can)),
    [can]
  );

  useEffect(() => {
    setOpenGroups((prev) => {
      const next = { ...prev };
      let changed = false;
      const openIf = (id: CollapsibleGroupId, match: boolean) => {
        if (match && !prev[id]) {
          next[id] = true;
          changed = true;
        }
      };
      openIf("reporting", pathname.startsWith("/reporting"));
      openIf("inventory-system", pathMatchesAny(pathname, visibleInventorySystem));
      openIf("project-hierarchy", pathMatchesAny(pathname, visibleHierarchy));
      openIf("definitions", pathMatchesAny(pathname, visibleDefinitions));
      openIf("administration", pathMatchesAny(pathname, visibleAdministration));
      return changed ? next : prev;
    });
  }, [
    pathname,
    visibleInventorySystem,
    visibleHierarchy,
    visibleDefinitions,
    visibleAdministration,
  ]);

  const pinSidebar = () => {
    setPinned(true);
    localStorage.setItem(SIDEBAR_PIN_KEY, "true");
  };

  const unpinSidebar = () => {
    setPinned(false);
    localStorage.setItem(SIDEBAR_PIN_KEY, "false");
  };

  const toggleGroup = (id: CollapsibleGroupId) => {
    setOpenGroups((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const logoutButton = (
    <button
      onClick={logout}
      className={cn(
        "flex w-full items-center rounded-lg text-sm font-medium text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground",
        collapsed ? "justify-center px-2 py-2.5" : "gap-3 px-3 py-2.5"
      )}
    >
      <LogOut className="h-4.5 w-4.5 shrink-0" />
      {!collapsed && "Logout"}
    </button>
  );

  const renderFlatItem = (href: string) => {
    const item = NAV_BY_HREF[href];
    if (!item || !canSeeItem(item, can)) return null;
    return (
      <NavLink
        key={item.href}
        item={withEntityLabel(item)}
        pathname={pathname}
        collapsed={collapsed}
        badgeCount={countForHref(item.href)}
      />
    );
  };

  const renderChildLinks = (items: NavItem[]) => (
    <div className="ml-3 mr-1 mt-0.5 space-y-0.5 rounded-md bg-sidebar-submenu p-1">
      {items.map((item) => {
        const badgeCount = countForHref(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "relative flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors",
              isNavItemActive(pathname, item.href)
                ? "border-sidebar-primary bg-sidebar-primary/20 text-sidebar-primary"
                : "border-transparent text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
            )}
          >
            <span className="relative shrink-0">
              <PendingBadge count={badgeCount} className="-left-1.5 -top-1.5 h-3.5 min-w-3.5 text-[9px]" />
              <item.icon className="h-3.5 w-3.5" />
            </span>
            <span className="truncate">{item.label}</span>
          </Link>
        );
      })}
    </div>
  );

  const renderCollapsibleGroup = ({
    id,
    label,
    icon,
    items,
    href,
  }: {
    id: CollapsibleGroupId;
    label: string;
    icon: LucideIcon;
    items: NavItem[];
    href?: string;
  }) => {
    if (items.length === 0) return null;
    const active = Boolean(href && pathname === href);
    const open = openGroups[id];
    const groupBadgeCount = sumForHrefs([
      ...items.map((item) => item.href),
      ...(href ? [href] : []),
    ]);

    if (collapsed) {
      if (href) {
        return (
          <NavLink
            key={id}
            item={{ label, href, icon }}
            pathname={pathname}
            collapsed={collapsed}
            badgeCount={groupBadgeCount}
          />
        );
      }
      return (
        <div key={id} className="mt-6 space-y-1 first:mt-0">
          <div className="mx-auto mb-2 h-px w-8 bg-sidebar-border" />
          {items.map((item) => (
            <NavLink
              key={item.href}
              item={item}
              pathname={pathname}
              collapsed={collapsed}
              badgeCount={countForHref(item.href)}
            />
          ))}
        </div>
      );
    }

    return (
      <div key={id} className="mt-1 first:mt-0">
        <CollapsibleGroupHeader
          label={label}
          icon={icon}
          open={open}
          active={active}
          onToggle={() => toggleGroup(id)}
          href={href}
          badgeCount={open ? 0 : groupBadgeCount}
        />
        {open && renderChildLinks(items)}
      </div>
    );
  };

  const renderEntry = (entry: SidebarEntryKey) => {
    switch (entry) {
      case "inventory-system":
        return renderCollapsibleGroup({
          id: "inventory-system",
          label: "Inventory System",
          icon: Package,
          items: visibleInventorySystem,
        });
      case "project-hierarchy":
        return renderCollapsibleGroup({
          id: "project-hierarchy",
          label: `${entityLabel("project")} Hierarchy`,
          icon: GitBranch,
          items: visibleHierarchy,
        });
      case "definitions":
        return renderCollapsibleGroup({
          id: "definitions",
          label: "Definitions",
          icon: Tags,
          items: visibleDefinitions,
        });
      case "administration":
        return renderCollapsibleGroup({
          id: "administration",
          label: "Administration",
          icon: Settings,
          items: visibleAdministration,
        });
      case "reporting":
        if (!canSeeReporting) return null;
        return renderCollapsibleGroup({
          id: "reporting",
          label: reportingGroup.label,
          icon: reportingGroup.icon,
          items: visibleReportingChildren,
          href: reportingGroup.href,
        });
      default: {
        const href = ENTRY_HREF[entry];
        return href ? renderFlatItem(href) : null;
      }
    }
  };

  return (
    <TooltipProvider>
      <aside
        className={cn(
          "relative flex h-screen shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-[width] duration-200 ease-in-out",
          collapsed ? "w-16" : "w-64"
        )}
      >
        {mounted && pinned && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={unpinSidebar}
            className="absolute right-1 top-3 z-10 h-7 w-7 text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground"
            aria-label="Unpin sidebar"
            title="Unpin sidebar"
          >
            <PinOff className="h-3.5 w-3.5" />
          </Button>
        )}

        <div
          className={cn(
            "flex items-center border-b border-sidebar-border py-4",
            collapsed ? "justify-center px-2" : "gap-3 px-4 pt-5"
          )}
        >
          {collapsed ? (
            <button
              type="button"
              onClick={pinSidebar}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-blue-500 transition-colors hover:bg-sidebar-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
              aria-label="Pin sidebar open"
              title="Pin sidebar open"
            >
              <Image
                src="/SSDLS.svg"
                width={30}
                height={30}
                alt="SSDLS"
                className="h-auto w-auto dark:invert"
              />
            </button>
          ) : (
            <div className="flex h-9 w-9 shrink-0 items-center justify-center text-blue-500">
              <Image
                src="/SSDLS.svg"
                width={30}
                height={30}
                alt="SSDLS"
                className="h-auto w-auto dark:invert"
              />
            </div>
          )}
          {!collapsed && (
            <div className="min-w-0 flex-1 pr-6">
              <h1 className="truncate text-base font-semibold tracking-tight text-sidebar-foreground">
                SSDLS
              </h1>
              <p className="truncate text-xs text-sidebar-foreground/60">
                Product Lifecycle Management
              </p>
            </div>
          )}
        </div>

        <nav className="flex-1 overflow-y-auto overflow-x-hidden px-2 py-4">
          <div className="space-y-1">
            {order.map((entry) => renderEntry(entry))}
          </div>
        </nav>

        <div className="border-t border-sidebar-border px-2 py-4">
          {collapsed ? (
            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>{logoutButton}</TooltipTrigger>
              <TooltipContent side="right" sideOffset={8}>
                Logout
              </TooltipContent>
            </Tooltip>
          ) : (
            logoutButton
          )}
        </div>
      </aside>
    </TooltipProvider>
  );
}

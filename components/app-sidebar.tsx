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
  Pin,
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
  sidebarOrderForRoles,
  type SidebarEntryKey,
} from "@/lib/sidebar-nav";
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
  NAV_BY_HREF["/inspect-queue"],
];

const administrationItems: NavItem[] = [
  {
    label: "Settings",
    href: "/settings",
    icon: Settings,
    permission: SETTINGS_ACCESS_PERMISSIONS,
  },
  NAV_BY_HREF["/config-changes"],
  NAV_BY_HREF["/audit"],
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

function NavLink({
  item,
  pathname,
  collapsed,
}: {
  item: NavItem;
  pathname: string;
  collapsed: boolean;
}) {
  const isActive =
    pathname === item.href || pathname.startsWith(item.href + "/");

  const link = (
    <Link
      href={item.href}
      className={cn(
        "flex items-center rounded-lg border text-sm font-medium transition-colors",
        collapsed ? "justify-center px-2 py-2.5" : "gap-3 px-3 py-2.5",
        isActive
          ? "border-sidebar-primary bg-sidebar-accent text-sidebar-primary"
          : "border-transparent text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
      )}
    >
      <item.icon className="h-4.5 w-4.5 shrink-0" />
      {!collapsed && <span className="truncate">{item.label}</span>}
    </Link>
  );

  if (!collapsed) return link;

  return (
    <Tooltip delayDuration={0}>
      <TooltipTrigger asChild>{link}</TooltipTrigger>
      <TooltipContent side="right" sideOffset={8}>
        {item.label}
      </TooltipContent>
    </Tooltip>
  );
}

type CollapsibleGroupId =
  | "inventory-system"
  | "project-hierarchy"
  | "administration"
  | "reporting";

function pathMatchesItem(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(href + "/");
}

function pathMatchesAny(pathname: string, items: { href: string }[]) {
  return items.some((item) => pathMatchesItem(pathname, item.href));
}

function CollapsibleGroupHeader({
  label,
  icon: Icon,
  open,
  active,
  onToggle,
  href,
}: {
  label: string;
  icon: LucideIcon;
  open: boolean;
  active: boolean;
  onToggle: () => void;
  href?: string;
}) {
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
          className="flex min-w-0 flex-1 items-center gap-3 px-3 py-2.5"
        >
          <Icon className="h-4.5 w-4.5 shrink-0" />
          <span className="truncate">{label}</span>
        </Link>
      ) : (
        <button
          type="button"
          onClick={onToggle}
          className="flex min-w-0 flex-1 items-center gap-3 px-3 py-2.5 text-left"
        >
          <Icon className="h-4.5 w-4.5 shrink-0" />
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
  const [pinned, setPinned] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [openGroups, setOpenGroups] = useState<
    Record<CollapsibleGroupId, boolean>
  >({
    "inventory-system": false,
    "project-hierarchy": false,
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
      openIf("administration", pathMatchesAny(pathname, visibleAdministration));
      return changed ? next : prev;
    });
  }, [
    pathname,
    visibleInventorySystem,
    visibleHierarchy,
    visibleAdministration,
  ]);

  const togglePin = () => {
    setPinned((current) => {
      const next = !current;
      localStorage.setItem(SIDEBAR_PIN_KEY, String(next));
      return next;
    });
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
      />
    );
  };

  const renderChildLinks = (items: NavItem[]) =>
    items.map((item) => (
      <Link
        key={item.href}
        href={item.href}
        className={cn(
          "ml-4 mr-1 flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors",
          pathMatchesItem(pathname, item.href)
            ? "border-sidebar-primary bg-sidebar-primary/20 text-sidebar-primary"
            : "border-transparent text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
        )}
      >
        <item.icon className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate">{item.label}</span>
      </Link>
    ));

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

    if (collapsed) {
      if (href) {
        return (
          <NavLink
            key={id}
            item={{ label, href, icon }}
            pathname={pathname}
            collapsed={collapsed}
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
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={togglePin}
          className="absolute right-1 top-3 z-10 h-7 w-7 text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground"
          aria-label={pinned ? "Unpin sidebar" : "Pin sidebar open"}
          title={pinned ? "Unpin sidebar" : "Pin sidebar open"}
        >
          {mounted && pinned ? (
            <PinOff className="h-3.5 w-3.5" />
          ) : (
            <Pin className="h-3.5 w-3.5" />
          )}
        </Button>

        <div
          className={cn(
            "flex items-center border-b border-sidebar-border py-4",
            collapsed ? "justify-center px-2" : "gap-3 px-4 pt-5"
          )}
        >
          <div className="flex h-9 w-9 shrink-0 text-blue-500 items-center justify-center">
            <Image
              src="/SSDLS.svg"
              width={30}
              height={30}
              alt="Backend"
              className="h-auto w-auto dark:invert"
            />
          </div>
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

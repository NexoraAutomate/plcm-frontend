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
  ClipboardPen,
  ListChecks,
  ChevronDown,
  ChevronRight,
  Settings,
  type LucideIcon,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useAppDefinitions } from "@/lib/app-definitions-context";
import { NAV_PERMISSIONS, SETTINGS_ACCESS_PERMISSIONS, type PermissionCode } from "@/lib/permission-codes";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useAppFullscreen } from "@/components/app-fullscreen";
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

const navItems: NavItem[] = [
  {
    label: "Executive Dashboard",
    href: "/executive-dashboard",
    icon: BarChart3,
    permission: NAV_PERMISSIONS["/executive-dashboard"] as PermissionCode,
  },
  {
    label: "Hierarchy Dashboard",
    href: "/hierarchy-dashboard",
    icon: GitBranch,
    permission: NAV_PERMISSIONS["/hierarchy-dashboard"] as PermissionCode,
  },
  {
    label: "Customers",
    href: "/customers",
    icon: Users,
    permission: NAV_PERMISSIONS["/customers"] as PermissionCode,
  },
  {
    label: "Orders",
    href: "/orders",
    icon: ShoppingCart,
    permission: NAV_PERMISSIONS["/orders"] as PermissionCode,
  },
  {
    label: "Projects",
    href: "/projects",
    icon: Rocket,
    permission: NAV_PERMISSIONS["/projects"] as PermissionCode,
  },
  {
    label: "Inventory",
    href: "/inventory",
    icon: Package,
    permission: NAV_PERMISSIONS["/inventory"] as PermissionCode,
  },
  {
    label: "Shortages",
    href: "/shortages",
    icon: AlertTriangle,
    permission: NAV_PERMISSIONS["/shortages"] as PermissionCode,
  },
  {
    label: "Issue Queue",
    href: "/issue-queue",
    icon: ClipboardPen,
    permission: NAV_PERMISSIONS["/issue-queue"] as PermissionCode,
  },
  {
    label: "My Assignments",
    href: "/my-assignments",
    icon: ListChecks,
    permission: NAV_PERMISSIONS["/my-assignments"] as PermissionCode,
  },
  {
    label: "Maintenance",
    href: "/maintenance",
    icon: Wrench,
    permission: NAV_PERMISSIONS["/maintenance"] as PermissionCode,
  },
  {
    label: "Notifications",
    href: "/notifications",
    icon: Bell,
    permission: NAV_PERMISSIONS["/notifications"] as PermissionCode,
  },
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
  "/systems": "system",
  "/subsystems": "subsystem",
  "/modules": "module",
  "/units": "unit",
  "/components": "component",
};

const settingsItem: NavItem = {
  label: "Settings",
  href: "/settings",
  icon: Settings,
  permission: SETTINGS_ACCESS_PERMISSIONS,
};

function NavLink({
  item,
  pathname,
  collapsed,
  onNavigate,
}: {
  item: NavItem;
  pathname: string;
  collapsed: boolean;
  onNavigate?: (href: string) => void;
}) {
  const isActive =
    pathname === item.href || pathname.startsWith(item.href + "/");

  const link = (
    <Link
      href={item.href}
      onClick={() => onNavigate?.(item.href)}
      className={cn(
        "flex items-center rounded-lg text-sm font-medium transition-colors",
        collapsed ? "justify-center px-2 py-2.5" : "gap-3 px-3 py-2.5",
        isActive
          ? "bg-sidebar-accent text-sidebar-primary"
          : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
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

export function AppSidebar() {
  const pathname = usePathname();
  const { logout, can } = useAuth();
  const { entityLabel } = useAppDefinitions();
  const { enter: enterFullscreen } = useAppFullscreen();
  const [pinned, setPinned] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [reportingOpen, setReportingOpen] = useState(false);

  useEffect(() => {
    setMounted(true);
    const stored = localStorage.getItem(SIDEBAR_PIN_KEY);
    setPinned(stored === "true");
  }, []);

  useEffect(() => {
    if (pathname.startsWith("/reporting")) {
      setReportingOpen(true);
    }
  }, [pathname]);

  const collapsed = !pinned;

  const handleNavigate = (href: string) => {
    if (href === "/executive-dashboard" || href.startsWith("/executive-dashboard/")) {
      enterFullscreen();
    }
  };

  const visibleNav = useMemo(
    () => navItems.filter((item) => !item.permission || can(item.permission)),
    [can]
  );
  const visibleHierarchy = useMemo(
    () =>
      hierarchyItems
        .filter((item) => !item.permission || can(item.permission))
        .map((item) => {
          const level = HIERARCHY_LABEL_BY_HREF[item.href];
          return level ? { ...item, label: entityLabel(level, true) } : item;
        }),
    [can, entityLabel]
  );
  const canSeeSettings = !settingsItem.permission || can(settingsItem.permission);
  const visibleReportingChildren = useMemo(
    () =>
      reportingGroup.children.filter(
        (item) => !item.permission || can(item.permission)
      ),
    [can]
  );
  const canSeeReporting =
    (!reportingGroup.permission || can(reportingGroup.permission)) &&
    visibleReportingChildren.length > 0;

  const togglePin = () => {
    setPinned((current) => {
      const next = !current;
      localStorage.setItem(SIDEBAR_PIN_KEY, String(next));
      return next;
    });
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
              className="dark:invert"
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
            {visibleNav.map((item) => (
              <NavLink
                key={item.href}
                item={item}
                pathname={pathname}
                collapsed={collapsed}
                onNavigate={handleNavigate}
              />
            ))}

            {canSeeReporting &&
              (collapsed ? (
                <NavLink
                  item={{
                    label: reportingGroup.label,
                    href: reportingGroup.href,
                    icon: reportingGroup.icon,
                  }}
                  pathname={pathname}
                  collapsed={collapsed}
                  onNavigate={handleNavigate}
                />
              ) : (
                <>
                  <div
                    className={cn(
                      "flex w-full items-center rounded-lg text-sm font-medium transition-colors",
                      pathname.startsWith("/reporting")
                        ? "bg-sidebar-accent text-sidebar-primary"
                        : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                    )}
                  >
                    <Link
                      href={reportingGroup.href}
                      className="flex min-w-0 flex-1 items-center gap-3 px-3 py-2.5"
                    >
                      <reportingGroup.icon className="h-4.5 w-4.5 shrink-0" />
                      <span className="truncate">{reportingGroup.label}</span>
                    </Link>
                    <button
                      type="button"
                      aria-label={reportingOpen ? "Collapse reports" : "Expand reports"}
                      aria-expanded={reportingOpen}
                      onClick={() => setReportingOpen((o) => !o)}
                      className="shrink-0 rounded-md p-2 hover:bg-sidebar-accent/80"
                    >
                      {reportingOpen ? (
                        <ChevronDown className="h-4 w-4 opacity-70" />
                      ) : (
                        <ChevronRight className="h-4 w-4 opacity-70" />
                      )}
                    </button>
                  </div>
                  {reportingOpen &&
                    visibleReportingChildren.map((item) => (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={cn(
                          "ml-3 flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                          pathname === item.href ||
                            pathname.startsWith(item.href + "/")
                            ? "bg-sidebar-accent text-sidebar-primary"
                            : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                        )}
                      >
                        <item.icon className="h-4 w-4 shrink-0" />
                        <span className="truncate">{item.label}</span>
                      </Link>
                    ))}
                </>
              ))}
          </div>

          {visibleHierarchy.length > 0 && (
            <div className="mt-6">
              {!collapsed && (
                <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/40">
                  Project Hierarchy
                </p>
              )}
              {collapsed && (
                <div className="mx-auto mb-2 h-px w-8 bg-sidebar-border" />
              )}
              <div className="space-y-1">
                {visibleHierarchy.map((item) => (
                  <NavLink
                    key={item.href}
                    item={item}
                    pathname={pathname}
                    collapsed={collapsed}
                    onNavigate={handleNavigate}
                  />
                ))}
              </div>
            </div>
          )}

          {canSeeSettings && (
            <div className="mt-6">
              {!collapsed && (
                <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/40">
                  Administration
                </p>
              )}
              {collapsed && (
                <div className="mx-auto mb-2 h-px w-8 bg-sidebar-border" />
              )}
              <div className="space-y-1">
                <NavLink
                  item={settingsItem}
                  pathname={pathname}
                  collapsed={collapsed}
                  onNavigate={handleNavigate}
                />
              </div>
            </div>
          )}
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

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Image from "next/image";
import {
  LayoutDashboard,
  BarChart3,
  Users,
  ShoppingCart,
  Rocket,
  Package,
  Wrench,
  UserCog,
  LogOut,
  Satellite,
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
  type LucideIcon,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
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
};

const navItems: NavItem[] = [
  //{ label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Executive Dashboard", href: "/executive-dashboard", icon: BarChart3 },
  { label: "Customers", href: "/customers", icon: Users },
  { label: "Orders", href: "/orders", icon: ShoppingCart },
  { label: "Projects", href: "/projects", icon: Rocket },
  { label: "Inventory", href: "/inventory", icon: Package },
  { label: "Maintenance", href: "/maintenance", icon: Wrench },
  { label: "Notifications", href: "/notifications", icon: Bell },
];

const hierarchyItems: NavItem[] = [
  { label: "Hierarchy Dashboard", href: "/hierarchy-dashboard", icon: GitBranch },
  { label: "Systems", href: "/systems", icon: Server },
  { label: "Subsystems", href: "/subsystems", icon: Network },
  { label: "Modules", href: "/modules", icon: Box },
  { label: "Units", href: "/units", icon: Cpu },
  { label: "Components", href: "/components", icon: Puzzle },
];

const adminItems: NavItem[] = [
  { label: "Systems Hierarchy", href: "/hierarchy", icon: GitBranch },
  { label: "Users", href: "/users", icon: UserCog },
  { label: "Statuses", href: "/statuses", icon: Gauge },
];

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
  const { user, logout } = useAuth();
  const [pinned, setPinned] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const stored = localStorage.getItem(SIDEBAR_PIN_KEY);
    setPinned(stored === "true");
  }, []);

  const collapsed = !pinned;

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
            {/* <Satellite className="h-5 w-5 text-sidebar-primary-foreground" /> */}
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
            {navItems.map((item) => (
              <NavLink
                key={item.href}
                item={item}
                pathname={pathname}
                collapsed={collapsed}
              />
            ))}
          </div>

          <div className="mt-6">
            {!collapsed && (
              <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/40">
                Hierarchy
              </p>
            )}
            {collapsed && (
              <div className="mx-auto mb-2 h-px w-8 bg-sidebar-border" />
            )}
            <div className="space-y-1">
              {hierarchyItems.map((item) => (
                <NavLink
                  key={item.href}
                  item={item}
                  pathname={pathname}
                  collapsed={collapsed}
                />
              ))}
            </div>
          </div>

          {user?.roles?.includes("Admin") && (
            <div className="mt-6">
              {!collapsed && (
                <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/40">
                  Admin
                </p>
              )}
              {collapsed && (
                <div className="mx-auto mb-2 h-px w-8 bg-sidebar-border" />
              )}
              <div className="space-y-1">
                {adminItems.map((item) => (
                  <NavLink
                    key={item.href}
                    item={item}
                    pathname={pathname}
                    collapsed={collapsed}
                  />
                ))}
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

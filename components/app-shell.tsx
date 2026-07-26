'use client';

import { useEffect, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Minimize2 } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { AppSidebar } from "@/components/app-sidebar";
import { Navbar } from "@/components/navbar";
import { RoutePermissionGuard } from "@/components/auth/require-permission";
import {
  AppFullscreenProvider,
  useAppFullscreen,
} from "@/components/app-fullscreen";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function isImmersiveDashboardRoute(pathname: string | null): boolean {
  if (!pathname) return false;
  return (
    pathname.startsWith("/executive-dashboard") ||
    pathname.startsWith("/hierarchy-dashboard")
  );
}

function AppShellFrame({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isExecutiveCommand = pathname?.startsWith("/executive-dashboard") ?? false;
  const immersiveFullscreen = isImmersiveDashboardRoute(pathname);
  const { active: fullscreenActive, exit } = useAppFullscreen();
  // Executive + hierarchy dashboards hide the sidebar in fullscreen.
  const hideSidebar = fullscreenActive && immersiveFullscreen;
  // Navbar stays on all routes except executive dashboard.
  const hideNavbar = fullscreenActive && isExecutiveCommand;

  return (
    <div className="flex h-screen overflow-hidden">
      {!hideSidebar ? <AppSidebar /> : null}
      <div className="flex flex-1 flex-col overflow-hidden">
        {!hideNavbar ? <Navbar /> : null}
        <main
          className={cn(
            "relative min-h-0 flex-1 bg-background",
            isExecutiveCommand
              ? "flex flex-col overflow-hidden p-0"
              : "overflow-y-auto p-6"
          )}
        >
          {hideNavbar ? (
            <div className="pointer-events-none absolute right-3 top-3 z-50 flex items-center gap-2">
              <div className="pointer-events-auto flex items-center gap-2 rounded-md border border-border bg-card/95 px-2 py-1 text-[11px] text-muted-foreground shadow-sm backdrop-blur">
                <span>Fullscreen · Esc for normal view</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  title="Exit fullscreen (Esc)"
                  aria-label="Exit fullscreen"
                  onClick={exit}
                >
                  <Minimize2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ) : null}
          <RoutePermissionGuard>{children}</RoutePermissionGuard>
        </main>
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const { isAuthenticated, authReady } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!authReady) return;
    if (!isAuthenticated) {
      router.replace("/login");
    }
  }, [isAuthenticated, authReady, router]);

  if (!authReady || !isAuthenticated) return null;

  return (
    <AppFullscreenProvider>
      <AppShellFrame>{children}</AppShellFrame>
    </AppFullscreenProvider>
  );
}

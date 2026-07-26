'use client';

import { useEffect, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { AppSidebar } from "@/components/app-sidebar";
import { Navbar } from "@/components/navbar";
import { RoutePermissionGuard } from "@/components/auth/require-permission";
import {
  ExecutivePresentationProvider,
  useExecutivePresentation,
} from "@/components/dashboard/executive/executive-presentation";
import { cn } from "@/lib/utils";

function AppShellFrame({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isExecutiveCommand = pathname?.startsWith("/executive-dashboard");
  const { active: presentationActive } = useExecutivePresentation();
  const hideChrome = presentationActive;

  return (
    <div className="flex h-screen overflow-hidden">
      {!hideChrome ? <AppSidebar /> : null}
      <div className="flex flex-1 flex-col overflow-hidden">
        {!hideChrome ? <Navbar /> : null}
        <main
          className={cn(
            "min-h-0 flex-1 bg-background",
            isExecutiveCommand
              ? "flex flex-col overflow-hidden p-0"
              : "overflow-y-auto p-6"
          )}
        >
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
    <ExecutivePresentationProvider>
      <AppShellFrame>{children}</AppShellFrame>
    </ExecutivePresentationProvider>
  );
}

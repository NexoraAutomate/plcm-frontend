'use client';

import { useEffect, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { AppSidebar } from "@/components/app-sidebar";
import { Navbar } from "@/components/navbar";
import { RoutePermissionGuard } from "@/components/auth/require-permission";
import { cn } from "@/lib/utils";

export function AppShell({ children }: { children: ReactNode }) {
  const { isAuthenticated, authReady } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const isExecutiveCommand = pathname?.startsWith("/executive-dashboard");

  useEffect(() => {
    if (!authReady) return;
    if (!isAuthenticated) {
      router.replace("/login");
    }
  }, [isAuthenticated, authReady, router]);

  if (!authReady || !isAuthenticated) return null;

  return (
    <div className="flex h-screen overflow-hidden">
      <AppSidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Navbar />
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

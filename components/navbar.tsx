"use client";

import Link from "next/link";
import { Moon, Sun, Bell } from "lucide-react";
import { useTheme } from "next-themes";
import { useAuth } from "@/lib/auth-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Image from "next/image";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { NotificationRow } from "@/components/notifications/notification-row";
import { useAppNotifications } from "@/hooks/use-app-notifications";
import { useNotificationSync } from "@/hooks/use-notification-sync";

export function Navbar() {
  const { user } = useAuth();
  const { theme, setTheme } = useTheme();
  useNotificationSync();
  const {
    notifications,
    unreadCount,
    highPriorityCount,
    loading,
    isRead,
    markAsRead,
    markAllAsRead,
    clearAll,
  } = useAppNotifications();

  return (
    <header className="flex h-16 items-center justify-between border-b border-border bg-card px-6">
      <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
        <Image
          src="/lottie/System Icon.svg"
          width={30}
          height={30}
          alt="Backend"
        />
        <p className="truncate font-bold text-zinc-500">
          Product Life Cycle Management System
        </p>
      </div>

      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          className="relative h-9 w-9 text-muted-foreground"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
        >
          <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          <span className="sr-only">Toggle theme</span>
        </Button>

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" className="relative h-9 w-9 text-muted-foreground">
              <Bell className="h-4 w-4" />
              {unreadCount > 0 && (
                <span
                  className={`absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold text-white ${
                    highPriorityCount > 0 ? 'bg-destructive' : 'bg-amber-500'
                  }`}
                >
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
              <span className="sr-only">Notifications</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-80 p-0">
            <div className="border-b px-4 py-3">
              <p className="text-sm font-semibold">Notifications</p>
              <p className="text-xs text-muted-foreground">
                Maintenance, faults, projects, and customer updates
              </p>
            </div>
            <ScrollArea className="h-80">
              {loading ? (
                <p className="p-4 text-sm text-muted-foreground">Loading…</p>
              ) : notifications.length === 0 ? (
                <p className="p-4 text-sm text-muted-foreground">No active alerts</p>
              ) : (
                <div className="divide-y p-1">
                  {notifications.slice(0, 30).map((item) => (
                    <NotificationRow
                      key={item.id}
                      item={item}
                      isRead={isRead(item.id)}
                      onMarkRead={markAsRead}
                    />
                  ))}
                </div>
              )}
            </ScrollArea>
            <div className="flex items-center justify-between gap-2 border-t px-3 py-2">
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-xs"
                disabled={notifications.length === 0}
                onClick={clearAll}
              >
                Clear all
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-xs"
                disabled={unreadCount === 0}
                onClick={markAllAsRead}
              >
                Mark as read
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-xs"
                asChild
              >
                <Link href="/notifications">View all</Link>
              </Button>
            </div>
          </PopoverContent>
        </Popover>

        <Link
          href="/profile"
          className="flex items-center gap-3 rounded-lg border-l border-border pl-4 outline-none transition-opacity hover:opacity-80 focus-visible:ring-2 focus-visible:ring-ring"
          title="View profile"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">
            {user?.full_name?.split(" ").map(n => n[0]).join("") || "U"}
          </div>

          <div className="hidden md:block">
            <p className="text-sm font-medium leading-none text-foreground">
              {user?.full_name || "User"}
            </p>

            <Badge variant="outline" className="mt-1 text-[10px] px-1.5 py-0">
              {user?.roles?.length
                ? user.roles.join(", ")
                : "Viewer"}
            </Badge>
          </div>
        </Link>
      </div>
    </header>
  );
}

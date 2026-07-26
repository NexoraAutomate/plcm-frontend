"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Moon, Sun, Bell, Expand, Minimize2, UserRound, KeyRound, LogOut } from "lucide-react";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { NotificationRow } from "@/components/notifications/notification-row";
import { InventoryReturnDecisionDialog } from "@/components/notifications/inventory-return-decision-dialog";
import { useAppNotifications } from "@/hooks/use-app-notifications";
import { useNotificationSync } from "@/hooks/use-notification-sync";
import { useAppFullscreen } from "@/components/app-fullscreen";
import { UserAvatar } from "@/components/user-avatar";

export function Navbar() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const { active: fullscreenActive, toggle: toggleFullscreen } = useAppFullscreen();
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
    returnDialogNotice,
    setReturnDialogOpen,
    handleNotificationActivate,
    refreshReturnNotices,
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
          onClick={toggleFullscreen}
          title={fullscreenActive ? "Exit fullscreen (Esc)" : "Enter fullscreen"}
          aria-label={fullscreenActive ? "Exit fullscreen" : "Enter fullscreen"}
        >
          {fullscreenActive ? (
            <Minimize2 className="h-4 w-4" />
          ) : (
            <Expand className="h-4 w-4" />
          )}
          <span className="sr-only">
            {fullscreenActive ? "Exit fullscreen" : "Enter fullscreen"}
          </span>
        </Button>

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
                      onActivate={handleNotificationActivate}
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

        <InventoryReturnDecisionDialog
          notice={returnDialogNotice}
          open={returnDialogNotice != null}
          onOpenChange={setReturnDialogOpen}
          onDecided={() => void refreshReturnNotices()}
        />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex items-center gap-3 rounded-lg border-l border-border pl-4 outline-none transition-opacity hover:opacity-80 focus-visible:ring-2 focus-visible:ring-ring"
              title="Account menu"
            >
              {user ? (
                <UserAvatar
                  userId={user.id}
                  fullName={user.full_name}
                  username={user.username}
                  avatarUrl={user.avatar_url}
                  size={32}
                />
              ) : (
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                  U
                </div>
              )}

              <div className="hidden text-left md:block">
                <p className="text-sm font-medium leading-none text-foreground">
                  {user?.full_name || "User"}
                </p>

                <Badge variant="outline" className="mt-1 text-[10px] px-1.5 py-0">
                  {user?.roles?.length ? user.roles.join(", ") : "Viewer"}
                </Badge>
              </div>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium leading-none">
                  {user?.full_name || user?.username || "User"}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {user?.email || user?.username}
                </p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => router.push("/profile")}>
              <UserRound className="h-4 w-4" />
              View profile
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => router.push("/profile?changePassword=1")}>
              <KeyRound className="h-4 w-4" />
              Change password
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              onClick={() => {
                void logout();
              }}
            >
              <LogOut className="h-4 w-4" />
              Logout
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}

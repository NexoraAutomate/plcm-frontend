"use client";

import Link from "next/link";
import { Bell, Moon, Sun, Wrench, AlertTriangle, CheckCircle2, Users, Rocket } from "lucide-react";
import { useTheme } from "next-themes";
import { useAuth } from "@/lib/auth-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import BackendAnimation from '@/components/backend-animation';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAppNotifications, type AppNotification } from "@/hooks/use-app-notifications";
import { useNotificationSync } from "@/hooks/use-notification-sync";
import { formatDistanceToNow } from "date-fns";
import Image from "next/image";




const TYPE_ICON: Record<AppNotification['type'], typeof Bell> = {
  open_maintenance_case: Wrench,
  confirmed_fault: AlertTriangle,
  identified_fault: AlertTriangle,
  suspected_fault: AlertTriangle,
  under_inspection_fault: Wrench,
  case_resolved: CheckCircle2,
  project_completed: Rocket,
  project_updated: Rocket,
  order_updated: Rocket,
  customer_status_change: Users,
};

function NotificationRow({ item }: { item: AppNotification }) {
  const Icon = TYPE_ICON[item.type];
  return (
    <Link
      href={item.href}
      className="flex gap-3 rounded-lg p-3 transition-colors hover:bg-muted/60"
    >
      <div
        className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
          item.priority === 'high'
            ? 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300'
            : item.priority === 'medium'
              ? 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
              : 'bg-muted text-muted-foreground'
        }`}
      >
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium leading-tight">{item.title}</p>
        <p className="truncate text-xs text-muted-foreground">{item.message}</p>
        <p className="mt-1 text-[10px] text-muted-foreground">
          {formatDistanceToNow(new Date(item.timestamp), { addSuffix: true })}
        </p>
      </div>
    </Link>
  );
}

export function Navbar() {
  const { user } = useAuth();
  const { theme, setTheme } = useTheme();
  useNotificationSync();
  const { notifications, unreadCount, highPriorityCount, loading } = useAppNotifications();

  return (
    <header className="flex h-16 items-center justify-between border-b border-border bg-card px-6">
      <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
        {/* <BackendAnimation /> */}
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
                    <NotificationRow key={item.id} item={item} />
                  ))}
                </div>
              )}
            </ScrollArea>
          </PopoverContent>
        </Popover>

        <div className="flex items-center gap-3 border-l border-border pl-4">
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
        </div>
      </div>
    </header>
  );
}

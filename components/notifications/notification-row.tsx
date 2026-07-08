'use client';

import Link from 'next/link';
import { Bell, Wrench, AlertTriangle, CheckCircle2, Users, Rocket } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import type { AppNotification } from '@/lib/app-notifications';
import { cn } from '@/lib/utils';

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

interface NotificationRowProps {
  item: AppNotification;
  isRead?: boolean;
  onMarkRead?: (id: string) => void;
}

export function NotificationRow({ item, isRead = false, onMarkRead }: NotificationRowProps) {
  const Icon = TYPE_ICON[item.type];

  return (
    <Link
      href={item.href}
      onClick={() => onMarkRead?.(item.id)}
      className={cn(
        'flex gap-3 rounded-lg p-3 transition-colors hover:bg-muted/60',
        isRead && 'opacity-70'
      )}
    >
      <div
        className={cn(
          'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
          item.priority === 'high'
            ? 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300'
            : item.priority === 'medium'
              ? 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
              : 'bg-muted text-muted-foreground'
        )}
      >
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-2">
          <p className="flex-1 text-sm font-medium leading-tight">{item.title}</p>
          {!isRead ? (
            <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary" aria-hidden />
          ) : null}
        </div>
        <p className="truncate text-xs text-muted-foreground">{item.message}</p>
        <p className="mt-1 text-[10px] text-muted-foreground">
          {formatDistanceToNow(new Date(item.timestamp), { addSuffix: true })}
        </p>
      </div>
    </Link>
  );
}

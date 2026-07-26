'use client';

import Link from 'next/link';
import { Bell, Wrench, AlertTriangle, CheckCircle2, Users, Rocket, Package } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import type { AppNotification } from '@/lib/app-notifications';
import { parseApiDate } from '@/lib/parse-api-date';
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
  inventory_returned: Package,
  inventory_issued: Package,
  inventory_return_accepted: CheckCircle2,
  inventory_return_rejected: AlertTriangle,
};

interface NotificationRowProps {
  item: AppNotification;
  isRead?: boolean;
  onMarkRead?: (id: string) => void;
  /** When set, inventory return clicks open a decision flow instead of navigating. */
  onActivate?: (item: AppNotification) => void;
}

export function NotificationRow({
  item,
  isRead = false,
  onMarkRead,
  onActivate,
}: NotificationRowProps) {
  const Icon = TYPE_ICON[item.type];
  const isReturnDecision = item.type === 'inventory_returned' && onActivate != null;
  const isPersistentActivate =
    onActivate != null &&
    (item.type === 'inventory_issued' ||
      item.type === 'inventory_return_accepted' ||
      item.type === 'inventory_return_rejected');

  const content = (
    <>
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
          {(() => {
            const date = parseApiDate(item.timestamp);
            if (Number.isNaN(date.getTime())) return '—';
            const relative = formatDistanceToNow(date, { addSuffix: true });
            const absolute = date.toLocaleString();
            return (
              <span title={absolute}>
                {relative}
                <span className="text-muted-foreground/80"> · {absolute}</span>
              </span>
            );
          })()}
        </p>
      </div>
    </>
  );

  const className = cn(
    'flex gap-3 rounded-lg p-3 transition-colors hover:bg-muted/60',
    isRead && 'opacity-70'
  );

  if (isReturnDecision) {
    return (
      <button
        type="button"
        className={cn(className, 'w-full cursor-pointer text-left')}
        onClick={() => onActivate?.(item)}
      >
        {content}
      </button>
    );
  }

  return (
    <Link
      href={item.href}
      onClick={() => {
        if (isPersistentActivate) onActivate?.(item);
        else onMarkRead?.(item.id);
      }}
      className={className}
    >
      {content}
    </Link>
  );
}

'use client';

import { type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export type CommonTask = {
  label: string;
  icon: LucideIcon;
  onClick: () => void;
  badge?: number;
};

interface CommonTasksStripProps {
  tasks: CommonTask[];
  className?: string;
}

export function CommonTasksStrip({ tasks, className }: CommonTasksStripProps) {
  return (
    <div className={cn('rounded-lg border bg-card px-4 py-3', className)}>
      <div className="flex items-start justify-between gap-1">
        {tasks.map((task) => (
          <button
            key={task.label}
            type="button"
            onClick={task.onClick}
            className="group flex min-w-0 flex-1 flex-col items-center gap-2 rounded-lg px-1 py-2 transition-colors hover:bg-muted/60"
          >
            <div className="relative shrink-0">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary transition-colors group-hover:bg-primary/15">
                <task.icon className="h-5 w-5" />
              </div>
              {task.badge != null && task.badge > 0 ? (
                <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-orange-500 px-1 text-[10px] font-semibold text-white">
                  {task.badge > 99 ? '99+' : task.badge}
                </span>
              ) : null}
            </div>
            <span className="w-full text-center text-xs font-medium leading-tight text-foreground">
              {task.label}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

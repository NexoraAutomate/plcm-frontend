'use client';

import { cn } from '@/lib/utils';
import type { TimelineEvent } from '@/lib/api/reports';

export interface ReportTimelineProps {
  events: TimelineEvent[];
  className?: string;
}

function formatWhen(iso?: string | null) {
  if (!iso) return '—';
  const match = String(iso).trim().match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : iso;
}

export function ReportTimeline({ events, className }: ReportTimelineProps) {
  if (!events.length) {
    return (
      <p className="text-sm text-muted-foreground">No timeline events available.</p>
    );
  }

  return (
    <ol className={cn('relative space-y-0 border-l border-border pl-4', className)}>
      {events.map((event, idx) => (
        <li key={`${event.title}-${idx}`} className="relative pb-4 last:pb-0">
          <span className="absolute -left-[1.15rem] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-foreground/70 bg-background" />
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-sm font-medium text-foreground">{event.title}</p>
            <time className="text-xs tabular-nums text-muted-foreground">
              {formatWhen(event.occurred_at)}
            </time>
          </div>
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
            {event.event_type}
            {event.actor ? ` · ${event.actor}` : ''}
          </p>
          {event.description && (
            <p className="mt-0.5 text-xs text-muted-foreground">{event.description}</p>
          )}
        </li>
      ))}
    </ol>
  );
}

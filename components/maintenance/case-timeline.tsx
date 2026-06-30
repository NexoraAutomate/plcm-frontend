'use client';

import { ActionOutcomeBadge } from '@/components/maintenance/badges';
import {
  type CaseTimelineEvent,
  getTimelineEventIcon,
} from '@/lib/maintenance-timeline';

export function CaseTimeline({
  events,
  isLoading = false,
}: {
  events: CaseTimelineEvent[];
  isLoading?: boolean;
}) {
  if (isLoading) {
    return (
      <p className="py-4 text-sm text-muted-foreground">Loading timeline events...</p>
    );
  }

  if (!events.length) {
    return (
      <p className="py-4 text-sm text-muted-foreground">
        No timeline events have been recorded for this maintenance case.
      </p>
    );
  }

  return (
    <div className="relative space-y-0">
      <div className="absolute bottom-2 left-4 top-2 w-px bg-border" />
      {events.map((event) => {
        const Icon = getTimelineEventIcon(event.kind);

        return (
          <div key={event.id} className="relative flex gap-4 pb-6 last:pb-0">
            <div className="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border bg-card">
              <Icon className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="flex-1 space-y-2 rounded-lg border border-border bg-card p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="font-medium">{event.title}</p>
                {event.outcome ? <ActionOutcomeBadge outcome={event.outcome} /> : null}
              </div>
              {event.entityLabel ? (
                <p className="text-sm font-medium text-foreground">Entity: {event.entityLabel}</p>
              ) : null}
              {event.notes ? (
                <p className="text-sm text-muted-foreground">{event.notes}</p>
              ) : null}
              <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                {event.userLabel ? <span>{event.userLabel}</span> : null}
                <span>{new Date(event.performed_at).toLocaleString()}</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

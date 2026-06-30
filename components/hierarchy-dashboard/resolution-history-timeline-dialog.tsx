'use client';

import Link from 'next/link';
import { Package, Replace, Truck, Wrench } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { LifecycleTimelineEvent } from '@/lib/resolution-history-matching';

interface ResolutionHistoryTimelineDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  systemName: string;
  entityFilter?: string;
  events: LifecycleTimelineEvent[];
  loading?: boolean;
}

function timelineIcon(kind: LifecycleTimelineEvent['kind']) {
  switch (kind) {
    case 'installation':
      return Package;
    case 'resolution':
      return Replace;
    case 'removal':
      return Wrench;
    case 'delivery':
      return Truck;
    default:
      return Package;
  }
}

export function TimelineEventRow({
  event,
  onEntitySelect,
}: {
  event: LifecycleTimelineEvent;
  onEntitySelect?: (event: LifecycleTimelineEvent) => void;
}) {
  const Icon = timelineIcon(event.kind);
  const isClickable =
    Boolean(onEntitySelect) &&
    event.kind === 'installation' &&
    event.entityPk != null &&
    event.entityType != null;

  const content = (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium">{event.title}</p>
        <p className="text-xs text-muted-foreground whitespace-nowrap">
          {new Date(event.date).toLocaleString()}
        </p>
      </div>
      <p className="text-xs font-medium text-foreground">{event.entityLabel}</p>
      {event.performedByLabel ? (
        <p className="text-xs text-muted-foreground">Engineer: {event.performedByLabel}</p>
      ) : null}
      {event.details ? (
        <p className="text-sm text-muted-foreground">{event.details}</p>
      ) : null}
      {event.maintenanceCaseId ? (
        <Link
          href={`/maintenance/cases/${event.maintenanceCaseId}`}
          className="text-xs text-primary hover:underline"
          onClick={(e) => e.stopPropagation()}
        >
          Case #{event.maintenanceCaseId}
        </Link>
      ) : null}
    </>
  );

  return (
    <div className="relative flex gap-4 pb-8 last:pb-0">
      <div className="flex flex-col items-center">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border bg-background">
          <Icon className="h-4 w-4 text-muted-foreground" />
        </div>
        <div className="mt-2 w-px flex-1 bg-border" />
      </div>

      <div className="min-w-0 flex-1 pb-1">
        {isClickable ? (
          <button
            type="button"
            className="w-full rounded-md border border-transparent p-2 text-left transition-colors hover:border-border hover:bg-muted/40"
            onClick={() => onEntitySelect?.(event)}
          >
            {content}
          </button>
        ) : (
          <div className="space-y-1 p-2">{content}</div>
        )}
      </div>
    </div>
  );
}

export function ResolutionHistoryTimelineDialog({
  open,
  onOpenChange,
  systemName,
  entityFilter,
  events,
  loading = false,
}: ResolutionHistoryTimelineDialogProps) {
  const title = entityFilter
    ? `Lifecycle timeline — ${entityFilter}`
    : `Lifecycle timeline — ${systemName}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Initial installations and part replacements only, ordered by date and entity level.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <p className="py-6 text-sm text-muted-foreground">Loading timeline...</p>
        ) : events.length === 0 ? (
          <p className="py-6 text-sm text-muted-foreground">
            No lifecycle events found for this selection.
          </p>
        ) : (
          <div className="py-2">
            {events.map((event) => (
              <TimelineEventRow key={event.id} event={event} />
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

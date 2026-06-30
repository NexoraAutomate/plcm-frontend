'use client';

import { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { FaultyEntity } from '@/lib/models';
import { ResolutionType } from '@/lib/models';
import {
  TimelineEventKind,
  type CaseTimelineEvent,
  getTimelineEventIcon,
} from '@/lib/maintenance-timeline';
import { buildInvestigationTree, type InvestigationTreeNode } from '@/lib/maintenance-tree';
import {
  ActionOutcomeBadge,
  FaultyEntityStatusBadge,
  MaintenanceCaseStatusBadge,
  ResolutionTypeBadge,
} from '@/components/maintenance/badges';

interface CaseTimelineTreeProps {
  entities: FaultyEntity[];
  events: CaseTimelineEvent[];
  isLoading?: boolean;
}

function eventsForEntity(entityId: number, events: CaseTimelineEvent[]) {
  return events.filter((event) => event.faultyEntityId === entityId);
}

function caseLevelEvents(events: CaseTimelineEvent[]) {
  return events.filter((event) => event.id.startsWith('case-'));
}

function isActionOutcome(value: string) {
  return ['pass', 'fail', 'pending', 'inconclusive', 'not_applicable'].includes(value);
}

function TimelineEventBadge({
  event,
  entities,
}: {
  event: CaseTimelineEvent;
  entities: FaultyEntity[];
}) {
  const entity = event.faultyEntityId
    ? entities.find((item) => item.id === event.faultyEntityId)
    : undefined;

  switch (event.kind) {
    case TimelineEventKind.CaseOpened:
    case TimelineEventKind.CaseResolved:
    case TimelineEventKind.CaseClosed:
      return event.outcome ? (
        <MaintenanceCaseStatusBadge apiStatus={event.outcome} />
      ) : null;

    case TimelineEventKind.ComponentReplaced:
      return <ResolutionTypeBadge resolutionType={ResolutionType.REPLACED} />;

    case TimelineEventKind.EntityResolved:
      return (
        <ResolutionTypeBadge
          resolutionType={entity?.resolution_type ?? ResolutionType.REPAIRED}
        />
      );

    case TimelineEventKind.EntityIdentified:
    case TimelineEventKind.FaultConfirmed:
      return entity ? (
        <FaultyEntityStatusBadge entity={entity} allEntities={entities} />
      ) : null;

    case TimelineEventKind.InspectionStarted:
    case TimelineEventKind.RepairStarted:
    case TimelineEventKind.VerificationTestPassed:
    case TimelineEventKind.ActionRecorded:
      return event.outcome && isActionOutcome(event.outcome) ? (
        <ActionOutcomeBadge outcome={event.outcome} />
      ) : null;

    default:
      return null;
  }
}

function TimelineEventCard({
  event,
  entities,
}: {
  event: CaseTimelineEvent;
  entities: FaultyEntity[];
}) {
  const Icon = getTimelineEventIcon(event.kind);

  return (
    <div className="flex gap-3 rounded-lg border border-border bg-card p-3">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border bg-background">
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
      </div>
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-medium">{event.title}</p>
          <TimelineEventBadge event={event} entities={entities} />
        </div>
        {event.entityLabel ? (
          <p className="text-xs text-muted-foreground">Entity: {event.entityLabel}</p>
        ) : null}
        {event.notes ? (
          <p className="text-sm text-muted-foreground">{event.notes}</p>
        ) : null}
        <p className="text-xs text-muted-foreground">
          {event.userLabel ? `${event.userLabel} · ` : ''}
          {new Date(event.performed_at).toLocaleString()}
        </p>
      </div>
    </div>
  );
}

function EntityTimelineNode({
  node,
  entityMap,
  events,
  allEntities,
  depth = 0,
}: {
  node: InvestigationTreeNode;
  entityMap: Map<number, FaultyEntity>;
  events: CaseTimelineEvent[];
  allEntities: FaultyEntity[];
  depth?: number;
}) {
  const entity = entityMap.get(node.id);
  const hasChildren = node.children.length > 0;
  const [open, setOpen] = useState(depth < 1);

  if (!entity) return null;

  const entityEvents = eventsForEntity(entity.id, events);

  return (
    <div className="space-y-2">
      <div
        className="flex items-start gap-2 rounded-lg border border-border bg-background p-2"
        style={{ marginLeft: depth * 20 }}
      >
        {hasChildren ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="mt-0.5 h-7 w-7 shrink-0"
            onClick={() => setOpen((current) => !current)}
          >
            {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </Button>
        ) : (
          <span className="mt-0.5 inline-block h-7 w-7 shrink-0" />
        )}

        <div className="min-w-0 flex-1 space-y-2">
          <div className="space-y-1">
            <p className="text-sm font-medium">{node.display_name}</p>
            <FaultyEntityStatusBadge entity={entity} allEntities={allEntities} />
          </div>

          {entityEvents.length > 0 ? (
            <div className="space-y-2">
              {entityEvents.map((event) => (
                <TimelineEventCard key={event.id} event={event} entities={allEntities} />
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">No timeline events for this entity.</p>
          )}
        </div>
      </div>

      {hasChildren && open
        ? node.children.map((child) => (
            <EntityTimelineNode
              key={child.id}
              node={child}
              entityMap={entityMap}
              events={events}
              allEntities={allEntities}
              depth={depth + 1}
            />
          ))
        : null}
    </div>
  );
}

export function CaseTimelineTree({ entities, events, isLoading = false }: CaseTimelineTreeProps) {
  const treeNodes = useMemo(() => buildInvestigationTree(entities), [entities]);
  const entityMap = useMemo(
    () => new Map(entities.map((entity) => [entity.id, entity])),
    [entities]
  );
  const topLevelEvents = useMemo(() => caseLevelEvents(events), [events]);

  if (isLoading) {
    return <p className="py-4 text-sm text-muted-foreground">Loading timeline events...</p>;
  }

  if (!entities.length && !events.length) {
    return (
      <p className="py-4 text-sm text-muted-foreground">
        No timeline events have been recorded for this maintenance case.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {topLevelEvents.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Case Events
          </p>
          {topLevelEvents.map((event) => (
            <TimelineEventCard key={event.id} event={event} entities={entities} />
          ))}
        </div>
      ) : null}

      {treeNodes.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Entity Timeline
          </p>
          {treeNodes.map((node) => (
            <EntityTimelineNode
              key={node.id}
              node={node}
              entityMap={entityMap}
              events={events}
              allEntities={entities}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

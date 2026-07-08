'use client';

import { createContext, useContext } from 'react';
import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import { ChevronRight, CornerDownRight, Edit, History, Plus, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { HierarchyNodeFieldLines } from '@/components/hierarchy-node-legend';
import { CHILD_ENTITY_TYPE, getEntityLabel } from '@/lib/hierarchy-dashboard-entity-config';
import type { HierarchyEntityActionHandlers } from '@/components/hierarchy-dashboard/use-hierarchy-entity-actions';
import type { HierarchyEntityType, HierarchyNodeData } from '@/lib/system-hierarchy-graph';

const LEVEL_STYLES: Record<
  HierarchyEntityType,
  { border: string; badge: string; label: string }
> = {
  system: {
    border: 'border-primary/40',
    badge: 'bg-primary/10 text-primary',
    label: 'System',
  },
  subsystem: {
    border: 'border-sky-400/40',
    badge: 'bg-sky-500/10 text-sky-700 dark:text-sky-300',
    label: 'Subsystem',
  },
  module: {
    border: 'border-violet-400/40',
    badge: 'bg-violet-500/10 text-violet-700 dark:text-violet-300',
    label: 'Module',
  },
  unit: {
    border: 'border-amber-400/40',
    badge: 'bg-amber-500/10 text-amber-700 dark:text-amber-300',
    label: 'Unit',
  },
  component: {
    border: 'border-emerald-400/40',
    badge: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
    label: 'Component',
  },
};

type HierarchyFlowActions = {
  onToggleDetails: (entityId: number, type: HierarchyEntityType) => void;
  onNavigate?: (entityId: number, type: HierarchyEntityType) => void;
  onViewResolutionHistory?: (entityId: number, type: HierarchyEntityType) => void;
  entityActions?: HierarchyEntityActionHandlers;
};

const HierarchyFlowActionsContext = createContext<HierarchyFlowActions | null>(null);

export const HIERARCHY_FLOW_NODE_TYPES = {
  hierarchyNode: HierarchyFlowNode,
};

export function HierarchyFlowActionsProvider({
  children,
  onToggleDetails,
  onNavigate,
  onViewResolutionHistory,
  entityActions,
}: {
  children: React.ReactNode;
  onToggleDetails: HierarchyFlowActions['onToggleDetails'];
  onNavigate?: HierarchyFlowActions['onNavigate'];
  onViewResolutionHistory?: HierarchyFlowActions['onViewResolutionHistory'];
  entityActions?: HierarchyEntityActionHandlers;
}) {
  return (
    <HierarchyFlowActionsContext.Provider
      value={{ onToggleDetails, onNavigate, onViewResolutionHistory, entityActions }}
    >
      {children}
    </HierarchyFlowActionsContext.Provider>
  );
}

function HierarchyFlowNode({ data }: NodeProps<Node<HierarchyNodeData>>) {
  const actions = useContext(HierarchyFlowActionsContext);
  const styles = LEVEL_STYLES[data.type];
  const highlightState = data.highlightState ?? 'normal';
  const canNavigate = Boolean(actions?.onNavigate);

  const handleToggle = (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    actions?.onToggleDetails(data.entityId, data.type);
  };

  const handleNavigate = (event: React.MouseEvent) => {
    if (!canNavigate) return;
    event.preventDefault();
    event.stopPropagation();
    actions?.onNavigate?.(data.entityId, data.type);
  };

  const handleResolutionHistory = (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    actions?.onViewResolutionHistory?.(data.entityId, data.type);
  };

  const showBuildTimeline = Boolean(actions?.onViewResolutionHistory);
  const hasReplacements = Boolean(data.hasResolutionHistory);
  const entityActions = actions?.entityActions;
  const childType = CHILD_ENTITY_TYPE[data.type];
  const typeLabel = getEntityLabel(data.type).toLowerCase();

  const stopEvent = (event: React.SyntheticEvent) => {
    event.preventDefault();
    event.stopPropagation();
  };

  const renderEntityAction = (
    label: string,
    icon: React.ReactNode,
    onClick: () => void,
    className?: string
  ) => (
    <button
      type="button"
      className={cn(
        'nodrag nopan nowheel flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center rounded text-muted-foreground transition-colors hover:bg-accent hover:text-foreground',
        className
      )}
      title={label}
      aria-label={label}
      onPointerDown={stopEvent}
      onClick={(event) => {
        stopEvent(event);
        onClick();
      }}
    >
      {icon}
    </button>
  );

  return (
    <>
      <Handle type="target" position={Position.Top} className="bg-muted-foreground/40!" />
      <div
        role={canNavigate ? 'button' : undefined}
        tabIndex={canNavigate ? 0 : undefined}
        className={cn(
          'nodrag nopan nowheel w-[220px] rounded-lg border bg-card px-3 py-2.5 text-left shadow-sm transition-all',
          styles.border,
          canNavigate && 'cursor-pointer hover:bg-accent/30',
          highlightState === 'selected' &&
            'ring-2 ring-primary shadow-md scale-[1.02] z-10',
          highlightState === 'dimmed' && 'opacity-45 saturate-50',
          entityActions && 'pb-2'
        )}
        onPointerDown={canNavigate ? (event) => event.stopPropagation() : undefined}
        onClick={canNavigate ? handleNavigate : undefined}
        onKeyDown={
          canNavigate
            ? (event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  handleNavigate(event as unknown as React.MouseEvent);
                }
              }
            : undefined
        }
      >
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <Badge variant="outline" className={cn('text-[10px] uppercase', styles.badge)}>
            {styles.label}
          </Badge>
          {(data.replacementSequence ?? 0) > 0 ? (
            <Badge variant="secondary" className="text-[10px]">
              R{data.replacementSequence}
            </Badge>
          ) : null}
          <div className="flex items-center gap-0.5">
            {showBuildTimeline ? (
              <button
                type="button"
                className={cn(
                  'nodrag nopan nowheel relative flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded-md text-amber-700 transition-colors hover:bg-amber-500/10 dark:text-amber-300',
                  hasReplacements && 'ring-1 ring-amber-500/40'
                )}
                title="View initial build timeline"
                aria-label={`View build timeline for ${data.label}`}
                onPointerDown={(event) => event.stopPropagation()}
                onClick={handleResolutionHistory}
              >
                <History className="pointer-events-none h-3.5 w-3.5" aria-hidden="true" />
              </button>
            ) : null}
            <button
              type="button"
              className="nodrag nopan nowheel flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              title="Toggle details panel"
              aria-label={`Toggle details for ${data.label}`}
              onPointerDown={(event) => event.stopPropagation()}
              onClick={handleToggle}
            >
              <ChevronRight className="pointer-events-none h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>
        </div>
        <p
          className={cn(
            'truncate text-sm font-semibold',
            canNavigate && highlightState !== 'selected' && 'hover:text-primary'
          )}
        >
          {data.label}
        </p>
        <HierarchyNodeFieldLines data={data} />
        {entityActions ? (
          <div
            className="mt-2 flex items-center gap-0.5 border-t border-border/60 pt-1.5"
            onPointerDown={stopEvent}
            onClick={stopEvent}
          >
            {renderEntityAction(
              `Add sibling ${typeLabel}`,
              <Plus className="pointer-events-none h-3 w-3" aria-hidden="true" />,
              () => entityActions.onAddSibling(data.entityId, data.type)
            )}
            {childType
              ? renderEntityAction(
                  `Add ${getEntityLabel(childType).toLowerCase()}`,
                  <CornerDownRight className="pointer-events-none h-3 w-3" aria-hidden="true" />,
                  () => entityActions.onAddChild(data.entityId, data.type)
                )
              : null}
            {renderEntityAction(
              `Edit ${typeLabel}`,
              <Edit className="pointer-events-none h-3 w-3" aria-hidden="true" />,
              () => entityActions.onEdit(data.entityId, data.type)
            )}
            {renderEntityAction(
              `Delete ${typeLabel}`,
              <Trash2 className="pointer-events-none h-3 w-3 text-destructive" aria-hidden="true" />,
              () => entityActions.onDelete(data.entityId, data.type, data.label),
              'hover:text-destructive'
            )}
          </div>
        ) : null}
      </div>
      <Handle type="source" position={Position.Bottom} className="bg-muted-foreground/40!"/>
    </>
  );
}

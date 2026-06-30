'use client';

import { createContext, useContext } from 'react';
import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import { ChevronRight, History } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { HierarchyNodeFieldLines } from '@/components/hierarchy-node-legend';
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
}: {
  children: React.ReactNode;
  onToggleDetails: HierarchyFlowActions['onToggleDetails'];
  onNavigate?: HierarchyFlowActions['onNavigate'];
  onViewResolutionHistory?: HierarchyFlowActions['onViewResolutionHistory'];
}) {
  return (
    <HierarchyFlowActionsContext.Provider
      value={{ onToggleDetails, onNavigate, onViewResolutionHistory }}
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
          highlightState === 'dimmed' && 'opacity-45 saturate-50'
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
      </div>
      <Handle type="source" position={Position.Bottom} className="bg-muted-foreground/40!"/>
    </>
  );
}

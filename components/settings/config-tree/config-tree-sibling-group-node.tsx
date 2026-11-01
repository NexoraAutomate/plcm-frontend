'use client';

import { memo } from 'react';
import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import { Maximize2, Minimize2 } from 'lucide-react';
import type { SiblingGroupNodeData } from '@/lib/config-tree-layout';
import { cn } from '@/lib/utils';

type Props = NodeProps<Node<SiblingGroupNodeData>> & {
  onToggleCollapsed?: (groupId: string) => void;
};

/**
 * React Flow parent group — expanded container or collapsed single card.
 * @see https://reactflow.dev/examples/grouping/selection-grouping
 */
export const ConfigTreeSiblingGroupNode = memo(function ConfigTreeSiblingGroupNode({
  data,
  selected,
  onToggleCollapsed,
}: Props) {
  const isVertical = data.layoutDirection === 'TB';
  const interactive = !data.locked && !data.readOnly;

  if (data.collapsed) {
    return (
      <div
        className={cn(
          'relative box-border flex h-full w-full flex-col justify-center overflow-visible rounded-md border px-2 py-1 shadow-sm',
          'border-teal-500 bg-teal-50 text-teal-950',
          'dark:border-teal-400 dark:bg-teal-950/50 dark:text-teal-50',
          selected && 'ring-1 ring-teal-500'
        )}
      >
        <Handle
          type="target"
          position={Position.Left}
          id="target-left"
          className={cn(
            'h-2! w-2! bg-muted-foreground!',
            isVertical ? 'opacity-40' : 'opacity-100'
          )}
        />
        <Handle
          type="target"
          position={Position.Top}
          id="target-top"
          className={cn(
            'h-2! w-2! bg-muted-foreground!',
            isVertical ? 'opacity-100' : 'opacity-40'
          )}
        />
        <Handle
          type="source"
          position={Position.Right}
          id="source-right"
          className={cn(
            'h-2! w-2! bg-teal-600!',
            isVertical ? 'opacity-40' : 'opacity-100'
          )}
        />
        <Handle
          type="source"
          position={Position.Bottom}
          id="source-bottom"
          className={cn(
            'h-2! w-2! bg-teal-600!',
            isVertical ? 'opacity-100' : 'opacity-40'
          )}
        />

        <div className="flex items-start gap-1">
          <div className="min-w-0 flex-1">
            <div className="truncate text-xs font-semibold leading-tight">
              {data.name}
            </div>
            <div className="truncate text-[10px] leading-tight opacity-70">
              Group · {data.memberCount} nodes
            </div>
          </div>
          {interactive && onToggleCollapsed ? (
            <button
              type="button"
              title="Expand group"
              aria-label="Expand group"
              className="nodrag nopan flex size-6 shrink-0 items-center justify-center rounded-md bg-teal-600 text-white transition-colors hover:bg-teal-500 dark:bg-teal-500 dark:hover:bg-teal-400"
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                onToggleCollapsed(data.groupId);
              }}
            >
              <Maximize2 className="size-3.5" />
            </button>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'box-border h-full w-full rounded-2xl border border-dashed',
        'bg-teal-500/[0.07] dark:bg-teal-400/[0.1]',
        selected
          ? 'border-teal-500 shadow-[0_0_0_1px_rgba(20,184,166,0.35)]'
          : 'border-teal-500/45'
      )}
    >
      <div className="absolute left-2 top-1.5 right-2 z-10 flex items-center gap-1.5">
        <span className="min-w-0 truncate rounded-md bg-teal-600 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white dark:bg-teal-500">
          {data.name}
        </span>
        <span className="shrink-0 text-[10px] tabular-nums text-teal-800/70 dark:text-teal-200/70">
          {data.memberCount}
        </span>
        {interactive && onToggleCollapsed ? (
          <button
            type="button"
            title="Collapse group"
            aria-label="Collapse group"
            className="nodrag nopan ml-auto flex size-6 shrink-0 items-center justify-center rounded-md bg-teal-600 text-white transition-colors hover:bg-teal-500 dark:bg-teal-500 dark:hover:bg-teal-400"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              onToggleCollapsed(data.groupId);
            }}
          >
            <Minimize2 className="size-3.5" />
          </button>
        ) : null}
      </div>
    </div>
  );
});

'use client';

import { memo, useState } from 'react';
import {
  Handle,
  NodeResizer,
  Position,
  type Node,
  type NodeProps,
} from '@xyflow/react';
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Pencil,
  Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { ConfigTreeNodeData } from '@/lib/config-tree-layout';
import { LEVEL_NODE_STYLE } from '@/lib/config-tree-level-styles';
import { cn } from '@/lib/utils';

export type ConfigTreeNodeActions = {
  onEdit: (clientKey: string) => void;
  onDelete: (clientKey: string) => void;
  onAddChild: (clientKey: string) => void;
  onAddSiblingAbove: (clientKey: string) => void;
  onAddSiblingBelow: (clientKey: string) => void;
  onAddParentPeer: (clientKey: string) => void;
};

type Props = NodeProps<Node<ConfigTreeNodeData>> & {
  actions: ConfigTreeNodeActions;
};

export const ConfigTreeFlowNode = memo(function ConfigTreeFlowNode({
  data,
  selected,
  actions,
}: Props) {
  const [hovered, setHovered] = useState(false);
  const { draft, label, levelLabel, isDraft, locked, readOnly, canAddChild, layoutDirection } =
    data;
  const interactive = !locked && !readOnly;
  const showResize = interactive && (hovered || selected);
  const isVertical = layoutDirection === 'TB';
  const levelStyle = LEVEL_NODE_STYLE[draft.level];

  return (
    <div
      className={cn(
        'group relative h-full w-full rounded-md border-2 border-l-4 px-2 py-2 shadow-sm transition-colors',
        levelStyle.card,
        isDraft && 'border-dashed border-amber-500',
        data.intersecting && 'ring-2 ring-sky-400',
        data.toBeDeleted && 'opacity-70 ring-2 ring-destructive',
        selected && 'ring-2 ring-primary'
      )}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <NodeResizer
        isVisible={showResize}
        minWidth={200}
        minHeight={88}
        maxWidth={480}
        maxHeight={240}
      />

      <Handle
        type="target"
        position={Position.Left}
        id="target-left"
        className={cn(
          'h-3! w-3! bg-muted-foreground!',
          isVertical ? 'opacity-40' : 'opacity-100'
        )}
      />
      <Handle
        type="target"
        position={Position.Top}
        id="target-top"
        className={cn(
          'h-3! w-3! bg-muted-foreground!',
          isVertical ? 'opacity-100' : 'opacity-40'
        )}
      />
      <Handle
        type="source"
        position={Position.Right}
        id="source-right"
        className={cn('h-3! w-3! bg-primary!', isVertical ? 'opacity-40' : 'opacity-100')}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="source-bottom"
        className={cn('h-3! w-3! bg-primary!', isVertical ? 'opacity-100' : 'opacity-40')}
      />

      <button
        type="button"
        className="w-full text-left"
        onClick={() => {
          if (interactive) actions.onEdit(draft.client_key);
        }}
        disabled={!interactive}
      >
        <div className="truncate text-sm font-medium">
          {label}
          {isDraft ? (
            <span className="ml-1 text-[10px] font-normal text-amber-700 dark:text-amber-300">
              unassigned
            </span>
          ) : null}
        </div>
        <div className="truncate text-[11px] opacity-70">
          {(draft.abbreviation || '—').toUpperCase()} · {levelLabel}
        </div>
      </button>

      {/* Controls only on hover — overlay so node size stays stable */}
      {interactive && hovered ? (
        <div className="absolute inset-x-1 bottom-1 z-10 flex items-center gap-0.5 rounded-md border bg-background/95 p-0.5 shadow-md nodrag nopan">
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-7 w-7"
            title="Add sibling of parent (left)"
            onClick={() => actions.onAddParentPeer(draft.client_key)}
          >
            <ArrowLeft className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-7 w-7"
            title="Add sibling above (up)"
            onClick={() => actions.onAddSiblingAbove(draft.client_key)}
          >
            <ArrowUp className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-7 w-7"
            title="Add child (right)"
            disabled={!canAddChild}
            onClick={() => actions.onAddChild(draft.client_key)}
          >
            <ArrowRight className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-7 w-7"
            title="Add sibling below (down)"
            onClick={() => actions.onAddSiblingBelow(draft.client_key)}
          >
            <ArrowDown className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-7 w-7"
            title="Edit"
            onClick={() => actions.onEdit(draft.client_key)}
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-7 w-7 text-destructive hover:text-destructive"
            title="Delete node and children"
            onClick={() => actions.onDelete(draft.client_key)}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ) : null}
    </div>
  );
});

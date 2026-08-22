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

const ctrlBtn =
  'h-5 w-5 shrink-0 rounded-sm p-0 [&_svg]:h-2.5 [&_svg]:w-2.5';

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
      className="relative h-full w-full"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div
        className={cn(
          'relative flex h-full w-full flex-col justify-center overflow-hidden rounded-md border-2 border-l-4 px-2 py-1 shadow-sm transition-colors',
          levelStyle.card,
          isDraft && 'border-dashed border-amber-500',
          data.intersecting && 'ring-2 ring-sky-400',
          data.toBeDeleted && 'opacity-70 ring-2 ring-destructive',
          selected && 'ring-2 ring-primary'
        )}
      >
        <NodeResizer
          isVisible={showResize}
          minWidth={120}
          minHeight={40}
          maxWidth={320}
          maxHeight={160}
          handleStyle={{ width: 6, height: 6 }}
          lineStyle={{ borderWidth: 1 }}
        />

        <Handle
          type="target"
          position={Position.Left}
          id="target-left"
          className={cn(
            'h-2.5! w-2.5! bg-muted-foreground!',
            isVertical ? 'opacity-40' : 'opacity-100'
          )}
        />
        <Handle
          type="target"
          position={Position.Top}
          id="target-top"
          className={cn(
            'h-2.5! w-2.5! bg-muted-foreground!',
            isVertical ? 'opacity-100' : 'opacity-40'
          )}
        />
        <Handle
          type="source"
          position={Position.Right}
          id="source-right"
          className={cn(
            'h-2.5! w-2.5! bg-primary!',
            isVertical ? 'opacity-40' : 'opacity-100'
          )}
        />
        <Handle
          type="source"
          position={Position.Bottom}
          id="source-bottom"
          className={cn(
            'h-2.5! w-2.5! bg-primary!',
            isVertical ? 'opacity-100' : 'opacity-40'
          )}
        />

        <button
          type="button"
          className="w-full min-w-0 text-left"
          onClick={() => {
            if (interactive) actions.onEdit(draft.client_key);
          }}
          disabled={!interactive}
        >
          <div className="truncate text-xs font-medium leading-tight">
            {label}
            {isDraft ? (
              <span className="ml-1 text-[9px] font-normal text-amber-700 dark:text-amber-300">
                unassigned
              </span>
            ) : null}
          </div>
          <div className="truncate text-[10px] leading-tight opacity-70">
            {(draft.abbreviation || '—').toUpperCase()} · {levelLabel}
          </div>
        </button>
      </div>

      {/* Sit on the lower boundary so the name stays fully visible */}
      {interactive && hovered ? (
        <div
          className="absolute left-1/2 top-full z-20 flex -translate-x-1/2 -translate-y-1/2 items-center gap-px rounded border bg-background px-0.5 py-px shadow-md nodrag nopan"
          onMouseDown={(e) => e.stopPropagation()}
        >
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className={ctrlBtn}
            title="Add sibling of parent (left)"
            onClick={() => actions.onAddParentPeer(draft.client_key)}
          >
            <ArrowLeft />
          </Button>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className={ctrlBtn}
            title="Add sibling above (up)"
            onClick={() => actions.onAddSiblingAbove(draft.client_key)}
          >
            <ArrowUp />
          </Button>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className={ctrlBtn}
            title="Add child (right)"
            disabled={!canAddChild}
            onClick={() => actions.onAddChild(draft.client_key)}
          >
            <ArrowRight />
          </Button>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className={ctrlBtn}
            title="Add sibling below (down)"
            onClick={() => actions.onAddSiblingBelow(draft.client_key)}
          >
            <ArrowDown />
          </Button>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className={ctrlBtn}
            title="Edit"
            onClick={() => actions.onEdit(draft.client_key)}
          >
            <Pencil />
          </Button>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className={cn(ctrlBtn, 'text-destructive hover:text-destructive')}
            title="Delete node and children"
            onClick={() => actions.onDelete(draft.client_key)}
          >
            <Trash2 />
          </Button>
        </div>
      ) : null}
    </div>
  );
});

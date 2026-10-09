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
  Minus,
  Pencil,
  Plus,
  Trash2,
} from 'lucide-react';
import {
  DEFAULT_CONFIG_TREE_NODE_FIELD_VISIBILITY,
  type ConfigTreeNodeData,
} from '@/lib/config-tree-layout';
import { InventorySourceToggle } from '@/components/settings/config-tree/inventory-source-toggle';
import { LEVEL_NODE_STYLE } from '@/lib/config-tree-level-styles';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

export type ConfigTreeNodeActions = {
  onEdit: (clientKey: string) => void;
  onDelete: (clientKey: string) => void;
  onAddChild: (clientKey: string) => void;
  onAddSiblingAbove: (clientKey: string) => void;
  onAddSiblingBelow: (clientKey: string) => void;
  onAddParentPeer: (clientKey: string) => void;
  onToggleChildren: (clientKey: string) => void;
};

type Props = NodeProps<Node<ConfigTreeNodeData>> & {
  actions: ConfigTreeNodeActions;
};

const iconClass = 'h-2.5 w-2.5 stroke-[1.75]';

const toolBtn = cn(
  'inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full',
  'text-muted-foreground/80 transition-colors',
  'hover:bg-muted hover:text-foreground',
  'disabled:pointer-events-none disabled:opacity-30',
  'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'
);

export const ConfigTreeFlowNode = memo(function ConfigTreeFlowNode({
  data,
  selected,
  actions,
}: Props) {
  const [hovered, setHovered] = useState(false);
  const {
    draft,
    label,
    levelLabel,
    isDraft,
    locked,
    readOnly,
    canAddChild,
    layoutDirection,
    hasChildren,
    childrenExpanded,
  } = data;
  const fieldVisibility =
    data.fieldVisibility ?? DEFAULT_CONFIG_TREE_NODE_FIELD_VISIBILITY;
  const interactive = !locked && !readOnly;
  const showResize = interactive && (hovered || selected);
  const isVertical = layoutDirection === 'TB';
  const levelStyle = LEVEL_NODE_STYLE[draft.level];
  const showAbbreviation = fieldVisibility.abbreviation;
  const showLevel = fieldVisibility.level;
  const metaParts = [
    showAbbreviation ? (draft.abbreviation || '—').toUpperCase() : null,
    showLevel ? levelLabel : null,
  ].filter(Boolean);
  const description = draft.description?.trim() ?? '';
  const showDescription = fieldVisibility.description && description.length > 0;

  return (
    <div
      className="relative h-full w-full"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      title={interactive ? 'Click to select · Double-click to edit' : undefined}
    >
      {hasChildren ? (
        <button
          type="button"
          className={cn(
            'absolute z-30 inline-flex h-5 w-5 items-center justify-center rounded-full border border-border bg-background text-foreground shadow-sm nodrag nopan',
            'hover:bg-muted focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
            isVertical
              ? 'bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2'
              : 'right-0 top-1/2 translate-x-1/2 -translate-y-1/2'
          )}
          title={
            childrenExpanded
              ? 'Collapse immediate children'
              : 'Expand immediate children'
          }
          aria-label={
            childrenExpanded
              ? 'Collapse immediate children'
              : 'Expand immediate children'
          }
          aria-expanded={childrenExpanded}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            actions.onToggleChildren(draft.client_key);
          }}
        >
          {childrenExpanded ? (
            <Minus className={iconClass} aria-hidden />
          ) : (
            <Plus className={iconClass} aria-hidden />
          )}
        </button>
      ) : null}

      <div
        className={cn(
          'relative flex h-full w-full flex-col justify-center overflow-hidden rounded-md border px-2 py-1 shadow-sm transition-colors',
          levelStyle.card,
          isDraft && 'border-dashed border-amber-500',
          data.intersecting && 'ring-1 ring-sky-400',
          data.toBeDeleted && 'opacity-70 ring-1 ring-destructive',
          selected && 'ring-1 ring-primary'
        )}
      >
        <NodeResizer
          isVisible={showResize}
          minWidth={120}
          minHeight={48}
          maxWidth={320}
          maxHeight={160}
          handleStyle={{ width: 4, height: 4 }}
          lineStyle={{ borderWidth: 1 }}
        />

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
            'h-2! w-2! bg-primary!',
            isVertical ? 'opacity-40' : 'opacity-100'
          )}
        />
        <Handle
          type="source"
          position={Position.Bottom}
          id="source-bottom"
          className={cn(
            'h-2! w-2! bg-primary!',
            isVertical ? 'opacity-100' : 'opacity-40'
          )}
        />

        <div className="w-full min-w-0">
          <div className="truncate text-xs font-medium leading-tight">
            {label}
            {isDraft ? (
              <span className="ml-1 text-[9px] font-normal text-amber-700 dark:text-amber-300">
                unassigned
              </span>
            ) : null}
          </div>
          {metaParts.length > 0 ? (
            <div className="truncate text-[10px] leading-tight opacity-70">
              {metaParts.join(' · ')}
            </div>
          ) : null}
          {showDescription ? (
            <div className="mt-0.5 truncate text-[10px] leading-tight text-muted-foreground">
              {description}
            </div>
          ) : null}
          {fieldVisibility.inventorySource ? (
            <InventorySourceToggle
              size="node"
              value={draft.inventory_source}
              canBuild={data.canBuildFromChildren}
              disabled={!interactive}
              onDenied={(_, reason) => {
                if (interactive) toast.error(reason);
              }}
            />
          ) : null}
        </div>
      </div>

      {interactive && hovered ? (
        <div
          className="absolute left-1/2 top-full z-20 flex -translate-x-1/2 -translate-y-1/2 items-center gap-px rounded-full border border-border/80 bg-background/95 px-0.5 py-px shadow-sm backdrop-blur-sm nodrag nopan"
          onMouseDown={(e) => e.stopPropagation()}
          role="toolbar"
          aria-label="Node actions"
        >
          <button
            type="button"
            className={toolBtn}
            title="Add sibling of parent"
            onClick={() => actions.onAddParentPeer(draft.client_key)}
          >
            <ArrowLeft className={iconClass} aria-hidden />
          </button>
          <button
            type="button"
            className={toolBtn}
            title="Add sibling above"
            onClick={() => actions.onAddSiblingAbove(draft.client_key)}
          >
            <ArrowUp className={iconClass} aria-hidden />
          </button>
          <button
            type="button"
            className={toolBtn}
            title="Add child"
            disabled={!canAddChild}
            onClick={() => actions.onAddChild(draft.client_key)}
          >
            <ArrowRight className={iconClass} aria-hidden />
          </button>
          <button
            type="button"
            className={toolBtn}
            title="Add sibling below"
            onClick={() => actions.onAddSiblingBelow(draft.client_key)}
          >
            <ArrowDown className={iconClass} aria-hidden />
          </button>

          <span className="mx-0.5 h-3 w-px shrink-0 bg-border" aria-hidden />

          <button
            type="button"
            className={toolBtn}
            title="Edit"
            onClick={() => actions.onEdit(draft.client_key)}
          >
            <Pencil className={iconClass} aria-hidden />
          </button>
          <button
            type="button"
            className={cn(
              toolBtn,
              'hover:bg-destructive/10 hover:text-destructive'
            )}
            title="Delete node and children"
            onClick={() => actions.onDelete(draft.client_key)}
          >
            <Trash2 className={iconClass} aria-hidden />
          </button>
        </div>
      ) : null}
    </div>
  );
});

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
import type { TemplateNodeLevel } from '@/lib/hierarchy-config';
import { cn } from '@/lib/utils';

const LEVEL_ACCENT: Record<TemplateNodeLevel, string> = {
  system: 'border-l-blue-500',
  subsystem: 'border-l-violet-500',
  module: 'border-l-emerald-500',
  unit: 'border-l-amber-500',
  component: 'border-l-slate-400',
};

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
  const { draft, label, levelLabel, isDraft, locked, readOnly, canAddChild } = data;
  const interactive = !locked && !readOnly;
  const showResize = interactive && (hovered || selected);

  return (
    <div
      className={cn(
        'group relative h-full w-full rounded-md border border-l-4 bg-background px-2 py-2 shadow-sm transition-colors',
        LEVEL_ACCENT[draft.level],
        isDraft && 'border-dashed border-amber-400 bg-amber-50/70 dark:bg-amber-950/20',
        data.intersecting && 'bg-sky-100 dark:bg-sky-950/50 ring-2 ring-sky-400',
        data.toBeDeleted &&
          'bg-red-100/90 opacity-70 ring-2 ring-destructive dark:bg-red-950/60',
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

      {/* Easy-connect: large handles around the node */}
      <Handle
        type="target"
        position={Position.Left}
        id="target-left"
        className="!h-3 !w-3 !bg-muted-foreground"
      />
      <Handle
        type="target"
        position={Position.Top}
        id="target-top"
        className="!h-3 !w-3 !bg-muted-foreground"
      />
      <Handle
        type="source"
        position={Position.Right}
        id="source-right"
        className="!h-3 !w-3 !bg-primary"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="source-bottom"
        className="!h-3 !w-3 !bg-primary"
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
            <span className="ml-1 text-[10px] font-normal text-amber-700">new</span>
          ) : null}
        </div>
        <div className="truncate text-[11px] text-muted-foreground">
          {(draft.abbreviation || '—').toUpperCase()} · {levelLabel}
        </div>
      </button>

      {interactive ? (
        <div className="mt-1.5 flex items-center gap-0.5 border-t pt-1.5 nodrag nopan">
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

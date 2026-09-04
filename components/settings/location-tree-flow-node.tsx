'use client';

import { memo } from 'react';
import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import {
  LOCATION_LEVEL_LABEL,
  type LocationLevel,
  type LocationTreeNodeData,
} from '@/lib/inventory-location-tree';
import { cn } from '@/lib/utils';

export type LocationTreeNodeActions = {
  onAdd: (nodeId: string) => void;
  onEdit: (nodeId: string) => void;
  onDelete: (nodeId: string) => void;
};

const LEVEL_STYLE: Record<LocationLevel, string> = {
  room: 'border-sky-300 bg-sky-50 text-sky-950',
  cabinet: 'border-amber-300 bg-amber-50 text-amber-950',
  rack: 'border-emerald-300 bg-emerald-50 text-emerald-950',
};

const LEVEL_BADGE: Record<LocationLevel, string> = {
  room: 'bg-sky-200/80 text-sky-900',
  cabinet: 'bg-amber-200/80 text-amber-900',
  rack: 'bg-emerald-200/80 text-emerald-900',
};

type Props = NodeProps<Node<LocationTreeNodeData>> & {
  actions: LocationTreeNodeActions;
};

export const LocationTreeFlowNode = memo(function LocationTreeFlowNode({
  id,
  data,
  selected,
  actions,
}: Props) {
  const interactive = !data.readOnly;

  return (
    <div
      className={cn(
        'flex h-full w-full flex-col justify-center rounded-md border px-2.5 py-1.5 shadow-sm',
        LEVEL_STYLE[data.level],
        selected && 'ring-2 ring-primary ring-offset-1'
      )}
    >
      <Handle type="target" position={Position.Top} className="h-2! w-2! bg-muted-foreground!" />
      <div className="flex items-start justify-between gap-1">
        <div className="min-w-0">
          <span
            className={cn(
              'inline-flex rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
              LEVEL_BADGE[data.level]
            )}
          >
            {LOCATION_LEVEL_LABEL[data.level]}
          </span>
          <p className="mt-1 truncate text-sm font-medium leading-tight">{data.name}</p>
        </div>
        {interactive ? (
          <div className="flex shrink-0 items-center gap-0.5">
            <button
              type="button"
              className="rounded p-0.5 text-muted-foreground hover:bg-white/70 hover:text-foreground"
              title="Add"
              onClick={(event) => {
                event.stopPropagation();
                actions.onAdd(id);
              }}
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              className="rounded p-0.5 text-muted-foreground hover:bg-white/70 hover:text-foreground"
              title="Edit"
              onClick={(event) => {
                event.stopPropagation();
                actions.onEdit(id);
              }}
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              className="rounded p-0.5 text-muted-foreground hover:bg-white/70 hover:text-destructive"
              title="Delete"
              onClick={(event) => {
                event.stopPropagation();
                actions.onDelete(id);
              }}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : null}
      </div>
      <Handle type="source" position={Position.Bottom} className="h-2! w-2! bg-muted-foreground!" />
    </div>
  );
});

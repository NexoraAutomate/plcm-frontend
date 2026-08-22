'use client';

import {
  BaseEdge,
  EdgeLabelRenderer,
  getSmoothStepPath,
  MarkerType,
  type Edge,
  type EdgeProps,
} from '@xyflow/react';
import { X } from 'lucide-react';
import type { ConfigTreeEdgeData } from '@/lib/config-tree-layout';
import { cn } from '@/lib/utils';

type Props = EdgeProps<Edge<ConfigTreeEdgeData>> & {
  onDeleteEdge?: (edgeId: string) => void;
  locked?: boolean;
};

export function ConfigAnimatedEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style,
  markerEnd,
  data,
  selected,
  onDeleteEdge,
  locked,
}: Props) {
  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={
          markerEnd ?? {
            type: MarkerType.ArrowClosed,
            width: 18,
            height: 18,
            color: data?.toBeDeleted ? '#ef4444' : '#64748b',
          }
        }
        style={{
          ...style,
          stroke: data?.toBeDeleted ? '#ef4444' : selected ? '#2563eb' : '#64748b',
          strokeWidth: selected || data?.toBeDeleted ? 2.5 : 1.75,
        }}
        className={cn(data?.toBeDeleted && 'opacity-50')}
      />
      {/* Animated pulse along the path */}
      <circle r="4" fill="#2563eb">
        <animateMotion dur="2.4s" repeatCount="indefinite" path={edgePath} />
      </circle>
      {!locked && onDeleteEdge ? (
        <EdgeLabelRenderer>
          <button
            type="button"
            className="nodrag nopan absolute flex h-5 w-5 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border bg-background text-destructive shadow opacity-0 transition-opacity hover:opacity-100"
            style={{
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              pointerEvents: 'all',
              opacity: selected ? 1 : undefined,
            }}
            title="Delete edge"
            onClick={(e) => {
              e.stopPropagation();
              onDeleteEdge(id);
            }}
          >
            <X className="h-3 w-3" />
          </button>
        </EdgeLabelRenderer>
      ) : null}
    </>
  );
}

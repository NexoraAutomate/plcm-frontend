'use client';

import { useCallback, useEffect, useMemo, useState, type MouseEvent } from 'react';
import {
  Controls,
  MarkerType,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Node,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { ChevronsDownUp, ChevronsUpDown } from 'lucide-react';
import {
  buildOnboardingFlowElements,
  expandableGroupIds,
  type OnboardingFlowDiagram,
  type OnboardingFlowNodeData,
} from '@/lib/onboarding/diagrams';
import { onboardingFlowNodeTypes } from '@/components/onboarding/workflow-flow-nodes';
import { Button } from '@/components/ui/button';
import { TooltipProvider } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

type WorkflowFlowDiagramProps = {
  diagram: OnboardingFlowDiagram;
  className?: string;
  heightClassName?: string;
};

function FitViewOnChange({ dependencyKey }: { dependencyKey: string }) {
  const { fitView } = useReactFlow();

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      fitView({ padding: 0.18, duration: 280 });
    });
    return () => cancelAnimationFrame(frame);
  }, [dependencyKey, fitView]);

  return null;
}

function WorkflowFlowCanvas({
  diagram,
  className,
  heightClassName,
}: WorkflowFlowDiagramProps) {
  const groupIds = useMemo(() => expandableGroupIds(diagram), [diagram]);
  const [expanded, setExpanded] = useState<Set<string>>(
    () => new Set(diagram.initiallyExpanded ?? [])
  );

  const built = useMemo(
    () => buildOnboardingFlowElements(diagram, expanded),
    [diagram, expanded]
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(built.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(built.edges);

  useEffect(() => {
    setNodes(built.nodes);
    setEdges(built.edges);
  }, [built, setNodes, setEdges]);

  const allExpanded =
    groupIds.length > 0 && groupIds.every((id) => expanded.has(id));

  const expandAll = useCallback(() => {
    setExpanded(new Set(groupIds));
  }, [groupIds]);

  const collapseAll = useCallback(() => {
    setExpanded(new Set());
  }, []);

  const onNodeClick = useCallback((_event: MouseEvent, node: Node) => {
    const data = node.data as OnboardingFlowNodeData;
    if (data.kind !== 'group' || !data.groupId) return;
    const groupId = data.groupId;
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  }, []);

  const dependencyKey = `${diagram.id}:${[...expanded].sort().join(',')}`;

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-lg border bg-muted/20',
        heightClassName ?? 'h-[28rem]',
        className
      )}
    >
      <div className="absolute left-3 top-3 z-20 flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 gap-1.5 bg-background/95 text-xs shadow-sm backdrop-blur-sm"
          onClick={allExpanded ? collapseAll : expandAll}
          disabled={groupIds.length === 0}
        >
          {allExpanded ? (
            <>
              <ChevronsDownUp className="size-3.5" aria-hidden />
              Collapse All
            </>
          ) : (
            <>
              <ChevronsUpDown className="size-3.5" aria-hidden />
              Expand All
            </>
          )}
        </Button>
      </div>

      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        nodeTypes={onboardingFlowNodeTypes}
        defaultEdgeOptions={{
          type: 'smoothstep',
          markerEnd: { type: MarkerType.ArrowClosed, width: 18, height: 18 },
        }}
        fitView
        minZoom={0.35}
        maxZoom={1.6}
        proOptions={{ hideAttribution: true }}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        zoomOnScroll
        zoomOnPinch
        panOnScroll={false}
        panOnDrag
        selectionOnDrag={false}
        preventScrolling
        className="[&_.react-flow__handle]:!h-px [&_.react-flow__handle]:!w-px [&_.react-flow__handle]:!min-h-0 [&_.react-flow__handle]:!min-w-0 [&_.react-flow__handle]:!border-0 [&_.react-flow__handle]:!bg-transparent [&_.react-flow__handle]:!opacity-0 [&_.react-flow__edge-path]:stroke-[1.5] [&_.react-flow__attribution]:hidden"
      >
        <Controls showInteractive={false} />
        <MiniMap pannable zoomable className="!bg-background" />
        <FitViewOnChange dependencyKey={dependencyKey} />
      </ReactFlow>
    </div>
  );
}

export function WorkflowFlowDiagram(props: WorkflowFlowDiagramProps) {
  return (
    <TooltipProvider delayDuration={280}>
      <ReactFlowProvider>
        <WorkflowFlowCanvas {...props} />
      </ReactFlowProvider>
    </TooltipProvider>
  );
}

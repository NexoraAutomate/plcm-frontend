'use client';

import { useCallback, useMemo, useState } from 'react';
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { cn } from '@/lib/utils';
import {
  buildSystemHierarchyTree,
  hierarchyTreeToFlow,
  DEFAULT_NODE_FIELD_VISIBILITY,
  type HierarchyEntityType,
  type HierarchyNodeFieldVisibility,
} from '@/lib/system-hierarchy-graph';
import {
  HierarchyEntityDetailPanel,
  type HierarchyEntitySelection,
} from '@/components/hierarchy-entity-detail-panel';
import { HierarchyNodeLegend } from '@/components/hierarchy-node-legend';
import {
  HIERARCHY_FLOW_NODE_TYPES,
  HierarchyFlowActionsProvider,
} from '@/components/hierarchy/hierarchy-flow-node';
import type {
  Component,
  Module,
  Project,
  Status,
  Subsystem,
  System,
  Unit,
} from '@/lib/models';

interface SystemHierarchyFlowProps {
  system: System;
  subsystems: Subsystem[];
  modules: Module[];
  units: Unit[];
  components: Component[];
  project?: Project;
  statuses?: Status[];
  className?: string;
}

export function SystemHierarchyFlow({
  system,
  subsystems,
  modules,
  units,
  components,
  project,
  statuses = [],
  className,
}: SystemHierarchyFlowProps) {
  const [panel, setPanel] = useState<{
    open: boolean;
    selection: HierarchyEntitySelection | null;
  }>({ open: false, selection: null });
  const [fieldVisibility, setFieldVisibility] = useState<HierarchyNodeFieldVisibility>(
    DEFAULT_NODE_FIELD_VISIBILITY
  );

  const handleToggleDetails = useCallback((entityId: number, type: HierarchyEntityType) => {
    setPanel((prev) => {
      const isSameEntity =
        prev.selection?.entityId === entityId && prev.selection?.type === type;
      if (prev.open && isSameEntity) {
        return { ...prev, open: false };
      }
      return { open: true, selection: { entityId, type } };
    });
  }, []);

  const handleClosePanel = useCallback(() => {
    setPanel((prev) => ({ ...prev, open: false }));
  }, []);

  const { nodes, edges } = useMemo(() => {
    const tree = buildSystemHierarchyTree(
      system,
      subsystems,
      modules,
      units,
      components,
      statuses
    );
    const flow = hierarchyTreeToFlow(tree);

    return {
      nodes: flow.nodes.map((node) => ({
        ...node,
        data: {
          ...node.data,
          fieldVisibility,
        },
      })),
      edges: flow.edges,
    };
  }, [system, subsystems, modules, units, components, fieldVisibility, statuses]);

  if (nodes.length <= 1 && edges.length === 0) {
    return (
      <div
        className={cn(
          'flex h-full min-h-[420px] items-center justify-center rounded-lg border border-dashed bg-muted/20',
          className
        )}
      >
        <p className="text-sm text-muted-foreground">
          No subsystems found for this system. Add subsystems to build the hierarchy graph.
        </p>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'flex h-full min-h-[420px] w-full overflow-hidden rounded-lg border bg-muted/10',
        className
      )}
    >
      <div className="relative min-w-0 flex-1">
        <HierarchyNodeLegend
          visibility={fieldVisibility}
          onChange={setFieldVisibility}
        />
        <ReactFlowProvider>
          <HierarchyFlowActionsProvider onToggleDetails={handleToggleDetails}>
            <ReactFlow
              nodes={nodes}
              edges={edges}
              nodeTypes={HIERARCHY_FLOW_NODE_TYPES}
              fitView
              fitViewOptions={{ padding: 0.2 }}
              nodesDraggable={false}
              nodesConnectable={false}
              elementsSelectable={false}
              zoomOnScroll
              onNodeClick={() => undefined}
              proOptions={{ hideAttribution: true }}
            >
              <Background gap={16} size={1} />
              <Controls showInteractive={false} />
              <MiniMap
                nodeStrokeWidth={3}
                pannable
                zoomable
                className="!bg-background/80"
              />
            </ReactFlow>
          </HierarchyFlowActionsProvider>
        </ReactFlowProvider>
      </div>

      <HierarchyEntityDetailPanel
        selection={panel.selection}
        open={panel.open}
        onClose={handleClosePanel}
        systems={[system]}
        subsystems={subsystems}
        modules={modules}
        units={units}
        components={components}
        project={project}
        statuses={statuses}
      />
    </div>
  );
}

'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { cn } from '@/lib/utils';
import {
  buildProjectHierarchyFlow,
  collectProjectEntityRefs,
  type HierarchyDashboardSelection,
} from '@/lib/project-hierarchy-dashboard';
import {
  DEFAULT_NODE_FIELD_VISIBILITY,
  applyAssignmentStatusToNodes,
  applyInventoryFlagsToNodes,
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
import { useProjectInventoryFlags } from '@/hooks/use-project-inventory-flags';
import { useHierarchyAssignmentStatuses } from '@/hooks/use-hierarchy-assignment-statuses';

interface ProjectHierarchyFlowProps {
  selection: HierarchyDashboardSelection;
  systems: System[];
  subsystems: Subsystem[];
  modules: Module[];
  units: Unit[];
  components: Component[];
  project?: Project;
  statuses?: Status[];
  className?: string;
  onNodeSelect?: (entityId: number, type: HierarchyEntityType) => void;
}

function FitViewOnSelectionChange({ dependencyKey }: { dependencyKey: string }) {
  const { fitView } = useReactFlow();

  useEffect(() => {
    if (!dependencyKey) return;

    const frame = requestAnimationFrame(() => {
      fitView({ padding: 0.2, duration: 250 });
    });

    return () => cancelAnimationFrame(frame);
  }, [dependencyKey, fitView]);

  return null;
}

export function ProjectHierarchyFlow({
  selection,
  systems,
  subsystems,
  modules,
  units,
  components,
  project,
  statuses = [],
  className,
  onNodeSelect,
}: ProjectHierarchyFlowProps) {
  const [panel, setPanel] = useState<{
    open: boolean;
    selection: HierarchyEntitySelection | null;
  }>({ open: false, selection: null });
  const [fieldVisibility, setFieldVisibility] = useState<HierarchyNodeFieldVisibility>(
    DEFAULT_NODE_FIELD_VISIBILITY
  );
  const inventoryFlags = useProjectInventoryFlags(selection.projectId ?? project?.id);
  const assignmentEntityRefs = useMemo(
    () =>
      collectProjectEntityRefs(
        selection.projectId ?? project?.id ?? 0,
        systems,
        subsystems,
        modules,
        units,
        components
      ),
    [selection.projectId, project?.id, systems, subsystems, modules, units, components]
  );
  const assignmentStatuses = useHierarchyAssignmentStatuses(assignmentEntityRefs);

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

  const handleNavigate = useCallback(
    (entityId: number, type: HierarchyEntityType) => {
      onNodeSelect?.(entityId, type);
    },
    [onNodeSelect]
  );

  const { nodes, edges } = useMemo(() => {
    const flow = buildProjectHierarchyFlow(
      selection,
      systems,
      subsystems,
      modules,
      units,
      components,
      statuses
    );

    return {
      nodes: applyAssignmentStatusToNodes(
        applyInventoryFlagsToNodes(
        flow.nodes.map((node) => ({
          ...node,
          data: {
            ...node.data,
            fieldVisibility,
          },
        })),
        inventoryFlags
      ),
        assignmentStatuses
      ),
      edges: flow.edges,
    };
  }, [
    selection,
    systems,
    subsystems,
    modules,
    units,
    components,
    statuses,
    fieldVisibility,
    inventoryFlags,
    assignmentStatuses,
  ]);

  const fitViewKey = useMemo(
    () =>
      [
        selection.projectId,
        selection.systemId,
        selection.subsystemId,
        selection.moduleId,
        selection.unitId,
        selection.componentId,
      ]
        .filter(Boolean)
        .join(':'),
    [selection]
  );

  useEffect(() => {
    if (!selection.projectId) {
      setPanel({ open: false, selection: null });
    }
  }, [selection.projectId]);

  if (!selection.projectId) {
    return (
      <div
        className={cn(
          'flex h-full min-h-105 items-center justify-center rounded-lg border border-dashed bg-muted/20',
          className
        )}
      >
        <p className="text-sm text-muted-foreground">
          Select a running project to view its hierarchy.
        </p>
      </div>
    );
  }

  if (nodes.length === 0) {
    return (
      <div
        className={cn(
          'flex h-full min-h-105 items-center justify-center rounded-lg border border-dashed bg-muted/20',
          className
        )}
      >
        <p className="text-sm text-muted-foreground">
          No systems found for this project. Add systems to build the hierarchy graph.
        </p>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'flex h-full min-h-105 w-full overflow-hidden rounded-lg border bg-muted/10',
        className
      )}
    >
      <div className="relative min-w-0 flex-1">
        <HierarchyNodeLegend
          visibility={fieldVisibility}
          onChange={setFieldVisibility}
        />
        <ReactFlowProvider>
          <HierarchyFlowActionsProvider
            onToggleDetails={handleToggleDetails}
            onNavigate={handleNavigate}
          >
            <ReactFlow
              nodes={nodes}
              edges={edges}
              nodeTypes={HIERARCHY_FLOW_NODE_TYPES}
              nodesDraggable={false}
              nodesConnectable={false}
              elementsSelectable={false}
              zoomOnScroll
              onNodeClick={() => undefined}
              proOptions={{ hideAttribution: true }}
            >
              <FitViewOnSelectionChange dependencyKey={fitViewKey} />
              <Background gap={16} size={1} />
              <Controls showInteractive={false} />
              <MiniMap
                nodeStrokeWidth={3}
                pannable
                zoomable
                className="bg-background/80!"
              />
            </ReactFlow>
          </HierarchyFlowActionsProvider>
        </ReactFlowProvider>
      </div>

      <HierarchyEntityDetailPanel
        selection={panel.selection}
        open={panel.open}
        onClose={() => setPanel((prev) => ({ ...prev, open: false }))}
        systems={systems}
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

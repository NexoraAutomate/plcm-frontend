'use client';

import {
  createContext,
  memo,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  Background,
  BackgroundVariant,
  Controls,
  Handle,
  MiniMap,
  Panel,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type NodeProps,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  buildEntityLookupFlow,
  DEFAULT_VISIBLE_FIELDS,
  ENTITY_NODE_WIDTH,
  getMiniMapNodeColor,
  getRoleLabel,
  type EntityFlowFieldKey,
  type EntityFlowNodeData,
  toEntityLookupNode,
} from '@/lib/entity-lookup-flow';
import type { EntityLookupNode, lookUpResponse } from '@/lib/models';
import { EntityFlowFieldSlicer } from './EntityFlowFieldSlicer';

interface EntityLookupFlowContextValue {
  caseId?: number | null;
  onConfirmFault?: (node: EntityLookupNode) => Promise<void>;
  visibleFields: Set<EntityFlowFieldKey>;
}

const EntityLookupFlowContext = createContext<EntityLookupFlowContextValue>({
  visibleFields: new Set(DEFAULT_VISIBLE_FIELDS),
});

const roleStyles: Record<EntityFlowNodeData['role'], string> = {
  business:
    'border-sky-300 bg-sky-50 text-foreground shadow-sm dark:border-sky-700 dark:bg-sky-950/40',
  hardware:
    'border-indigo-300 bg-indigo-50 text-foreground shadow-sm dark:border-indigo-700 dark:bg-indigo-950/40',
  matched:
    'border-amber-400 bg-amber-50 text-foreground shadow-md ring-2 ring-amber-200/80 dark:border-amber-600 dark:bg-amber-950/40 dark:ring-amber-900/50',
  descendant: 'border-border bg-card text-foreground shadow-sm dark:bg-card',
};

function EntityFlowNodeComponent({ data }: NodeProps) {
  const nodeData = data as EntityFlowNodeData;
  const { caseId, onConfirmFault, visibleFields } = useContext(EntityLookupFlowContext);

  return (
    <div
      className={cn(
        'cursor-grab rounded-xl border px-4 py-3 text-left transition-shadow active:cursor-grabbing hover:shadow-md',
        roleStyles[nodeData.role]
      )}
      style={{ width: ENTITY_NODE_WIDTH }}
    >
      <Handle type="target" position={Position.Top} className="bg-muted-foreground!" />
      <Handle type="source" position={Position.Bottom} className="bg-muted-foreground!" />

      {(visibleFields.has('role_label') || visibleFields.has('entity_type')) && (
        <div className="mb-2 flex flex-wrap items-start gap-2">
          {visibleFields.has('role_label') ? (
            <Badge variant="outline" className="text-[10px] uppercase">
              {getRoleLabel(nodeData.role)}
            </Badge>
          ) : null}
          {visibleFields.has('entity_type') ? (
            <Badge variant="secondary" className="text-[10px] uppercase">
              {nodeData.entity_type}
            </Badge>
          ) : null}
        </div>
      )}

      {visibleFields.has('entity_name') ? (
        <p className="line-clamp-2 text-sm font-semibold leading-tight text-foreground">
          {nodeData.entity_name}
        </p>
      ) : null}

      <div className="mt-2 space-y-1 text-xs text-muted-foreground">
        {visibleFields.has('part_number') ? (
          <p className="truncate">PN: {nodeData.entity_PartNumber || 'N/A'}</p>
        ) : null}
        {visibleFields.has('serial_number') ? (
          <p className="truncate">SN: {nodeData.entity_SerialNumber || 'N/A'}</p>
        ) : null}
        {visibleFields.has('entity_id') ? (
          <p className="truncate">ID: {nodeData.entity_id}</p>
        ) : null}
      </div>

      {caseId && onConfirmFault && nodeData.role === 'descendant' ? (
        <Button
          variant="outline"
          size="sm"
          className="mt-3 h-8 w-full text-xs"
          onClick={() => onConfirmFault(toEntityLookupNode(nodeData))}
        >
          Confirm Fault
        </Button>
      ) : null}
    </div>
  );
}

const nodeTypes = {
  entityFlowNode: memo(EntityFlowNodeComponent),
};

function FitViewOnLoad({ dependencyKey }: { dependencyKey: string }) {
  const { fitView } = useReactFlow();

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      fitView({ padding: 0.35, minZoom: 0.35, maxZoom: 1.25, duration: 250 });
    });

    return () => cancelAnimationFrame(frame);
  }, [dependencyKey, fitView]);

  return null;
}

interface EntityLookupFlowProps {
  response: lookUpResponse;
  caseId?: number | null;
  onConfirmFault?: (node: EntityLookupNode) => Promise<void>;
}

function EntityLookupFlowCanvas({
  response,
  caseId,
  onConfirmFault,
  visibleFields,
  onToggleField,
}: EntityLookupFlowProps & {
  visibleFields: Set<EntityFlowFieldKey>;
  onToggleField: (field: EntityFlowFieldKey, checked: boolean) => void;
}) {
  const initialGraph = useMemo(() => buildEntityLookupFlow(response), [response]);
  const [nodes, setNodes, onNodesChange] = useNodesState(initialGraph.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialGraph.edges);

  useEffect(() => {
    const graph = buildEntityLookupFlow(response);
    setNodes(graph.nodes);
    setEdges(graph.edges);
  }, [response, setNodes, setEdges]);

  const contextValue = useMemo(
    () => ({ caseId, onConfirmFault, visibleFields }),
    [caseId, onConfirmFault, visibleFields]
  );

  const dependencyKey = `${response.matched_entity_id}-${response.matched_entity_type}-${nodes.length}`;

  return (
    <EntityLookupFlowContext.Provider value={contextValue}>
      <div className="h-full w-full">
        <ReactFlow
          className="h-full w-full"
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          minZoom={0.15}
          maxZoom={2}
          nodesDraggable
          nodesConnectable={false}
          elementsSelectable
          proOptions={{ hideAttribution: true }}
        >
          <Background variant={BackgroundVariant.Dots} gap={20} size={1} />
          <Controls showInteractive={false} />
          <MiniMap
            pannable
            zoomable
            nodeColor={(node) =>
              getMiniMapNodeColor((node.data as EntityFlowNodeData)?.role)
            }
            maskColor="hsl(var(--background) / 0.75)"
          />
          <EntityFlowFieldSlicer
            visibleFields={visibleFields}
            onToggleField={onToggleField}
          />
          <Panel position="top-left" className="m-3!">
            <div className="rounded-lg border border-border bg-background/95 px-3 py-2 text-[11px] text-muted-foreground shadow-sm backdrop-blur-sm">
              <span className="font-medium text-sky-700 dark:text-sky-300">Business</span>
              <span> · </span>
              <span className="font-medium text-indigo-700 dark:text-indigo-300">Hardware</span>
              <span> · </span>
              <span className="font-medium text-amber-700 dark:text-amber-300">Matched</span>
              <span> · </span>
              <span className="font-medium text-foreground">Descendant</span>
            </div>
          </Panel>
          <FitViewOnLoad dependencyKey={dependencyKey} />
        </ReactFlow>
      </div>
    </EntityLookupFlowContext.Provider>
  );
}

export function EntityLookupFlow({
  response,
  caseId,
  onConfirmFault,
}: EntityLookupFlowProps) {
  const [visibleFields, setVisibleFields] = useState<Set<EntityFlowFieldKey>>(
    () => new Set(DEFAULT_VISIBLE_FIELDS)
  );

  const handleToggleField = useCallback((field: EntityFlowFieldKey, checked: boolean) => {
    setVisibleFields((current) => {
      const next = new Set(current);
      if (checked) {
        next.add(field);
      } else {
        next.delete(field);
      }
      return next;
    });
  }, []);

  return (
    <div className="flex h-[min(65vh,720px)] min-h-[420px] w-full flex-col overflow-hidden rounded-xl border bg-muted/20">
      <div className="border-b bg-background/80 px-4 py-3">
        <p className="text-sm font-medium">Entity Hierarchy Map</p>
        <p className="text-xs text-muted-foreground">
          Top-down hierarchy: customer → order → project → system → subsystem → module → unit → component.
          Drag nodes to rearrange; use the field slicer to control visible details.
        </p>
      </div>

      <div className="min-h-0 flex-1">
        <ReactFlowProvider>
          <EntityLookupFlowCanvas
            response={response}
            caseId={caseId}
            onConfirmFault={onConfirmFault}
            visibleFields={visibleFields}
            onToggleField={handleToggleField}
          />
        </ReactFlowProvider>
      </div>
    </div>
  );
}

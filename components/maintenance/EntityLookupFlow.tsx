'use client';

import {
  createContext,
  memo,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type MouseEvent as ReactMouseEvent,
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
  type Node,
  type NodeProps,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Maximize2, Minimize2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import { useAuth } from '@/lib/auth-context';
import { P } from '@/lib/permission-codes';

interface EntityLookupFlowContextValue {
  caseId?: number | null;
  onConfirmFault?: (node: EntityLookupNode) => Promise<void>;
  onViewEntity?: (node: EntityLookupNode) => void;
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
  const { caseId, onConfirmFault, onViewEntity, visibleFields } =
    useContext(EntityLookupFlowContext);
  const { can } = useAuth();
  const canConfirmFault = can(P.confirm_faults);
  const canOpenDetail =
    Boolean(onViewEntity) &&
    (nodeData.role === 'matched' ||
      nodeData.role === 'hardware' ||
      nodeData.role === 'descendant');

  return (
    <div
      className={cn(
        'rounded-xl border px-4 py-3 text-left transition-shadow hover:shadow-md',
        canOpenDetail
          ? 'cursor-pointer active:cursor-grabbing'
          : 'cursor-grab active:cursor-grabbing',
        roleStyles[nodeData.role]
      )}
      style={{ width: ENTITY_NODE_WIDTH }}
      title={canOpenDetail ? 'Click to view stocking details' : undefined}
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

      {canOpenDetail ? (
        <Button
          variant="secondary"
          size="sm"
          className="mt-3 h-8 w-full text-xs"
          onClick={(event) => {
            event.stopPropagation();
            onViewEntity?.(toEntityLookupNode(nodeData));
          }}
        >
          View details
        </Button>
      ) : null}

      {caseId && onConfirmFault && canConfirmFault && nodeData.role === 'descendant' ? (
        <Button
          variant="outline"
          size="sm"
          className="mt-2 h-8 w-full text-xs"
          onClick={(event) => {
            event.stopPropagation();
            void onConfirmFault(toEntityLookupNode(nodeData));
          }}
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
  onViewEntity?: (node: EntityLookupNode) => void;
}

function EntityLookupFlowCanvas({
  response,
  caseId,
  onConfirmFault,
  onViewEntity,
  visibleFields,
  onToggleField,
  fieldSlicerIdPrefix,
}: EntityLookupFlowProps & {
  visibleFields: Set<EntityFlowFieldKey>;
  onToggleField: (field: EntityFlowFieldKey, checked: boolean) => void;
  fieldSlicerIdPrefix: string;
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
    () => ({ caseId, onConfirmFault, onViewEntity, visibleFields }),
    [caseId, onConfirmFault, onViewEntity, visibleFields]
  );

  const handleNodeClick = useCallback(
    (event: ReactMouseEvent, node: Node) => {
      if (!onViewEntity) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest('button')) return;

      const nodeData = node.data as EntityFlowNodeData;
      if (
        nodeData.role !== 'matched' &&
        nodeData.role !== 'hardware' &&
        nodeData.role !== 'descendant'
      ) {
        return;
      }
      onViewEntity(toEntityLookupNode(nodeData));
    },
    [onViewEntity]
  );

  const dependencyKey = `${response.matched_entity_id}-${response.matched_entity_type}-${nodes.length}-${fieldSlicerIdPrefix}`;

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
          onNodeClick={handleNodeClick}
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
            idPrefix={fieldSlicerIdPrefix}
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
  onViewEntity,
}: EntityLookupFlowProps) {
  const [visibleFields, setVisibleFields] = useState<Set<EntityFlowFieldKey>>(
    () => new Set(DEFAULT_VISIBLE_FIELDS)
  );
  const [fullscreenOpen, setFullscreenOpen] = useState(false);

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
    <>
      <div className="flex h-[min(65vh,720px)] min-h-105 w-full flex-col overflow-hidden rounded-xl border bg-muted/20">
        <div className="flex items-start justify-between gap-3 border-b bg-background/80 px-4 py-3">
          <div className="min-w-0">
            <p className="text-sm font-medium">Entity Hierarchy Map</p>
            <p className="text-xs text-muted-foreground">
              Top-down hierarchy: customer → order → project → system → subsystem → module → unit →
              component. Click a hardware entity to open stocking details; drag to rearrange; use
              Display Fields to control visible labels.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="shrink-0 gap-2"
            onClick={() => setFullscreenOpen(true)}
          >
            <Maximize2 className="h-4 w-4" />
            Full screen
          </Button>
        </div>

        <div className="min-h-0 flex-1">
          <ReactFlowProvider>
            <EntityLookupFlowCanvas
              response={response}
              caseId={caseId}
              onConfirmFault={onConfirmFault}
              onViewEntity={onViewEntity}
              visibleFields={visibleFields}
              onToggleField={handleToggleField}
              fieldSlicerIdPrefix="lookup-inline"
            />
          </ReactFlowProvider>
        </div>
      </div>

      <Dialog open={fullscreenOpen} onOpenChange={setFullscreenOpen}>
        <DialogContent
          className="flex h-[min(96vh,960px)] w-[calc(100vw-1rem)] max-w-[calc(100vw-1rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-[calc(100vw-1rem)]"
          showCloseButton={false}
          onPointerDownOutside={(event) => event.preventDefault()}
          onInteractOutside={(event) => event.preventDefault()}
        >
          <DialogHeader className="flex flex-row items-start justify-between gap-3 space-y-0 border-b px-4 py-3 sm:px-6">
            <div className="min-w-0 space-y-1">
              <DialogTitle>Entity Hierarchy Map</DialogTitle>
              <DialogDescription>
                Full-screen view of the looked-up hierarchy. Pan, zoom, and rearrange nodes as
                needed.
              </DialogDescription>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="shrink-0 gap-2"
              onClick={() => setFullscreenOpen(false)}
            >
              <Minimize2 className="h-4 w-4" />
              Exit full screen
            </Button>
          </DialogHeader>

          <div className="min-h-0 flex-1 bg-muted/20">
            <ReactFlowProvider>
              <EntityLookupFlowCanvas
                response={response}
                caseId={caseId}
                onConfirmFault={onConfirmFault}
                onViewEntity={onViewEntity}
                visibleFields={visibleFields}
                onToggleField={handleToggleField}
                fieldSlicerIdPrefix="lookup-fullscreen"
              />
            </ReactFlowProvider>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

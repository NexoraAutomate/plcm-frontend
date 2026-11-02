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
  type EntityFlowFieldKey,
  type EntityFlowNodeData,
  toEntityLookupNode,
} from '@/lib/entity-lookup-flow';
import type { EntityLookupNode, lookUpResponse } from '@/lib/models';
import { EntityFlowFieldSlicer } from './EntityFlowFieldSlicer';
import {
  EntityLookupWorkflowSheet,
  type WorkflowFocus,
} from './entity-lookup-workflow-sheet';
import { useAuth } from '@/lib/auth-context';
import { P } from '@/lib/permission-codes';

interface EntityLookupFlowContextValue {
  caseId?: number | null;
  onConfirmFault?: (node: EntityLookupNode) => Promise<void>;
  onViewEntity?: (node: EntityLookupNode) => void;
  onSerialClick?: (node: EntityFlowNodeData) => void;
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
  const { caseId, onConfirmFault, onViewEntity, onSerialClick, visibleFields } =
    useContext(EntityLookupFlowContext);
  const { can } = useAuth();
  const canConfirmFault = can(P.confirm_faults);
  const canOpenDetail =
    Boolean(onViewEntity) &&
    (nodeData.role === 'matched' ||
      nodeData.role === 'hardware' ||
      nodeData.role === 'descendant');
  const serial = nodeData.entity_SerialNumber?.trim();
  const canOpenWorkflow = Boolean(onSerialClick) && Boolean(serial);

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

      {visibleFields.has('entity_type') ? (
        <div className="mb-2 flex flex-wrap items-start gap-2">
          <Badge variant="secondary" className="text-[10px] uppercase">
            {nodeData.entity_type}
          </Badge>
        </div>
      ) : null}

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
          canOpenWorkflow ? (
            <button
              type="button"
              className="block max-w-full truncate text-left font-medium text-primary hover:underline"
              title="Open workflow for this serial"
              onClick={(event) => {
                event.stopPropagation();
                onSerialClick?.(nodeData);
              }}
            >
              SN: {serial}
            </button>
          ) : (
            <p className="truncate">SN: {serial || 'N/A'}</p>
          )
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
  onSerialClick,
  visibleFields,
  onToggleField,
  fieldSlicerIdPrefix,
}: EntityLookupFlowProps & {
  onSerialClick?: (node: EntityFlowNodeData) => void;
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
    () => ({ caseId, onConfirmFault, onViewEntity, onSerialClick, visibleFields }),
    [caseId, onConfirmFault, onViewEntity, onSerialClick, visibleFields]
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
          <EntityFlowFieldSlicer
            visibleFields={visibleFields}
            onToggleField={onToggleField}
            idPrefix={fieldSlicerIdPrefix}
          />
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
  const [workflowOpen, setWorkflowOpen] = useState(false);
  const [workflowFocus, setWorkflowFocus] = useState<WorkflowFocus | null>(null);

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

  const handleSerialClick = useCallback((node: EntityFlowNodeData) => {
    setWorkflowFocus({
      entityType: node.entity_type,
      entityId: node.entity_id,
    });
    setWorkflowOpen(true);
  }, []);

  const handleWorkflowViewEntity = useCallback(
    (node: {
      entity_type: string;
      entity_id: number;
      entity_name: string;
      entity_PartNumber?: string;
      entity_SerialNumber?: string;
      label?: string;
    }) => {
      onViewEntity?.({
        entity_type: node.entity_type,
        entity_id: node.entity_id,
        label: node.label || node.entity_name,
        children: [],
        entity_name: node.entity_name,
        entity_PartNumber: node.entity_PartNumber || '',
        entity_SerialNumber: node.entity_SerialNumber || '',
      });
    },
    [onViewEntity]
  );

  return (
    <>
      <div className="flex h-[min(62vh,680px)] min-h-100 w-full flex-col overflow-hidden rounded-xl border border-border/80 bg-muted/15 shadow-sm">
        <div className="flex items-center justify-between gap-3 border-b border-border/70 bg-background/90 px-3 py-2">
          <p className="text-sm font-medium tracking-tight">Entity Hierarchy Map</p>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 shrink-0 gap-1.5 px-2 text-xs"
            onClick={() => setFullscreenOpen(true)}
          >
            <Maximize2 className="h-3.5 w-3.5" />
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
              onSerialClick={handleSerialClick}
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
          <DialogHeader className="flex flex-row items-center justify-between gap-3 space-y-0 border-b px-4 py-2.5 sm:px-5">
            <div className="min-w-0">
              <DialogTitle>Entity Hierarchy Map</DialogTitle>
              <DialogDescription className="sr-only">
                Full-screen hierarchy map
              </DialogDescription>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 shrink-0 gap-1.5 px-2 text-xs"
              onClick={() => setFullscreenOpen(false)}
            >
              <Minimize2 className="h-3.5 w-3.5" />
              Exit
            </Button>
          </DialogHeader>

          <div className="min-h-0 flex-1 bg-muted/20">
            <ReactFlowProvider>
              <EntityLookupFlowCanvas
                response={response}
                caseId={caseId}
                onConfirmFault={onConfirmFault}
                onViewEntity={onViewEntity}
                onSerialClick={handleSerialClick}
                visibleFields={visibleFields}
                onToggleField={handleToggleField}
                fieldSlicerIdPrefix="lookup-fullscreen"
              />
            </ReactFlowProvider>
          </div>
        </DialogContent>
      </Dialog>

      <EntityLookupWorkflowSheet
        open={workflowOpen}
        onOpenChange={setWorkflowOpen}
        response={response}
        focus={workflowFocus}
        onViewEntity={handleWorkflowViewEntity}
      />
    </>
  );
}

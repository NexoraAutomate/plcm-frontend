'use client';

/**
 * Hierarchy configuration tree builder (React Flow / xyflow).
 * Features aligned with React Flow examples: lock, resize, move, arrows,
 * add-on-edge-drop, easy-connect, intersections, proximity connect,
 * animated edges, entity DnD, edge delete, H/V layout, eraser/selection,
 * download image.
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  createContext,
  useContext,
  type MouseEvent as ReactMouseEvent,
  type MutableRefObject,
} from 'react';
import { createPortal } from 'react-dom';
import {
  Background,
  Controls,
  MarkerType,
  MiniMap,
  Panel,
  ReactFlow,
  ReactFlowProvider,
  addEdge,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Connection,
  type Edge,
  type Node,
  type OnConnectEnd,
  type OnNodeDrag,
  type NodeProps,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import {
  Columns2,
  Lock,
  LockOpen,
  Maximize2,
  Minimize2,
  Plus,
  Rows2,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { useAppDefinitions } from '@/lib/app-definitions-context';
import { suggestAbbreviation } from '@/lib/app-definitions';
import { useHierarchiesQuery } from '@/hooks/queries';
import { filterTemplateNames, hierarchiesToNameItems } from '@/lib/hierarchy-template-names';
import {
  CHILD_TEMPLATE_LEVEL,
  TEMPLATE_NODE_LEVELS,
  newClientKey,
  type TemplateDraftNode,
  type TemplateNodeLevel,
} from '@/lib/hierarchy-config';
import {
  buildGraphFromDraft,
  canLinkLevels,
  descendantsOf,
  isDraftNode,
  siblingsOf,
  type ConfigTreeEdgeData,
  type ConfigTreeNodeData,
  type LayoutDirection,
} from '@/lib/config-tree-layout';
import {
  ConfigTreeFlowNode,
  type ConfigTreeNodeActions,
} from '@/components/settings/config-tree/config-tree-flow-node';
import { ConfigAnimatedEdge } from '@/components/settings/config-tree/config-animated-edge';
import { ConfigTreeEraser } from '@/components/settings/config-tree/config-tree-eraser';
import {
  ConfigTreeEntitySidebar,
  ENTITY_DND_MIME,
  type EntityDragPayload,
} from '@/components/settings/config-tree/config-tree-entity-sidebar';
import { ConfigTreeDownloadButton } from '@/components/settings/config-tree/config-tree-download-button';
import { cn } from '@/lib/utils';

const MIN_PROXIMITY = 180;

type InteractionMode = 'selection' | 'eraser';

type NodeFormState = {
  mode: 'create' | 'edit';
  clientKey: string;
  level: TemplateNodeLevel;
  name: string;
  abbreviation: string;
};

const ActionsContext = createContext<ConfigTreeNodeActions | null>(null);

function NodeWithActions(props: NodeProps<Node<ConfigTreeNodeData>>) {
  const actions = useContext(ActionsContext);
  if (!actions) return null;
  return <ConfigTreeFlowNode {...props} actions={actions} />;
}

function EdgeWithDelete(
  props: React.ComponentProps<typeof ConfigAnimatedEdge> & {
    locked: boolean;
    onDeleteEdge: (id: string) => void;
  }
) {
  const { locked, onDeleteEdge, ...rest } = props;
  return (
    <ConfigAnimatedEdge {...rest} locked={locked} onDeleteEdge={onDeleteEdge} />
  );
}

type CanvasProps = {
  draftNodes: TemplateDraftNode[];
  onChange: (nodes: TemplateDraftNode[]) => void;
  readOnly: boolean;
  locked: boolean;
  setLocked: (v: boolean) => void;
  mode: InteractionMode;
  setMode: (m: InteractionMode) => void;
  direction: LayoutDirection;
  setDirection: (d: LayoutDirection) => void;
  levelLabel: (level: string) => string;
  entityListItems: ReturnType<typeof hierarchiesToNameItems>;
  openNodeForm: (clientKey: string) => void;
  placeNode: (input: {
    level: TemplateNodeLevel;
    parentKey: string | null;
    insertBeforeKey?: string | null;
    insertAfterKey?: string | null;
    name?: string;
    abbreviation?: string;
    position?: { x: number; y: number };
  }) => string;
  addChild: (parentKey: string | null) => void;
  addSibling: (clientKey: string, where: 'above' | 'below') => void;
  addParentPeer: (clientKey: string) => void;
  requestDeleteNode: (clientKey: string) => void;
  layoutNonce: number;
  pendingPositions: MutableRefObject<Map<string, { x: number; y: number }>>;
};

function ConfigTreeCanvasInner({
  draftNodes,
  onChange,
  readOnly,
  locked,
  setLocked,
  mode,
  setMode,
  direction,
  setDirection,
  levelLabel,
  entityListItems,
  openNodeForm,
  placeNode,
  addChild,
  addSibling,
  addParentPeer,
  requestDeleteNode,
  layoutNonce,
  pendingPositions,
}: CanvasProps) {
  const { screenToFlowPosition, getInternalNode, fitView, getNodes } =
    useReactFlow();
  const connectingNodeId = useRef<string | null>(null);
  const skipNextSync = useRef(false);
  const lastLayoutNonce = useRef(layoutNonce);
  const structureKey = useMemo(
    () =>
      draftNodes
        .map(
          (n) =>
            `${n.client_key}:${n.parent_client_key ?? ''}:${n.name}:${n.level}:${n.sort_order}`
        )
        .join('|'),
    [draftNodes]
  );

  const initial = useMemo(
    () =>
      buildGraphFromDraft({
        nodes: draftNodes,
        levelLabel,
        locked,
        readOnly,
        direction,
        applyAutoLayout: true,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- bootstrap once; sync effect handles updates
    []
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(initial.flowNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initial.edges);

  const nodesByKey = useMemo(() => {
    const map = new Map<string, TemplateDraftNode>();
    for (const n of draftNodes) map.set(n.client_key, n);
    return map;
  }, [draftNodes]);

  const usedNamesByLevel = useMemo(() => {
    const map = new Map<TemplateNodeLevel, Set<string>>();
    for (const level of TEMPLATE_NODE_LEVELS) map.set(level, new Set());
    for (const n of draftNodes) {
      if (!n.name.trim()) continue;
      map.get(n.level)?.add(n.name.trim().toLowerCase());
    }
    return map;
  }, [draftNodes]);

  // Rebuild graph when draft structure / lock / layout direction changes
  useEffect(() => {
    if (skipNextSync.current) {
      skipNextSync.current = false;
      return;
    }
    const positionById = new Map(
      getNodes().map((n) => [n.id, { x: n.position.x, y: n.position.y }])
    );
    for (const [id, pos] of pendingPositions.current) {
      positionById.set(id, pos);
    }
    const hadPending = pendingPositions.current.size > 0;
    pendingPositions.current.clear();

    const sizeById = new Map(
      getNodes().map((n) => [
        n.id,
        {
          width: typeof n.style?.width === 'number' ? n.style.width : 280,
          height: typeof n.style?.height === 'number' ? n.style.height : 110,
        },
      ])
    );
    const layoutChanged = lastLayoutNonce.current !== layoutNonce;
    lastLayoutNonce.current = layoutNonce;
    const applyAutoLayout =
      (layoutChanged || positionById.size === 0) && !hadPending;
    const next = buildGraphFromDraft({
      nodes: draftNodes,
      levelLabel,
      locked,
      readOnly,
      direction,
      sizeById,
      positionById: applyAutoLayout ? undefined : positionById,
      applyAutoLayout,
    });
    setNodes(next.flowNodes);
    setEdges(next.edges);
    const t = window.setTimeout(() => void fitView({ padding: 0.2, duration: 200 }), 40);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [structureKey, locked, readOnly, direction, layoutNonce]);

  const deleteEdgeById = useCallback(
    (edgeId: string) => {
      if (locked || readOnly) return;
      const edge = edges.find((e) => e.id === edgeId);
      if (!edge) return;
      skipNextSync.current = true;
      onChange(
        draftNodes.map((n) =>
          n.client_key === edge.target ? { ...n, parent_client_key: null } : n
        )
      );
      setEdges((eds) => eds.filter((e) => e.id !== edgeId));
      toast.success('Edge removed');
    },
    [draftNodes, edges, locked, onChange, readOnly, setEdges]
  );

  const nodeTypes = useMemo(
    () => ({
      configTree: NodeWithActions,
    }),
    []
  );

  const edgeTypes = useMemo(
    () => ({
      configAnimated: (props: React.ComponentProps<typeof ConfigAnimatedEdge>) => (
        <EdgeWithDelete
          {...props}
          locked={locked || readOnly}
          onDeleteEdge={deleteEdgeById}
        />
      ),
    }),
    [deleteEdgeById, locked, readOnly]
  );

  const actions = useMemo<ConfigTreeNodeActions>(
    () => ({
      onEdit: openNodeForm,
      onDelete: requestDeleteNode,
      onAddChild: (key) => addChild(key),
      onAddSiblingAbove: (key) => addSibling(key, 'above'),
      onAddSiblingBelow: (key) => addSibling(key, 'below'),
      onAddParentPeer: addParentPeer,
    }),
    [addChild, addParentPeer, addSibling, openNodeForm, requestDeleteNode]
  );

  const tryConnect = useCallback(
    (sourceId: string, targetId: string): boolean => {
      if (sourceId === targetId) return false;
      const source = nodesByKey.get(sourceId);
      const target = nodesByKey.get(targetId);
      if (!source || !target) return false;
      if (!canLinkLevels(source.level, target.level)) {
        toast.error(
          `Cannot connect ${levelLabel(source.level)} → ${levelLabel(target.level)}`
        );
        return false;
      }
      // Prevent cycles
      const desc = descendantsOf(draftNodes, targetId);
      if (desc.has(sourceId)) {
        toast.error('That connection would create a cycle');
        return false;
      }
      skipNextSync.current = true;
      onChange(
        draftNodes.map((n) =>
          n.client_key === targetId
            ? { ...n, parent_client_key: sourceId }
            : n
        )
      );
      setEdges((eds) => {
        const without = eds.filter((e) => e.target !== targetId);
        return addEdge(
          {
            id: `e-${sourceId}-${targetId}`,
            source: sourceId,
            target: targetId,
            type: 'configAnimated',
            animated: true,
            markerEnd: { type: MarkerType.ArrowClosed },
          },
          without
        );
      });
      return true;
    },
    [draftNodes, levelLabel, nodesByKey, onChange, setEdges]
  );

  const onConnect = useCallback(
    (connection: Connection) => {
      if (locked || readOnly || mode === 'eraser') return;
      if (!connection.source || !connection.target) return;
      tryConnect(connection.source, connection.target);
    },
    [locked, mode, readOnly, tryConnect]
  );

  const onConnectStart = useCallback<
    NonNullable<React.ComponentProps<typeof ReactFlow>['onConnectStart']>
  >((_, { nodeId }) => {
    connectingNodeId.current = nodeId;
  }, []);

  const onConnectEnd = useCallback<OnConnectEnd>(
    (event, connectionState) => {
      if (locked || readOnly || mode === 'eraser') return;
      const fromId = connectingNodeId.current;
      connectingNodeId.current = null;
      if (connectionState.isValid || !fromId) return;
      const parent = nodesByKey.get(fromId);
      if (!parent) return;
      const childLevel = CHILD_TEMPLATE_LEVEL[parent.level];
      if (!childLevel) {
        toast.error('No child level under this node');
        return;
      }
      const { clientX, clientY } =
        'changedTouches' in event
          ? (event as TouchEvent).changedTouches[0]
          : (event as MouseEvent);
      const position = screenToFlowPosition({ x: clientX, y: clientY });
      placeNode({
        level: childLevel,
        parentKey: fromId,
        position,
      });
    },
    [locked, mode, nodesByKey, placeNode, readOnly, screenToFlowPosition]
  );

  const getClosestEdge = useCallback(
    (node: Node) => {
      const internal = getInternalNode(node.id);
      if (!internal) return null;
      const others = getNodes().filter((n) => n.id !== node.id);
      let best: { distance: number; node: Node | null } = {
        distance: Number.MAX_VALUE,
        node: null,
      };
      for (const n of others) {
        const ni = getInternalNode(n.id);
        if (!ni) continue;
        const dx =
          ni.internals.positionAbsolute.x - internal.internals.positionAbsolute.x;
        const dy =
          ni.internals.positionAbsolute.y - internal.internals.positionAbsolute.y;
        const d = Math.hypot(dx, dy);
        if (d < best.distance && d < MIN_PROXIMITY) {
          best = { distance: d, node: n };
        }
      }
      if (!best.node) return null;
      const a = nodesByKey.get(node.id);
      const b = nodesByKey.get(best.node.id);
      if (!a || !b) return null;
      // Prefer parent → child orientation by level
      if (canLinkLevels(a.level, b.level)) {
        return { source: a.client_key, target: b.client_key };
      }
      if (canLinkLevels(b.level, a.level)) {
        return { source: b.client_key, target: a.client_key };
      }
      return null;
    },
    [getInternalNode, getNodes, nodesByKey]
  );

  const onNodeDrag: OnNodeDrag = useCallback(
    (_: ReactMouseEvent, node: Node) => {
      if (locked || readOnly) return;
      const intersections = getNodes()
        .filter((n) => n.id !== node.id)
        .filter((n) => {
          const a = node;
          const aw = typeof a.style?.width === 'number' ? a.style.width : 280;
          const ah = typeof a.style?.height === 'number' ? a.style.height : 110;
          const bw = typeof n.style?.width === 'number' ? n.style.width : 280;
          const bh = typeof n.style?.height === 'number' ? n.style.height : 110;
          return !(
            a.position.x + aw < n.position.x ||
            n.position.x + bw < a.position.x ||
            a.position.y + ah < n.position.y ||
            n.position.y + bh < a.position.y
          );
        })
        .map((n) => n.id);

      setNodes((nds) =>
        nds.map((n) => ({
          ...n,
          data: {
            ...n.data,
            intersecting: intersections.includes(n.id),
          },
        }))
      );

      // Proximity temp edge
      const close = getClosestEdge(node);
      setEdges((es) => {
        const next = es.filter((e) => e.className !== 'temp');
        if (
          close &&
          !next.find((ne) => ne.source === close.source && ne.target === close.target)
        ) {
          next.push({
            id: `temp-${close.source}-${close.target}`,
            source: close.source,
            target: close.target,
            className: 'temp',
            style: { strokeDasharray: '6 4' },
            animated: true,
            type: 'configAnimated',
          });
        }
        return next;
      });
    },
    [getClosestEdge, getNodes, locked, readOnly, setEdges, setNodes]
  );

  const onNodeDragStop: OnNodeDrag = useCallback(
    (_: ReactMouseEvent, node: Node) => {
      if (locked || readOnly) return;
      setNodes((nds) =>
        nds.map((n) => ({
          ...n,
          data: { ...n.data, intersecting: false },
        }))
      );
      const close = getClosestEdge(node);
      setEdges((es) => es.filter((e) => e.className !== 'temp'));
      if (close) tryConnect(close.source, close.target);
    },
    [getClosestEdge, locked, readOnly, setEdges, setNodes, tryConnect]
  );

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      if (locked || readOnly) return;
      const raw = event.dataTransfer.getData(ENTITY_DND_MIME);
      if (!raw) return;
      let payload: EntityDragPayload;
      try {
        payload = JSON.parse(raw) as EntityDragPayload;
      } catch {
        return;
      }
      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });
      // Parent: nearest valid parent by proximity, else null for system
      let parentKey: string | null = null;
      if (payload.level !== 'system') {
        let best: { d: number; id: string } | null = null;
        for (const n of getNodes()) {
          const draft = nodesByKey.get(n.id);
          if (!draft || !canLinkLevels(draft.level, payload.level)) continue;
          const d = Math.hypot(
            n.position.x - position.x,
            n.position.y - position.y
          );
          if (!best || d < best.d) best = { d, id: n.id };
        }
        if (!best || best.d > MIN_PROXIMITY * 1.5) {
          toast.error(`Drop near a valid parent for ${levelLabel(payload.level)}`);
          return;
        }
        parentKey = best.id;
      }
      placeNode({
        level: payload.level,
        parentKey,
        name: payload.name,
        abbreviation: payload.abbreviation || suggestAbbreviation(payload.name),
        position,
      });
    },
    [
      getNodes,
      levelLabel,
      locked,
      nodesByKey,
      placeNode,
      readOnly,
      screenToFlowPosition,
    ]
  );

  const onEraseNodes = useCallback(
    (ids: string[]) => {
      if (locked || readOnly || !ids.length) return;
      let remove = new Set<string>();
      for (const id of ids) {
        for (const k of descendantsOf(draftNodes, id)) remove.add(k);
      }
      onChange(draftNodes.filter((n) => !remove.has(n.client_key)));
      toast.success(`Erased ${remove.size} node(s)`);
    },
    [draftNodes, locked, onChange, readOnly]
  );

  const onEraseEdges = useCallback(
    (ids: string[]) => {
      if (locked || readOnly || !ids.length) return;
      const targets = new Set(
        edges.filter((e) => ids.includes(e.id)).map((e) => e.target)
      );
      if (!targets.size) return;
      onChange(
        draftNodes.map((n) =>
          targets.has(n.client_key) ? { ...n, parent_client_key: null } : n
        )
      );
      toast.success(`Erased ${targets.size} edge(s)`);
    },
    [draftNodes, edges, locked, onChange, readOnly]
  );

  const interactive = !locked && !readOnly && mode === 'selection';

  return (
    <div className="flex h-full min-h-0 w-full">
      <ConfigTreeEntitySidebar
        entities={entityListItems}
        usedNamesByLevel={usedNamesByLevel}
        levelLabel={levelLabel}
        disabled={!interactive}
      />
      <div className="relative min-h-0 min-w-0 flex-1">
        <ActionsContext.Provider value={actions}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            onNodesChange={interactive ? onNodesChange : undefined}
            onEdgesChange={interactive ? onEdgesChange : undefined}
            onConnect={onConnect}
            onConnectStart={onConnectStart}
            onConnectEnd={onConnectEnd}
            onNodeDrag={onNodeDrag}
            onNodeDragStop={onNodeDragStop}
            onDragOver={onDragOver}
            onDrop={onDrop}
            nodesDraggable={interactive}
            nodesConnectable={interactive}
            elementsSelectable={mode === 'selection'}
            edgesFocusable={interactive}
            deleteKeyCode={interactive ? ['Backspace', 'Delete'] : null}
            onBeforeDelete={async ({ nodes: ns, edges: es }) => {
              if (ns.length > 0) {
                requestDeleteNode(ns[0].id);
                return false;
              }
              if (es.length > 0) {
                for (const e of es) deleteEdgeById(e.id);
                return false;
              }
              return true;
            }}
            fitView
            minZoom={0.2}
            maxZoom={1.75}
            proOptions={{ hideAttribution: true }}
            defaultEdgeOptions={{
              type: 'configAnimated',
              animated: true,
              markerEnd: { type: MarkerType.ArrowClosed },
            }}
            connectionLineStyle={{ stroke: '#64748b', strokeWidth: 2 }}
            className={cn(mode === 'eraser' && 'cursor-crosshair')}
          >
            <Background gap={16} size={1} />
            <Controls showInteractive={false} />
            <MiniMap pannable zoomable className="bg-background/80!" />
            <ConfigTreeDownloadButton />

            <Panel position="top-left" className="z-50 flex flex-wrap gap-1.5">
              <Button
                type="button"
                size="sm"
                variant={locked ? 'default' : 'secondary'}
                className="h-8"
                disabled={readOnly}
                onClick={() => setLocked(!locked)}
                title={locked ? 'Unlock layout' : 'Lock layout'}
              >
                {locked ? (
                  <Lock className="mr-1 h-3.5 w-3.5" />
                ) : (
                  <LockOpen className="mr-1 h-3.5 w-3.5" />
                )}
                {locked ? 'Locked' : 'Lock'}
              </Button>
              <Button
                type="button"
                size="sm"
                variant={mode === 'selection' ? 'default' : 'secondary'}
                className="h-8"
                disabled={locked || readOnly}
                onClick={() => setMode('selection')}
              >
                Selection
              </Button>
              <Button
                type="button"
                size="sm"
                variant={mode === 'eraser' ? 'default' : 'secondary'}
                className="h-8"
                disabled={locked || readOnly}
                onClick={() => setMode('eraser')}
              >
                Eraser
              </Button>
              <Button
                type="button"
                size="sm"
                variant={direction === 'TB' ? 'default' : 'secondary'}
                className="h-8"
                disabled={locked}
                onClick={() => setDirection('TB')}
                title="Vertical layout"
              >
                <Rows2 className="mr-1 h-3.5 w-3.5" />
                Vertical
              </Button>
              <Button
                type="button"
                size="sm"
                variant={direction === 'LR' ? 'default' : 'secondary'}
                className="h-8"
                disabled={locked}
                onClick={() => setDirection('LR')}
                title="Horizontal layout"
              >
                <Columns2 className="mr-1 h-3.5 w-3.5" />
                Horizontal
              </Button>
              {!readOnly && !locked ? (
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  className="h-8"
                  onClick={() => addChild(null)}
                >
                  <Plus className="mr-1 h-3.5 w-3.5" />
                  {levelLabel('system')}
                </Button>
              ) : null}
            </Panel>

            {mode === 'eraser' && !locked && !readOnly ? (
              <ConfigTreeEraser
                onEraseNodes={onEraseNodes}
                onEraseEdges={onEraseEdges}
              />
            ) : null}
          </ReactFlow>
        </ActionsContext.Provider>
      </div>
    </div>
  );
}

function ConfigTreeCanvas(props: CanvasProps) {
  return (
    <ReactFlowProvider>
      <ConfigTreeCanvasInner {...props} />
    </ReactFlowProvider>
  );
}

export type HierarchyConfigTreeEditorProps = {
  nodes: TemplateDraftNode[];
  onChange: (nodes: TemplateDraftNode[]) => void;
  readOnly?: boolean;
  openFullscreenSignal?: number;
};

export function HierarchyConfigTreeEditor({
  nodes,
  onChange,
  readOnly = false,
  openFullscreenSignal = 0,
}: HierarchyConfigTreeEditorProps) {
  const { entityLabel } = useAppDefinitions();
  const levelLabel = useCallback((level: string) => entityLabel(level), [entityLabel]);
  const { data: hierarchyRows = [] } = useHierarchiesQuery(undefined, !readOnly);
  const entityListItems = useMemo(
    () => hierarchiesToNameItems(hierarchyRows),
    [hierarchyRows]
  );

  const [overlayOpen, setOverlayOpen] = useState(false);
  const [locked, setLocked] = useState(false);
  const [mode, setMode] = useState<InteractionMode>('selection');
  const [direction, setDirection] = useState<LayoutDirection>('LR');
  const [layoutNonce, setLayoutNonce] = useState(1);
  const [form, setForm] = useState<NodeFormState | null>(null);
  const [deleteKey, setDeleteKey] = useState<string | null>(null);
  const pendingPositions = useRef(new Map<string, { x: number; y: number }>());

  const nodesByKey = useMemo(() => {
    const map = new Map<string, TemplateDraftNode>();
    for (const n of nodes) map.set(n.client_key, n);
    return map;
  }, [nodes]);

  const nodeCountByLevel = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const level of TEMPLATE_NODE_LEVELS) counts[level] = 0;
    for (const node of nodes) {
      counts[node.level] = (counts[node.level] ?? 0) + 1;
    }
    return counts;
  }, [nodes]);

  const openFullscreen = useCallback(() => setOverlayOpen(true), []);
  const closeFullscreen = useCallback(() => setOverlayOpen(false), []);

  useEffect(() => {
    if (openFullscreenSignal > 0) openFullscreen();
  }, [openFullscreen, openFullscreenSignal]);

  useEffect(() => {
    if (!overlayOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (form || deleteKey) return;
      event.preventDefault();
      closeFullscreen();
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [closeFullscreen, deleteKey, form, overlayOpen]);

  useEffect(() => {
    if (!overlayOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [overlayOpen]);

  const openNodeForm = useCallback(
    (clientKey: string, formMode: 'create' | 'edit' = 'edit') => {
      const node = nodesByKey.get(clientKey);
      if (!node) return;
      setForm({
        mode: isDraftNode(node) ? 'create' : formMode,
        clientKey: node.client_key,
        level: node.level,
        name: isDraftNode(node) ? '' : node.name,
        abbreviation: node.abbreviation ?? '',
      });
    },
    [nodesByKey]
  );

  const placeNode = useCallback(
    (input: {
      level: TemplateNodeLevel;
      parentKey: string | null;
      insertBeforeKey?: string | null;
      insertAfterKey?: string | null;
      name?: string;
      abbreviation?: string;
      position?: { x: number; y: number };
    }) => {
      const key = newClientKey(input.level.slice(0, 3));
      const siblings = siblingsOf(nodes, input.parentKey);
      let insertAt = siblings.length;
      if (input.insertBeforeKey) {
        const idx = siblings.findIndex((s) => s.client_key === input.insertBeforeKey);
        if (idx >= 0) insertAt = idx;
      } else if (input.insertAfterKey) {
        const idx = siblings.findIndex((s) => s.client_key === input.insertAfterKey);
        if (idx >= 0) insertAt = idx + 1;
      }
      const name = input.name?.trim() || `New ${levelLabel(input.level)}`;
      const draft: TemplateDraftNode = {
        client_key: key,
        parent_client_key: input.parentKey,
        level: input.level,
        name,
        abbreviation: input.abbreviation ?? '',
        sort_order: insertAt,
      };
      const nextSiblings = [...siblings];
      nextSiblings.splice(insertAt, 0, draft);
      const base = nodes.filter((n) => (n.parent_client_key ?? null) !== input.parentKey);
      const reindexed = nextSiblings.map((s, index) => ({ ...s, sort_order: index }));
      onChange([...base, ...reindexed]);
      if (input.position) pendingPositions.current.set(key, input.position);
      if (!input.name) {
        setForm({
          mode: 'create',
          clientKey: key,
          level: input.level,
          name: '',
          abbreviation: '',
        });
      }
      return key;
    },
    [levelLabel, nodes, onChange]
  );

  const addChild = useCallback(
    (parentKey: string | null) => {
      if (parentKey == null) {
        placeNode({ level: 'system', parentKey: null });
        return;
      }
      const parent = nodesByKey.get(parentKey);
      if (!parent) return;
      const childLevel = CHILD_TEMPLATE_LEVEL[parent.level];
      if (!childLevel) {
        toast.error('No child level under this node');
        return;
      }
      placeNode({ level: childLevel, parentKey });
    },
    [nodesByKey, placeNode]
  );

  const addSibling = useCallback(
    (clientKey: string, where: 'above' | 'below') => {
      const node = nodesByKey.get(clientKey);
      if (!node) return;
      placeNode({
        level: node.level,
        parentKey: node.parent_client_key ?? null,
        insertBeforeKey: where === 'above' ? clientKey : null,
        insertAfterKey: where === 'below' ? clientKey : null,
      });
    },
    [nodesByKey, placeNode]
  );

  const addParentPeer = useCallback(
    (clientKey: string) => {
      const node = nodesByKey.get(clientKey);
      if (!node) return;
      if (node.level === 'system') {
        placeNode({
          level: 'system',
          parentKey: null,
          insertAfterKey: clientKey,
        });
        return;
      }
      const parentKey = node.parent_client_key ?? null;
      const parent = parentKey ? nodesByKey.get(parentKey) : null;
      if (!parent) {
        toast.error('Parent node not found');
        return;
      }
      placeNode({
        level: parent.level,
        parentKey: parent.parent_client_key ?? null,
        insertAfterKey: parent.client_key,
      });
    },
    [nodesByKey, placeNode]
  );

  const confirmDelete = useCallback(() => {
    if (!deleteKey) return;
    const removeKeys = descendantsOf(nodes, deleteKey);
    onChange(nodes.filter((n) => !removeKeys.has(n.client_key)));
    setForm((f) => (f && removeKeys.has(f.clientKey) ? null : f));
    setDeleteKey(null);
    toast.success('Node and children removed');
  }, [deleteKey, nodes, onChange]);

  const entityOptions = useMemo(() => {
    if (!form) return [];
    const used = new Set(
      nodes
        .filter(
          (n) =>
            n.level === form.level &&
            n.client_key !== form.clientKey &&
            n.name.trim()
        )
        .map((n) => n.name.trim().toLowerCase())
    );
    return filterTemplateNames(entityListItems, form.level).filter(
      (item) => !used.has(item.name.trim().toLowerCase())
    );
  }, [entityListItems, form, nodes]);

  const saveForm = useCallback(() => {
    if (!form) return;
    const name = form.name.trim();
    if (!name) {
      toast.error('Select or enter an entity name');
      return;
    }
    const selected = entityOptions.find((item) => item.name === name);
    const abbreviation = (
      form.abbreviation.trim() ||
      selected?.abbreviation ||
      suggestAbbreviation(name)
    ).toUpperCase();
    onChange(
      nodes.map((n) =>
        n.client_key === form.clientKey ? { ...n, name, abbreviation } : n
      )
    );
    setForm(null);
    toast.success(form.mode === 'create' ? 'Node details saved' : 'Node updated');
  }, [entityOptions, form, nodes, onChange]);

  useEffect(() => {
    if (!form) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
        event.preventDefault();
        saveForm();
      }
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [form, saveForm]);

  const changeDirection = useCallback((d: LayoutDirection) => {
    setDirection(d);
    setLayoutNonce((n) => n + 1);
  }, []);

  const deleteTarget = deleteKey ? nodesByKey.get(deleteKey) : null;

  const canvasProps: CanvasProps = {
    draftNodes: nodes,
    onChange,
    readOnly,
    locked,
    setLocked,
    mode,
    setMode,
    direction,
    setDirection: changeDirection,
    levelLabel,
    entityListItems,
    openNodeForm,
    placeNode,
    addChild,
    addSibling,
    addParentPeer,
    requestDeleteNode: setDeleteKey,
    layoutNonce,
    pendingPositions,
  };

  const overlay =
    overlayOpen && typeof document !== 'undefined'
      ? createPortal(
          <div
            className="fixed inset-0 z-50 flex flex-col bg-background"
            role="dialog"
            aria-modal="true"
            aria-label="Configuration hierarchy tree"
          >
            <div className="flex items-start justify-between gap-3 border-b px-3 py-2">
              <div className="max-w-2xl text-xs text-muted-foreground">
                Lock freezes edits · Resize on hover · Drag to move · Connect handles /
                proximity · Drop connection on pane to add child · Eraser / Selection ·
                Drag entities from sidebar · Esc exits
              </div>
              <div className="flex items-center gap-1.5">
                <Button
                  type="button"
                  size="icon"
                  variant="secondary"
                  className="h-8 w-8"
                  title="Close (Esc)"
                  onClick={closeFullscreen}
                >
                  <Minimize2 className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  size="icon"
                  variant="secondary"
                  className="h-8 w-8"
                  title="Close"
                  onClick={closeFullscreen}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="min-h-0 flex-1">
              <ConfigTreeCanvas {...canvasProps} />
            </div>
          </div>,
          document.body
        )
      : null;

  return (
    <>
      <div className="relative overflow-hidden rounded-lg border bg-muted/20">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-background/80 px-3 py-2">
          <div>
            <p className="text-sm font-medium">Hierarchy tree</p>
            <p className="text-xs text-muted-foreground">
              React Flow builder — open full screen for lock, eraser, DnD, layout, and
              export.
            </p>
          </div>
          <Button type="button" size="sm" variant="secondary" onClick={openFullscreen}>
            <Maximize2 className="mr-1.5 h-4 w-4" />
            Tree builder
          </Button>
        </div>
        <div className="space-y-2 p-3">
          <div className="flex flex-wrap gap-2">
            {TEMPLATE_NODE_LEVELS.map((level) => (
              <span
                key={level}
                className="inline-flex items-center rounded-full border bg-background px-2.5 py-0.5 text-xs"
              >
                {levelLabel(level)}
                <span className="ml-1.5 tabular-nums text-muted-foreground">
                  {nodeCountByLevel[level] ?? 0}
                </span>
              </span>
            ))}
          </div>
          <div className="relative h-80 overflow-hidden rounded-md border bg-muted/10">
            {!overlayOpen ? (
              <ConfigTreeCanvas {...canvasProps} />
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                Editing in full screen…
              </div>
            )}
          </div>
        </div>
      </div>

      {overlay}

      <Dialog open={!!form} onOpenChange={(open) => !open && setForm(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {form?.mode === 'create' ? 'Add hierarchy node' : 'Edit hierarchy node'}
            </DialogTitle>
            <DialogDescription>
              {form
                ? `Select a ${levelLabel(form.level)} from the Entity List. Press Ctrl+S or Save.`
                : null}
            </DialogDescription>
          </DialogHeader>
          {form ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Level</Label>
                <Select value={form.level} disabled>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TEMPLATE_NODE_LEVELS.map((level) => (
                      <SelectItem key={level} value={level}>
                        {levelLabel(level)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Entity ({levelLabel(form.level)})</Label>
                <Select
                  value={form.name || undefined}
                  onValueChange={(value) => {
                    const selected = entityOptions.find((item) => item.name === value);
                    setForm((prev) =>
                      prev
                        ? {
                            ...prev,
                            name: value,
                            abbreviation: (
                              selected?.abbreviation || suggestAbbreviation(value)
                            ).toUpperCase(),
                          }
                        : prev
                    );
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={`Select ${levelLabel(form.level)}`} />
                  </SelectTrigger>
                  <SelectContent>
                    {entityOptions.map((item) => (
                      <SelectItem key={`${item.id}-${item.name}`} value={item.name}>
                        {item.name}
                        {item.abbreviation ? ` (${item.abbreviation})` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Abbreviation</Label>
                <Input
                  className="font-mono uppercase"
                  value={form.abbreviation}
                  onChange={(e) =>
                    setForm((prev) =>
                      prev ? { ...prev, abbreviation: e.target.value.toUpperCase() } : prev
                    )
                  }
                  placeholder={suggestAbbreviation(form.name || 'XX')}
                />
              </div>

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setForm(null)}>
                  Cancel
                </Button>
                <Button type="button" onClick={saveForm} disabled={!form.name.trim()}>
                  Save
                </Button>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteKey}
        onOpenChange={(open) => !open && setDeleteKey(null)}
        title="Delete hierarchy node?"
        description={
          deleteTarget
            ? `Delete “${deleteTarget.name || 'this node'}” and all of its children from this configuration?`
            : ''
        }
        onConfirm={confirmDelete}
        destructive
      />
    </>
  );
}

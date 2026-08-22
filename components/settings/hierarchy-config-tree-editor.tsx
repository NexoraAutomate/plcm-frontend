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
  Copy,
  Lock,
  LockOpen,
  Maximize2,
  Minimize2,
  Plus,
  Rows2,
  Save,
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
import { ConfirmDialog } from '@/components/confirm-dialog';
import { useAppDefinitions } from '@/lib/app-definitions-context';
import { suggestAbbreviation } from '@/lib/app-definitions';
import { useHierarchiesQuery } from '@/hooks/queries';
import { filterTemplateNames, hierarchiesToNameItems } from '@/lib/hierarchy-template-names';
import {
  CHILD_TEMPLATE_LEVEL,
  PARENT_TEMPLATE_LEVEL,
  TEMPLATE_NODE_LEVELS,
  newClientKey,
  type TemplateDraftNode,
  type TemplateNodeLevel,
} from '@/lib/hierarchy-config';
import {
  buildGraphFromDraft,
  canLinkLevels,
  descendantsOf,
  hasSystemNode,
  isDraftNode,
  isEntityAssigned,
  isNameTakenUnderParent,
  layoutHandleIds,
  siblingsOf,
  usedAssignedNamesUnderParent,
  type ConfigTreeEdgeData,
  type ConfigTreeNodeData,
  type LayoutDirection,
} from '@/lib/config-tree-layout';
import { LEVEL_LEGEND_DOT, LEVEL_NODE_STYLE } from '@/lib/config-tree-level-styles';
import {
  ConfigTreeFlowNode,
  type ConfigTreeNodeActions,
} from '@/components/settings/config-tree/config-tree-flow-node';
import { ConfigAnimatedEdge } from '@/components/settings/config-tree/config-animated-edge';
import { ConfigTreeEraser } from '@/components/settings/config-tree/config-tree-eraser';
import { ConfigTreeEntitySidebar, ENTITY_DND_MIME, type EntityDragPayload } from '@/components/settings/config-tree/config-tree-entity-sidebar';
import { ConfigEntityTypeTree } from '@/components/settings/config-tree/config-entity-type-tree';
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
  const lastLayoutNonce = useRef(layoutNonce);
  const lastStructureKey = useRef(structureKey);
  const lastDirection = useRef(direction);

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
  const [selectedParentKey, setSelectedParentKey] = useState<string | null>(null);

  const nodesByKey = useMemo(() => {
    const map = new Map<string, TemplateDraftNode>();
    for (const n of draftNodes) map.set(n.client_key, n);
    return map;
  }, [draftNodes]);

  const systemExists = useMemo(() => hasSystemNode(draftNodes), [draftNodes]);

  const selectedParent = selectedParentKey
    ? nodesByKey.get(selectedParentKey) ?? null
    : null;

  const focusChildLevel = selectedParent
    ? CHILD_TEMPLATE_LEVEL[selectedParent.level]
    : systemExists
      ? null
      : ('system' as TemplateNodeLevel | null);

  const usedChildNames = useMemo(() => {
    if (!selectedParentKey && focusChildLevel === 'system') {
      return usedAssignedNamesUnderParent(draftNodes, null);
    }
    if (!selectedParentKey) return new Set<string>();
    return usedAssignedNamesUnderParent(draftNodes, selectedParentKey);
  }, [draftNodes, focusChildLevel, selectedParentKey]);

  const sidebarContextLabel = selectedParent
    ? focusChildLevel
      ? `Adding under “${selectedParent.name || levelLabel(selectedParent.level)}” — remaining ${levelLabel(focusChildLevel)}s`
      : `“${selectedParent.name || levelLabel(selectedParent.level)}” has no child level`
    : systemExists
      ? 'Select a parent node to list remaining children'
      : 'Drag a System onto the canvas to start';

  // Rebuild graph when draft structure / lock / layout direction changes
  useEffect(() => {
    if (skipNextSync.current) {
      skipNextSync.current = false;
      return;
    }

    const structureChanged = lastStructureKey.current !== structureKey;
    const directionChanged = lastDirection.current !== direction;
    const layoutChanged = lastLayoutNonce.current !== layoutNonce;
    lastStructureKey.current = structureKey;
    lastDirection.current = direction;
    lastLayoutNonce.current = layoutNonce;

    // Drop freehand pending spots — new nodes always snap into the active layout
    pendingPositions.current.clear();

    const positionById = new Map(
      getNodes().map((n) => [n.id, { x: n.position.x, y: n.position.y }])
    );
    const sizeById = new Map(
      getNodes().map((n) => [
        n.id,
        {
          width: typeof n.style?.width === 'number' ? n.style.width : 280,
          height: typeof n.style?.height === 'number' ? n.style.height : 110,
        },
      ])
    );

    // Re-run Dagre whenever hierarchy or orientation changes so siblings/children
    // land on the correct parallel rank. Preserve positions only for lock toggles.
    const applyAutoLayout =
      structureChanged ||
      directionChanged ||
      layoutChanged ||
      positionById.size === 0;

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
      onAddChild: (key) => {
        setSelectedParentKey(key);
        addChild(key);
      },
      onAddSiblingAbove: (key) => {
        const node = nodesByKey.get(key);
        if (node?.parent_client_key) setSelectedParentKey(node.parent_client_key);
        addSibling(key, 'above');
      },
      onAddSiblingBelow: (key) => {
        const node = nodesByKey.get(key);
        if (node?.parent_client_key) setSelectedParentKey(node.parent_client_key);
        addSibling(key, 'below');
      },
      onAddParentPeer: (key) => {
        const node = nodesByKey.get(key);
        const parent = node?.parent_client_key
          ? nodesByKey.get(node.parent_client_key)
          : null;
        if (parent?.parent_client_key) {
          setSelectedParentKey(parent.parent_client_key);
        } else if (parent) {
          setSelectedParentKey(null);
        }
        addParentPeer(key);
      },
    }),
    [addChild, addParentPeer, addSibling, nodesByKey, openNodeForm, requestDeleteNode]
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
      if (
        isEntityAssigned(target) &&
        isNameTakenUnderParent(draftNodes, sourceId, target.name, targetId)
      ) {
        toast.error(
          `“${target.name}” is already used under this ${levelLabel(source.level)}`
        );
        return false;
      }
      // Let structure sync re-run Dagre so the linked nodes sit on the active layout
      onChange(
        draftNodes.map((n) =>
          n.client_key === targetId
            ? { ...n, parent_client_key: sourceId }
            : n
        )
      );
      return true;
    },
    [draftNodes, levelLabel, nodesByKey, onChange]
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
      setSelectedParentKey(fromId);
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
    event.stopPropagation();
    event.dataTransfer.dropEffect = 'copy';
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      event.stopPropagation();
      if (locked || readOnly || mode === 'eraser') return;
      const raw =
        event.dataTransfer.getData(ENTITY_DND_MIME) ||
        event.dataTransfer.getData('application/json') ||
        '';
      if (!raw) {
        toast.error('Could not read dragged entity');
        return;
      }
      let payload: EntityDragPayload;
      try {
        payload = JSON.parse(raw) as EntityDragPayload;
      } catch {
        toast.error('Invalid drag payload');
        return;
      }
      if (!payload.level || !payload.name) {
        toast.error('Could not read dragged entity');
        return;
      }

      if (payload.level === 'system') {
        if (hasSystemNode(draftNodes)) {
          toast.error('Only one System is allowed in a configuration');
          return;
        }
        const key = placeNode({
          level: 'system',
          parentKey: null,
          name: payload.name,
          abbreviation: payload.abbreviation || suggestAbbreviation(payload.name),
          position: screenToFlowPosition({
            x: event.clientX,
            y: event.clientY,
          }),
        });
        if (key) setSelectedParentKey(key);
        return;
      }

      let parentKey: string | null = selectedParentKey;
      if (parentKey) {
        const parent = nodesByKey.get(parentKey);
        if (!parent || CHILD_TEMPLATE_LEVEL[parent.level] !== payload.level) {
          toast.error(
            `Select a ${levelLabel(PARENT_TEMPLATE_LEVEL[payload.level] || 'parent')} first, then drop this ${levelLabel(payload.level)}`
          );
          return;
        }
      } else {
        // Fallback: nearest valid parent by proximity
        const position = screenToFlowPosition({
          x: event.clientX,
          y: event.clientY,
        });
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
          toast.error(
            `Select a parent on the canvas, or drop near a valid parent for ${levelLabel(payload.level)}`
          );
          return;
        }
        parentKey = best.id;
      }

      if (isNameTakenUnderParent(draftNodes, parentKey, payload.name)) {
        toast.error(
          `“${payload.name}” is already used under this ${levelLabel(
            nodesByKey.get(parentKey!)?.level || 'parent'
          )}`
        );
        return;
      }

      placeNode({
        level: payload.level,
        parentKey,
        name: payload.name,
        abbreviation: payload.abbreviation || suggestAbbreviation(payload.name),
        position: screenToFlowPosition({
          x: event.clientX,
          y: event.clientY,
        }),
      });
    },
    [
      draftNodes,
      getNodes,
      levelLabel,
      locked,
      mode,
      nodesByKey,
      placeNode,
      readOnly,
      screenToFlowPosition,
      selectedParentKey,
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

  // Clear selection if the node was deleted
  useEffect(() => {
    if (selectedParentKey && !nodesByKey.has(selectedParentKey)) {
      setSelectedParentKey(null);
    }
  }, [nodesByKey, selectedParentKey]);

  return (
    <div className="flex h-full min-h-0 w-full">
      <ConfigTreeEntitySidebar
        entities={entityListItems}
        levelLabel={levelLabel}
        disabled={!interactive}
        focusChildLevel={
          selectedParent
            ? focusChildLevel
            : systemExists
              ? null
              : 'system'
        }
        usedChildNames={usedChildNames}
        hideSystemLevel={systemExists}
        contextLabel={sidebarContextLabel}
      />
      <div className="relative min-h-0 min-w-0 flex-1">
        <ActionsContext.Provider value={actions}>
          <ReactFlow
            nodes={nodes.map((n) => ({
              ...n,
              selected: n.id === selectedParentKey,
            }))}
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
            onNodeClick={(_, node) => {
              if (!interactive) return;
              setSelectedParentKey(node.id);
            }}
            onPaneClick={() => {
              if (!interactive) return;
              setSelectedParentKey(null);
            }}
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
              ...(() => {
                const h = layoutHandleIds(direction);
                return {
                  sourceHandle: h.sourceHandle,
                  targetHandle: h.targetHandle,
                };
              })(),
            }}
            connectionLineStyle={{ stroke: '#64748b', strokeWidth: 2 }}
            className={cn(mode === 'eraser' && 'cursor-crosshair')}
          >
            <Background gap={16} size={1} />
            <Controls showInteractive={false} />
            <MiniMap
              pannable
              zoomable
              className="bg-background/80!"
              nodeColor={(node) => {
                const level = (node.data as ConfigTreeNodeData | undefined)?.draft?.level;
                if (!level) return '#94a3b8';
                return LEVEL_NODE_STYLE[level].minimap;
              }}
            />
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
              {!readOnly && !locked && !systemExists ? (
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  className="h-8"
                  onClick={() => {
                    setSelectedParentKey(null);
                    addChild(null);
                  }}
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
  /** Existing config id — when set, Save updates in place (no rename). */
  configId?: number;
  suggestedDuplicateName?: string;
  /** Save current draft (create if new, update if editing). */
  onSave?: () => Promise<void> | void;
  /** Duplicate as a new named configuration available for HM. */
  onDuplicate?: (input: {
    name: string;
    description: string;
  }) => Promise<boolean | void> | boolean | void;
  saving?: boolean;
};

export function HierarchyConfigTreeEditor({
  nodes,
  onChange,
  readOnly = false,
  openFullscreenSignal = 0,
  configId,
  suggestedDuplicateName = '',
  onSave,
  onDuplicate,
  saving = false,
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
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [saveDescription, setSaveDescription] = useState('');
  const pendingPositions = useRef(new Map<string, { x: number; y: number }>());

  const unassignedCount = useMemo(
    () => nodes.filter((n) => !isEntityAssigned(n)).length,
    [nodes]
  );
  const entitiesReady = nodes.length > 0 && unassignedCount === 0;
  const canPersist =
    !readOnly && entitiesReady && !saving && (!!onSave || !!onDuplicate);

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
      if (form || deleteKey || saveDialogOpen) return;
      event.preventDefault();
      closeFullscreen();
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [closeFullscreen, deleteKey, form, overlayOpen, saveDialogOpen]);

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
      if (input.level === 'system' && hasSystemNode(nodes)) {
        toast.error('Only one System is allowed in a configuration');
        return '';
      }
      if (
        input.name?.trim() &&
        isNameTakenUnderParent(nodes, input.parentKey, input.name)
      ) {
        toast.error(`“${input.name}” is already used under this parent`);
        return '';
      }

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
      // Positions come from Dagre on the next structure sync (active H/V layout).
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
        if (hasSystemNode(nodes)) {
          toast.error('Only one System is allowed in a configuration');
          return;
        }
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
    [nodes, nodesByKey, placeNode]
  );

  const addSibling = useCallback(
    (clientKey: string, where: 'above' | 'below') => {
      const node = nodesByKey.get(clientKey);
      if (!node) return;
      if (node.level === 'system') {
        toast.error('Only one System is allowed in a configuration');
        return;
      }
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
        toast.error('Only one System is allowed in a configuration');
        return;
      }
      const parentKey = node.parent_client_key ?? null;
      const parent = parentKey ? nodesByKey.get(parentKey) : null;
      if (!parent) {
        toast.error('Parent node not found');
        return;
      }
      if (parent.level === 'system') {
        toast.error('Only one System is allowed in a configuration');
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

  const usedNamesForForm = useMemo(() => {
    if (!form) return new Set<string>();
    const current = nodes.find((n) => n.client_key === form.clientKey);
    const parentKey = current?.parent_client_key ?? null;
    return usedAssignedNamesUnderParent(nodes, parentKey, form.clientKey);
  }, [form, nodes]);

  const entityOptions = useMemo(() => {
    if (!form) return [];
    return filterTemplateNames(entityListItems, form.level).filter(
      (item) => !usedNamesForForm.has(item.name.trim().toLowerCase())
    );
  }, [entityListItems, form, usedNamesForForm]);

  const saveForm = useCallback(() => {
    if (!form) return;
    const name = form.name.trim();
    if (!name) {
      toast.error('Select or enter an entity name');
      return;
    }
    const current = nodesByKey.get(form.clientKey);
    const parentKey = current?.parent_client_key ?? null;
    if (isNameTakenUnderParent(nodes, parentKey, name, form.clientKey)) {
      toast.error(`“${name}” is already used under this parent`);
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
  }, [entityOptions, form, nodes, nodesByKey, onChange]);

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

  const ensureEntitiesReady = useCallback(() => {
    if (nodes.length === 0) {
      toast.error('Add at least one hierarchy node before saving');
      return false;
    }
    if (unassignedCount > 0) {
      toast.error(
        `Assign an entity to every node before saving (${unassignedCount} unassigned)`
      );
      return false;
    }
    return true;
  }, [nodes.length, unassignedCount]);

  const handleSaveClick = useCallback(() => {
    if (!ensureEntitiesReady() || !onSave) return;
    void onSave();
  }, [ensureEntitiesReady, onSave]);

  const openDuplicateDialog = useCallback(() => {
    if (!ensureEntitiesReady()) return;
    setSaveName(suggestedDuplicateName.trim() || 'Configuration');
    setSaveDescription('');
    setSaveDialogOpen(true);
  }, [ensureEntitiesReady, suggestedDuplicateName]);

  const confirmDuplicate = useCallback(async () => {
    const name = saveName.trim();
    if (!name) {
      toast.error('Configuration name is required');
      return;
    }
    if (!onDuplicate) return;
    const ok = await onDuplicate({ name, description: saveDescription.trim() });
    if (ok !== false) setSaveDialogOpen(false);
  }, [onDuplicate, saveDescription, saveName]);

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

  const actionButtons =
    !readOnly && canPersist ? (
      <>
        {onSave ? (
          <Button
            type="button"
            size="sm"
            className="h-8"
            disabled={!entitiesReady || saving}
            title={
              unassignedCount > 0
                ? `Assign entities to all nodes first (${unassignedCount} left)`
                : nodes.length === 0
                  ? 'Add nodes first'
                  : configId
                    ? 'Save changes to this configuration'
                    : 'Save configuration'
            }
            onClick={handleSaveClick}
          >
            <Save className="mr-1 h-3.5 w-3.5" />
            {saving ? 'Saving…' : 'Save'}
          </Button>
        ) : null}
        {onDuplicate && configId ? (
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="h-8"
            disabled={!entitiesReady || saving}
            title="Create a copy under a new name (available for HM)"
            onClick={openDuplicateDialog}
          >
            <Copy className="mr-1 h-3.5 w-3.5" />
            Duplicate
          </Button>
        ) : null}
      </>
    ) : null;

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
              <div className="max-w-2xl space-y-1">
                <div className="text-xs text-muted-foreground">
                  Lock freezes edits · Controls on hover · Assign every node an entity before
                  save · Esc exits
                </div>
                {unassignedCount > 0 ? (
                  <p className="text-xs font-medium text-amber-700 dark:text-amber-300">
                    {unassignedCount} node{unassignedCount === 1 ? '' : 's'} still need an
                    Entity List assignment
                  </p>
                ) : nodes.length > 0 ? (
                  <p className="text-xs font-medium text-emerald-700 dark:text-emerald-300">
                    All nodes assigned — ready to save
                  </p>
                ) : null}
              </div>
              <div className="flex items-center gap-1.5">
                {actionButtons}
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
              React Flow builder — open full screen to edit and save as a new configuration.
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            {actionButtons}
            <Button type="button" size="sm" variant="secondary" onClick={openFullscreen}>
              <Maximize2 className="mr-1.5 h-4 w-4" />
              Tree builder
            </Button>
          </div>
        </div>
        <div className="space-y-2 p-3">
          <div className="flex flex-wrap gap-2">
            {TEMPLATE_NODE_LEVELS.map((level) => (
              <span
                key={level}
                className="inline-flex items-center rounded-full border bg-background px-2.5 py-0.5 text-xs"
              >
                <span
                  className={cn('mr-1.5 h-2 w-2 rounded-full', LEVEL_LEGEND_DOT[level])}
                />
                {levelLabel(level)}
                <span className="ml-1.5 tabular-nums text-muted-foreground">
                  {nodeCountByLevel[level] ?? 0}
                </span>
              </span>
            ))}
          </div>
          {unassignedCount > 0 ? (
            <p className="text-xs text-amber-700 dark:text-amber-300">
              {unassignedCount} unassigned node{unassignedCount === 1 ? '' : 's'} — assign
              entities before saving.
            </p>
          ) : null}
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

      <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Duplicate configuration</DialogTitle>
            <DialogDescription>
              Create a copy of this hierarchy template under a new name. The copy will be marked
              available for HM selection.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="cfg-tree-save-name">New configuration name</Label>
              <Input
                id="cfg-tree-save-name"
                value={saveName}
                onChange={(e) => setSaveName(e.target.value)}
                placeholder="e.g. High Data Rate Standard (copy)"
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cfg-tree-save-desc">Description (optional)</Label>
              <Input
                id="cfg-tree-save-desc"
                value={saveDescription}
                onChange={(e) => setSaveDescription(e.target.value)}
                placeholder="Short description"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setSaveDialogOpen(false)}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={() => void confirmDuplicate()}
                disabled={saving || !saveName.trim()}
              >
                <Copy className="mr-1.5 h-4 w-4" />
                {saving ? 'Saving…' : 'Duplicate'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!form} onOpenChange={(open) => !open && setForm(null)}>
        <DialogContent className="flex max-h-[85vh] max-w-lg flex-col gap-0 overflow-hidden p-0 sm:max-w-lg">
          <DialogHeader className="space-y-1 border-b px-6 py-4">
            <DialogTitle>
              {form?.mode === 'create' ? 'Add hierarchy node' : 'Edit hierarchy node'}
            </DialogTitle>
            <DialogDescription>
              {form
                ? `Expand ${levelLabel(form.level)} and pick an entity. Press Ctrl+S or Save.`
                : null}
            </DialogDescription>
          </DialogHeader>
          {form ? (
            <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden px-6 py-4">
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">Level</span>
                <span className="rounded-full border bg-muted/40 px-2.5 py-0.5 font-medium">
                  {levelLabel(form.level)}
                </span>
              </div>

              <div className="min-h-0 flex-1 space-y-2">
                <Label>Entity list</Label>
                <ConfigEntityTypeTree
                  className="h-72"
                  entities={entityListItems}
                  levelLabel={levelLabel}
                  selectableLevel={form.level}
                  usedNames={usedNamesForForm}
                  selectedName={form.name || undefined}
                  defaultExpandedLevels={[form.level]}
                  onSelect={(item) => {
                    setForm((prev) =>
                      prev
                        ? {
                            ...prev,
                            name: item.name,
                            abbreviation: (
                              item.abbreviation || suggestAbbreviation(item.name)
                            ).toUpperCase(),
                          }
                        : prev
                    );
                  }}
                />
              </div>

              <div className="space-y-2">
                <Label>Abbreviation</Label>
                <Input
                  className="rounded-full font-mono uppercase"
                  value={form.abbreviation}
                  onChange={(e) =>
                    setForm((prev) =>
                      prev ? { ...prev, abbreviation: e.target.value.toUpperCase() } : prev
                    )
                  }
                  placeholder={suggestAbbreviation(form.name || 'XX')}
                />
              </div>

              <div className="flex justify-end gap-2 border-t pt-4">
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

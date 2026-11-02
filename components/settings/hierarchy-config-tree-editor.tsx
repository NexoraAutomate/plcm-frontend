'use client';

/**
 * Hierarchy configuration tree builder (React Flow / xyflow).
 * Features aligned with React Flow examples: lock, resize, move, arrows,
 * add-on-edge-drop, easy-connect, intersections, proximity connect,
 * animated edges, entity DnD, edge delete, H/V layout, eraser/selection,
 * download PDF.
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
  SelectionMode,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Connection,
  type Edge,
  type Node,
  type OnConnectEnd,
  type OnNodeDrag,
  type OnSelectionChangeFunc,
  type NodeProps,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import {
  Copy,
  Maximize2,
  Minimize2,
  Pencil,
  Save,
  Trash2,
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
  DialogFooter,
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
  INVENTORY_SOURCE,
  PARENT_TEMPLATE_LEVEL,
  TEMPLATE_NODE_LEVELS,
  syncInventorySources,
  newClientKey,
  normalizeInventorySource,
  type InventorySource,
  type TemplateDraftNode,
  type TemplateNodeLevel,
} from '@/lib/hierarchy-config';
import {
  buildGraphFromDraft,
  canLinkLevels,
  CONFIG_TREE_FIELD_VISIBILITY_KEYS,
  DEFAULT_CONFIG_TREE_NODE_FIELD_VISIBILITY,
  DEFAULT_NODE_HEIGHT,
  absoluteFlowPosition,
  addNodesToSiblingGroup,
  applyPendingSiblingAdds,
  areSiblingKeys,
  DEFAULT_NODE_WIDTH,
  descendantsOf,
  filterVisibleHierarchyNodes,
  groupSiblingNodes,
  hasSystemNode,
  isDraftNode,
  isEntityAssigned,
  isHierarchyFullyExpanded,
  layoutHandleIds,
  nestSiblingGroup,
  parseSiblingGroupFlowId,
  parentKeysWithChildren,
  pluralizeEntityName,
  pruneUndersizedSiblingGroups,
  renameSiblingGroup,
  setSiblingGroupQuantity,
  siblingGroupMembers,
  siblingGroupParentId,
  siblingsOf,
  ungroupSiblingNodes,
  wouldCreateGroupNestCycle,
  type ConfigTreeEdgeData,
  type ConfigTreeNodeData,
  type ConfigTreeNodeFieldVisibility,
  type LayoutDirection,
  type SiblingGroupNodeData,
} from '@/lib/config-tree-layout';
import { LEVEL_LEGEND_DOT, LEVEL_NODE_STYLE } from '@/lib/config-tree-level-styles';
import {
  ConfigTreeFlowNode,
  type ConfigTreeNodeActions,
} from '@/components/settings/config-tree/config-tree-flow-node';
import { ConfigTreeSiblingGroupNode } from '@/components/settings/config-tree/config-tree-sibling-group-node';
import { ConfigTreeSelectionToolbar } from '@/components/settings/config-tree/config-tree-selection-toolbar';
import { ConfigAnimatedEdge } from '@/components/settings/config-tree/config-animated-edge';
import { ConfigTreeEraser } from '@/components/settings/config-tree/config-tree-eraser';
import { ConfigTreeEntitySidebar, ENTITY_DND_MIME, type EntityDragPayload } from '@/components/settings/config-tree/config-tree-entity-sidebar';
import { ConfigEntityTypeTree } from '@/components/settings/config-tree/config-entity-type-tree';
import { ConfigTreeToolbar } from '@/components/settings/config-tree/config-tree-toolbar';
import {
  useConfigTreePdfDownload,
  type ConfigTreePdfMeta,
} from '@/components/settings/config-tree/config-tree-download-button';
import { InventorySourceToggle } from '@/components/settings/config-tree/inventory-source-toggle';
import { cn } from '@/lib/utils';

const MIN_PROXIMITY = 120;

type InteractionMode = 'selection' | 'eraser';

const MAX_NODE_QUANTITY = 100;

type PendingFormItem = {
  key: string;
  entityId: number;
  name: string;
  abbreviation: string;
  quantity: number;
  /** Used when multiple siblings exist and this line’s quantity > 1. */
  subgroupName: string;
};

type NodeFormState = {
  mode: 'create' | 'edit';
  clientKey: string;
  level: TemplateNodeLevel;
  name: string;
  abbreviation: string;
  inventory_source: InventorySource;
  /** Create only — sibling group label when more than one node is added. */
  groupName: string;
  /** Create only — entities queued into the group (each with its own quantity). */
  pendingItems: PendingFormItem[];
};

const ActionsContext = createContext<ConfigTreeNodeActions | null>(null);

function NodeWithActions(props: NodeProps<Node<ConfigTreeNodeData>>) {
  const actions = useContext(ActionsContext);
  if (!actions) return null;
  return <ConfigTreeFlowNode {...props} actions={actions} />;
}

type SiblingGroupActions = {
  onToggleCollapsed: (groupId: string) => void;
  onEditGroup: (groupId: string) => void;
};

const GroupActionsContext = createContext<SiblingGroupActions | null>(null);

function SiblingGroupWithActions(props: NodeProps<Node<SiblingGroupNodeData>>) {
  const actions = useContext(GroupActionsContext);
  return (
    <ConfigTreeSiblingGroupNode
      {...props}
      onToggleCollapsed={actions?.onToggleCollapsed}
      onEditGroup={actions?.onEditGroup}
    />
  );
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
  pdfMeta?: ConfigTreePdfMeta;
  onSaveClick?: () => void;
  onDuplicateClick?: () => void;
  saving?: boolean;
  saveDisabled?: boolean;
  saveTitle?: string;
  showDuplicate?: boolean;
  duplicateDisabled?: boolean;
  selectedKeys: string[];
  onSelectedKeysChange: (keys: string[]) => void;
  onGroupSiblings: (memberIds?: string[]) => void;
  onUngroupSiblings: (groupId?: string) => void;
  onEditGroup: (groupId: string) => void;
  onApplyGroupMembership: (input: {
    nodeKey: string;
    targetGroupId: string | null;
  }) => void;
  onApplyGroupNesting: (input: {
    childGroupId: string;
    parentGroupId: string | null;
  }) => void;
  /** Drag one sibling node onto another → create/join a group. */
  onPairSiblingNodes: (draggedKey: string, targetKey: string) => void;
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
  onSaveClick,
  onDuplicateClick,
  saving = false,
  saveDisabled = false,
  saveTitle,
  showDuplicate = false,
  duplicateDisabled = false,
  selectedKeys,
  onSelectedKeysChange,
  onGroupSiblings,
  onUngroupSiblings,
  onEditGroup,
  onApplyGroupMembership,
  onApplyGroupNesting,
  onPairSiblingNodes,
  pendingPositions,
  pdfMeta,
}: CanvasProps) {
  const { screenToFlowPosition, getInternalNode, fitView, getNodes } =
    useReactFlow();
  const { busy: downloadBusy, download } = useConfigTreePdfDownload(pdfMeta);
  const connectingNodeId = useRef<string | null>(null);
  const selectedParentKey =
    selectedKeys.length > 0 ? selectedKeys[selectedKeys.length - 1] : null;
  const skipNextSync = useRef(false);
  const structureKey = useMemo(
    () =>
      draftNodes
        .map(
          (n) =>
            `${n.client_key}:${n.parent_client_key ?? ''}:${n.level}:${n.sort_order}:${n.sibling_group_id ?? ''}:${n.sibling_group_parent_id ?? ''}`
        )
        .join('|'),
    [draftNodes]
  );
  const contentKey = useMemo(
    () =>
      draftNodes
        .map(
          (n) =>
            `${n.client_key}:${n.name}:${n.abbreviation ?? ''}:${n.description ?? ''}:${normalizeInventorySource(n.inventory_source)}:${n.sibling_group_name ?? ''}:${n.sibling_group_parent_id ?? ''}`
        )
        .join('|'),
    [draftNodes]
  );
  const lastLayoutNonce = useRef(layoutNonce);
  const lastStructureKey = useRef(structureKey);
  const lastContentKey = useRef(contentKey);
  const lastDirection = useRef(direction);
  /** Empty = system/roots only; keys = parents whose immediate children are shown. */
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(() => new Set());
  const lastExpandedKey = useRef('');
  /** Sibling groups shown as a single card (one parent edge). */
  const [collapsedGroupIds, setCollapsedGroupIds] = useState<Set<string>>(
    () => new Set()
  );
  const collapsedGroupSig = useMemo(
    () => [...collapsedGroupIds].sort().join('|'),
    [collapsedGroupIds]
  );
  const lastCollapsedGroupSig = useRef(collapsedGroupSig);
  const [fieldVisibility, setFieldVisibility] =
    useState<ConfigTreeNodeFieldVisibility>(
      () => ({ ...DEFAULT_CONFIG_TREE_NODE_FIELD_VISIBILITY })
    );
  const fieldVisibilitySig = useMemo(
    () =>
      CONFIG_TREE_FIELD_VISIBILITY_KEYS.map((k) =>
        fieldVisibility[k] ? '1' : '0'
      ).join(''),
    [fieldVisibility]
  );
  const lastFieldVisibilitySig = useRef(fieldVisibilitySig);

  const parentsWithKids = useMemo(
    () => parentKeysWithChildren(draftNodes),
    [draftNodes]
  );
  const showFullHierarchy = useMemo(
    () => isHierarchyFullyExpanded(draftNodes, expandedKeys),
    [draftNodes, expandedKeys]
  );
  const visibleDraftNodes = useMemo(
    () => filterVisibleHierarchyNodes(draftNodes, expandedKeys),
    [draftNodes, expandedKeys]
  );
  const expandedKeySig = useMemo(
    () => [...expandedKeys].sort().join('|'),
    [expandedKeys]
  );

  const initial = useMemo(
    () =>
      buildGraphFromDraft({
        nodes: filterVisibleHierarchyNodes(draftNodes, new Set()),
        levelLabel,
        locked,
        readOnly,
        direction,
        applyAutoLayout: true,
        parentsWithChildren: parentKeysWithChildren(draftNodes),
        expandedKeys: new Set(),
        fieldVisibility: DEFAULT_CONFIG_TREE_NODE_FIELD_VISIBILITY,
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

  const systemExists = useMemo(() => hasSystemNode(draftNodes), [draftNodes]);

  const toggleFullHierarchy = useCallback(() => {
    setExpandedKeys(() =>
      showFullHierarchy ? new Set() : new Set(parentsWithKids)
    );
  }, [parentsWithKids, showFullHierarchy]);

  const ensureExpanded = useCallback((clientKey: string | null | undefined) => {
    if (!clientKey) return;
    setExpandedKeys((prev) => {
      if (prev.has(clientKey)) return prev;
      const next = new Set(prev);
      next.add(clientKey);
      return next;
    });
  }, []);

  const toggleNodeChildren = useCallback(
    (clientKey: string) => {
      if (!parentsWithKids.has(clientKey)) return;
      setExpandedKeys((prev) => {
        const next = new Set(prev);
        if (next.has(clientKey)) {
          next.delete(clientKey);
          // Keep grandchildren collapsed when this node is re-expanded later.
          for (const key of descendantsOf(draftNodes, clientKey)) {
            if (key !== clientKey) next.delete(key);
          }
        } else {
          next.add(clientKey);
        }
        return next;
      });
    },
    [draftNodes, parentsWithKids]
  );

  // Drop expand state for nodes that no longer have children; auto-expand when a
  // new child is linked under a parent that was just created via place/connect.
  useEffect(() => {
    setExpandedKeys((prev) => {
      let changed = false;
      const next = new Set<string>();
      for (const key of prev) {
        if (parentsWithKids.has(key)) next.add(key);
        else changed = true;
      }
      return changed ? next : prev;
    });
  }, [parentsWithKids]);

  const selectedParent = selectedParentKey
    ? nodesByKey.get(selectedParentKey) ?? null
    : null;

  const focusChildLevel = selectedParent
    ? CHILD_TEMPLATE_LEVEL[selectedParent.level]
    : systemExists
      ? null
      : ('system' as TemplateNodeLevel | null);

  const sidebarContextLabel = selectedParent
    ? focusChildLevel
      ? `Adding under “${selectedParent.name || levelLabel(selectedParent.level)}” — drag ${levelLabel(focusChildLevel)}s (duplicates allowed)`
      : `“${selectedParent.name || levelLabel(selectedParent.level)}” has no child level`
    : systemExists
      ? 'Select a parent node to add children'
      : 'Drag a System onto the canvas to start';

  // Rebuild graph when draft structure / lock / layout direction changes
  useEffect(() => {
    if (skipNextSync.current) {
      skipNextSync.current = false;
      return;
    }

    const structureChanged = lastStructureKey.current !== structureKey;
    const contentChanged = lastContentKey.current !== contentKey;
    const directionChanged = lastDirection.current !== direction;
    const layoutChanged = lastLayoutNonce.current !== layoutNonce;
    const expandChanged = lastExpandedKey.current !== expandedKeySig;
    const groupCollapseChanged =
      lastCollapsedGroupSig.current !== collapsedGroupSig;
    const visibilityChanged = lastFieldVisibilitySig.current !== fieldVisibilitySig;
    lastStructureKey.current = structureKey;
    lastContentKey.current = contentKey;
    lastDirection.current = direction;
    lastLayoutNonce.current = layoutNonce;
    lastExpandedKey.current = expandedKeySig;
    lastCollapsedGroupSig.current = collapsedGroupSig;
    lastFieldVisibilitySig.current = fieldVisibilitySig;

    // Drop freehand pending spots — new nodes always snap into the active layout
    pendingPositions.current.clear();

    const current = getNodes();
    // Only measure tree cards — never feed inflated group boxes back into dagre.
    const sizeById = new Map(
      current
        .filter((n) => n.type === 'configTree')
        .map((n) => [
          n.id,
          {
            width:
              typeof n.style?.width === 'number' ? n.style.width : DEFAULT_NODE_WIDTH,
            height:
              typeof n.style?.height === 'number'
                ? n.style.height
                : DEFAULT_NODE_HEIGHT,
          },
        ])
    );

    // Auto-layout on any structural / content / direction / group change (H and V).
    // Skip only for pure field-visibility toggles so the canvas does not jump.
    // @see https://reactflow.dev/examples/layout/auto-layout
    const visibilityOnly =
      visibilityChanged &&
      !structureChanged &&
      !contentChanged &&
      !directionChanged &&
      !layoutChanged &&
      !expandChanged &&
      !groupCollapseChanged;
    const applyAutoLayout = !visibilityOnly || current.length === 0;

    if (!applyAutoLayout) {
      const lookup = new Map(
        current.map((n) => [
          n.id,
          { position: n.position, parentId: n.parentId ?? null },
        ])
      );
      const positionById = new Map(
        current
          .filter((n) => n.type === 'configTree')
          .map((n) => [n.id, absoluteFlowPosition(n, lookup)])
      );
      const kept = buildGraphFromDraft({
        nodes: visibleDraftNodes,
        levelLabel,
        locked,
        readOnly,
        direction,
        sizeById,
        positionById,
        applyAutoLayout: false,
        parentsWithChildren: parentsWithKids,
        expandedKeys,
        fieldVisibility,
        collapsedGroupIds,
      });
      setNodes(kept.flowNodes);
      setEdges(kept.edges);
      return;
    }

    const next = buildGraphFromDraft({
      nodes: visibleDraftNodes,
      levelLabel,
      locked,
      readOnly,
      direction,
      sizeById,
      applyAutoLayout: true,
      parentsWithChildren: parentsWithKids,
      expandedKeys,
      fieldVisibility,
      collapsedGroupIds,
    });
    setNodes(next.flowNodes);
    setEdges(next.edges);
    const t = window.setTimeout(() => void fitView({ padding: 0.2, duration: 200 }), 40);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- rebuild on structure/content/layout/expand/visibility signatures
  }, [
    structureKey,
    contentKey,
    locked,
    readOnly,
    direction,
    layoutNonce,
    expandedKeySig,
    collapsedGroupSig,
    fieldVisibilitySig,
  ]);

  const deleteEdgeById = useCallback(
    (edgeId: string) => {
      if (locked || readOnly) return;
      const edge = edges.find((e) => e.id === edgeId);
      if (!edge) return;
      onChange(
        syncInventorySources(
          draftNodes.map((n) =>
            n.client_key === edge.target ? { ...n, parent_client_key: null } : n
          )
        )
      );
      setEdges((eds) => eds.filter((e) => e.id !== edgeId));
      toast.success('Edge removed');
    },
    [draftNodes, edges, locked, onChange, readOnly, setEdges]
  );

  const toggleGroupCollapsed = useCallback((groupId: string) => {
    setCollapsedGroupIds((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  }, []);

  const nodeTypes = useMemo(
    () => ({
      configTree: NodeWithActions,
      siblingGroup: SiblingGroupWithActions,
    }),
    []
  );

  // Drop dead collapse state; newly created groups start collapsed by default.
  const knownGroupIdsRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    const live = new Set<string>();
    for (const n of draftNodes) {
      const gid = n.sibling_group_id?.trim();
      if (gid) live.add(gid);
      const parentGid = n.sibling_group_parent_id?.trim();
      if (parentGid) live.add(parentGid);
    }
    setCollapsedGroupIds((prev) => {
      let changed = false;
      const next = new Set<string>();
      for (const id of prev) {
        if (live.has(id)) next.add(id);
        else changed = true;
      }
      for (const id of live) {
        if (!knownGroupIdsRef.current.has(id)) {
          next.add(id);
          changed = true;
        }
      }
      knownGroupIdsRef.current = live;
      return changed ? next : prev;
    });
  }, [draftNodes]);

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
        onSelectedKeysChange([key]);
        ensureExpanded(key);
        addChild(key);
      },
      onAddSiblingAbove: (key) => {
        const node = nodesByKey.get(key);
        if (node?.parent_client_key) onSelectedKeysChange([node.parent_client_key]);
        addSibling(key, 'above');
      },
      onAddSiblingBelow: (key) => {
        const node = nodesByKey.get(key);
        if (node?.parent_client_key) onSelectedKeysChange([node.parent_client_key]);
        addSibling(key, 'below');
      },
      onAddParentPeer: (key) => {
        const node = nodesByKey.get(key);
        const parent = node?.parent_client_key
          ? nodesByKey.get(node.parent_client_key)
          : null;
        if (parent?.parent_client_key) {
          onSelectedKeysChange([parent.parent_client_key]);
        } else if (parent) {
          onSelectedKeysChange([]);
        }
        addParentPeer(key);
      },
      onToggleChildren: toggleNodeChildren,
      onSetInventorySource: (key, source) => {
        const node = nodesByKey.get(key);
        if (!node) return;
        if (normalizeInventorySource(node.inventory_source) === source) return;
        onChange(
          syncInventorySources(
            draftNodes.map((n) =>
              n.client_key === key ? { ...n, inventory_source: source } : n
            )
          )
        );
      },
    }),
    [
      addChild,
      addParentPeer,
      addSibling,
      draftNodes,
      ensureExpanded,
      nodesByKey,
      onChange,
      onSelectedKeysChange,
      openNodeForm,
      requestDeleteNode,
      toggleNodeChildren,
    ]
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
      // Let structure sync re-run Dagre so the linked nodes sit on the active layout
      ensureExpanded(sourceId);
      onChange(
        syncInventorySources(
          draftNodes.map((n) =>
            n.client_key === targetId
              ? { ...n, parent_client_key: sourceId }
              : n
          )
        )
      );
      return true;
    },
    [draftNodes, ensureExpanded, levelLabel, nodesByKey, onChange]
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
      onSelectedKeysChange([fromId]);
      ensureExpanded(fromId);
      placeNode({
        level: childLevel,
        parentKey: fromId,
        position,
      });
    },
    [
      ensureExpanded,
      locked,
      mode,
      onSelectedKeysChange,
      nodesByKey,
      placeNode,
      readOnly,
      screenToFlowPosition,
    ]
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
          const aw = typeof a.style?.width === 'number' ? a.style.width : DEFAULT_NODE_WIDTH;
          const ah = typeof a.style?.height === 'number' ? a.style.height : DEFAULT_NODE_HEIGHT;
          const bw = typeof n.style?.width === 'number' ? n.style.width : DEFAULT_NODE_WIDTH;
          const bh = typeof n.style?.height === 'number' ? n.style.height : DEFAULT_NODE_HEIGHT;
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

  const hitTestSiblingGroup = useCallback(
    (
      node: Node,
      opts?: { excludeGroupIds?: ReadonlySet<string> }
    ): string | null => {
      const all = getNodes();
      const byId = new Map(
        all.map((n) => [
          n.id,
          { position: n.position, parentId: n.parentId ?? null },
        ])
      );
      const abs = absoluteFlowPosition(node, byId);
      const nw =
        typeof node.width === 'number'
          ? node.width
          : typeof node.style?.width === 'number'
            ? node.style.width
            : DEFAULT_NODE_WIDTH;
      const nh =
        typeof node.height === 'number'
          ? node.height
          : typeof node.style?.height === 'number'
            ? node.style.height
            : DEFAULT_NODE_HEIGHT;
      const center = { x: abs.x + nw / 2, y: abs.y + nh / 2 };

      let hitGroupId: string | null = null;
      let hitArea = Number.POSITIVE_INFINITY;
      for (const candidate of all) {
        if (candidate.type !== 'siblingGroup') continue;
        if (candidate.id === node.id) continue;
        const gid = parseSiblingGroupFlowId(candidate.id);
        if (!gid) continue;
        if (opts?.excludeGroupIds?.has(gid)) continue;
        const gAbs = absoluteFlowPosition(candidate, byId);
        const gw =
          typeof candidate.width === 'number'
            ? candidate.width
            : typeof candidate.style?.width === 'number'
              ? candidate.style.width
              : DEFAULT_NODE_WIDTH;
        const gh =
          typeof candidate.height === 'number'
            ? candidate.height
            : typeof candidate.style?.height === 'number'
              ? candidate.style.height
              : DEFAULT_NODE_HEIGHT;
        if (
          center.x >= gAbs.x &&
          center.x <= gAbs.x + gw &&
          center.y >= gAbs.y &&
          center.y <= gAbs.y + gh
        ) {
          const area = gw * gh;
          if (area < hitArea) {
            hitArea = area;
            hitGroupId = gid;
          }
        }
      }
      return hitGroupId;
    },
    [getNodes]
  );

  /** Closest overlapping sibling tree node under the drag center (same parent). */
  const hitTestSiblingNode = useCallback(
    (node: Node): string | null => {
      const dragged = nodesByKey.get(node.id);
      if (!dragged || dragged.level === 'system') return null;

      const all = getNodes();
      const byId = new Map(
        all.map((n) => [
          n.id,
          { position: n.position, parentId: n.parentId ?? null },
        ])
      );
      const abs = absoluteFlowPosition(node, byId);
      const nw =
        typeof node.width === 'number'
          ? node.width
          : typeof node.style?.width === 'number'
            ? node.style.width
            : DEFAULT_NODE_WIDTH;
      const nh =
        typeof node.height === 'number'
          ? node.height
          : typeof node.style?.height === 'number'
            ? node.style.height
            : DEFAULT_NODE_HEIGHT;
      const center = { x: abs.x + nw / 2, y: abs.y + nh / 2 };

      let best: { id: string; area: number } | null = null;
      for (const candidate of all) {
        if (candidate.type !== 'configTree' || candidate.id === node.id) continue;
        const target = nodesByKey.get(candidate.id);
        if (!target || target.level === 'system') continue;
        if (
          (target.parent_client_key ?? null) !==
          (dragged.parent_client_key ?? null)
        ) {
          continue;
        }
        const tAbs = absoluteFlowPosition(candidate, byId);
        const tw =
          typeof candidate.width === 'number'
            ? candidate.width
            : typeof candidate.style?.width === 'number'
              ? candidate.style.width
              : DEFAULT_NODE_WIDTH;
        const th =
          typeof candidate.height === 'number'
            ? candidate.height
            : typeof candidate.style?.height === 'number'
              ? candidate.style.height
              : DEFAULT_NODE_HEIGHT;
        if (
          center.x < tAbs.x ||
          center.x > tAbs.x + tw ||
          center.y < tAbs.y ||
          center.y > tAbs.y + th
        ) {
          continue;
        }
        const area = tw * th;
        if (!best || area < best.area) best = { id: candidate.id, area };
      }
      return best?.id ?? null;
    },
    [getNodes, nodesByKey]
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
      setEdges((es) => es.filter((e) => e.className !== 'temp'));

      // Nest one sibling group inside another (same tier).
      if (node.type === 'siblingGroup') {
        const childGroupId = parseSiblingGroupFlowId(node.id);
        if (!childGroupId) return;
        const exclude = new Set<string>([childGroupId]);
        // Exclude descendants to avoid cycles via drop target.
        for (const draft of draftNodes) {
          const gid = draft.sibling_group_id?.trim();
          if (!gid || exclude.has(gid)) continue;
          if (wouldCreateGroupNestCycle(draftNodes, childGroupId, gid)) {
            exclude.add(gid);
          }
        }
        const hitGroupId = hitTestSiblingGroup(node, { excludeGroupIds: exclude });
        const currentParent = siblingGroupParentId(draftNodes, childGroupId);
        if (hitGroupId !== currentParent) {
          onApplyGroupNesting({
            childGroupId,
            parentGroupId: hitGroupId,
          });
        }
        return;
      }

      // Sibling nodes / groups: pair nodes first, then join/leave groups.
      if (node.type === 'configTree') {
        // Drop onto another sibling node → create (or join) a group.
        const hitSiblingKey = hitTestSiblingNode(node);
        if (hitSiblingKey) {
          onPairSiblingNodes(node.id, hitSiblingKey);
          return;
        }

        // Drop onto a group frame to join; drag clear of a group to leave
        // (node stays in the configuration either way).
        const hitGroupId = hitTestSiblingGroup(node);
        const currentGroupId =
          nodesByKey.get(node.id)?.sibling_group_id?.trim() || null;
        if (hitGroupId !== currentGroupId) {
          onApplyGroupMembership({
            nodeKey: node.id,
            targetGroupId: hitGroupId,
          });
          return;
        }
      }

      const close = getClosestEdge(node);
      if (close) tryConnect(close.source, close.target);
    },
    [
      draftNodes,
      getClosestEdge,
      hitTestSiblingGroup,
      hitTestSiblingNode,
      locked,
      nodesByKey,
      onApplyGroupMembership,
      onApplyGroupNesting,
      onPairSiblingNodes,
      readOnly,
      setEdges,
      setNodes,
      tryConnect,
    ]
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
        if (key) onSelectedKeysChange([key]);
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

      ensureExpanded(parentKey);
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
      ensureExpanded,
      getNodes,
      levelLabel,
      locked,
      mode,
      nodesByKey,
      onSelectedKeysChange,
      placeNode,
      readOnly,
      screenToFlowPosition,
      selectedParentKey,
    ]
  );

  const onEraseNodes = useCallback(
    (ids: string[]) => {
      if (locked || readOnly || !ids.length) return;
      const erasable = ids.filter((id) => !id.startsWith('sibling-group-'));
      if (!erasable.length) return;
      let remove = new Set<string>();
      for (const id of erasable) {
        for (const k of descendantsOf(draftNodes, id)) remove.add(k);
      }
      const remaining = draftNodes.filter((n) => !remove.has(n.client_key));
      onChange(syncInventorySources(pruneUndersizedSiblingGroups(remaining)));
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
        syncInventorySources(
          draftNodes.map((n) =>
            targets.has(n.client_key) ? { ...n, parent_client_key: null } : n
          )
        )
      );
      toast.success(`Erased ${targets.size} edge(s)`);
    },
    [draftNodes, edges, locked, onChange, readOnly]
  );

  const interactive = !locked && !readOnly && mode === 'selection';

  // Drop deleted keys from multi-selection
  useEffect(() => {
    if (!selectedKeys.some((key) => !nodesByKey.has(key))) return;
    onSelectedKeysChange(selectedKeys.filter((key) => nodesByKey.has(key)));
  }, [nodesByKey, onSelectedKeysChange, selectedKeys]);

  const canGroupSelection =
    !readOnly &&
    !locked &&
    selectedKeys.length >= 2 &&
    areSiblingKeys(draftNodes, selectedKeys);
  const canUngroupSelection =
    !readOnly &&
    !locked &&
    selectedKeys.some((key) => Boolean(nodesByKey.get(key)?.sibling_group_id));

  const onSelectionChange = useCallback<OnSelectionChangeFunc>(
    ({ nodes: selected }) => {
      if (!interactive) return;
      onSelectedKeysChange(
        selected.filter((n) => n.type === 'configTree').map((n) => n.id)
      );
    },
    [interactive, onSelectedKeysChange]
  );

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
        hideSystemLevel={systemExists}
        contextLabel={sidebarContextLabel}
      />
      <div className="relative min-h-0 min-w-0 flex-1">
        <ActionsContext.Provider value={actions}>
          <GroupActionsContext.Provider
            value={{
              onToggleCollapsed: toggleGroupCollapsed,
              onEditGroup,
            }}
          >
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
            onSelectionChange={interactive ? onSelectionChange : undefined}
            onNodeDoubleClick={(_, node) => {
              if (!interactive) return;
              if (node.type === 'siblingGroup') {
                const gid = parseSiblingGroupFlowId(node.id);
                if (gid) onEditGroup(gid);
                return;
              }
              openNodeForm(node.id);
            }}
            nodesDraggable={interactive}
            nodesConnectable={interactive}
            elementsSelectable={mode === 'selection'}
            selectionMode={SelectionMode.Partial}
            multiSelectionKeyCode="Shift"
            edgesFocusable={interactive}
            deleteKeyCode={interactive ? ['Backspace', 'Delete'] : null}
            onBeforeDelete={async ({ nodes: ns, edges: es }) => {
              const target = ns.find((n) => n.type === 'configTree');
              if (target) {
                requestDeleteNode(target.id);
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
            <Panel position="top-left" className="z-50 m-2">
              <ConfigTreeToolbar
                showFullHierarchy={showFullHierarchy}
                canToggleHierarchy={parentsWithKids.size > 0}
                onToggleHierarchy={toggleFullHierarchy}
                locked={locked}
                readOnly={readOnly}
                onToggleLock={() => setLocked(!locked)}
                mode={mode}
                onModeChange={setMode}
                direction={direction}
                onDirectionChange={setDirection}
                showAddSystem={!readOnly && !locked && !systemExists}
                addSystemLabel={levelLabel('system')}
                onAddSystem={() => {
                  onSelectedKeysChange([]);
                  addChild(null);
                }}
                fieldVisibility={fieldVisibility}
                onFieldVisibilityChange={setFieldVisibility}
                fileActions={{
                  onDownload: () => void download(),
                  downloadBusy,
                  onSave: onSaveClick,
                  saveDisabled,
                  saveTitle,
                  saving,
                  onDuplicate: showDuplicate ? onDuplicateClick : undefined,
                  duplicateDisabled,
                }}
                groupActions={{
                  canGroup: canGroupSelection,
                  canUngroup: canUngroupSelection,
                  onGroup: () => onGroupSiblings(),
                  onUngroup: () => onUngroupSiblings(),
                  selectionCount: selectedKeys.length,
                }}
              />
            </Panel>

            {!readOnly && !locked && mode === 'selection' ? (
              <ConfigTreeSelectionToolbar
                draftNodes={draftNodes}
                locked={locked}
                readOnly={readOnly}
                onGroup={(memberIds) => onGroupSiblings(memberIds)}
                onUngroup={(groupId) => onUngroupSiblings(groupId)}
                onEditGroup={onEditGroup}
              />
            ) : null}

            {mode === 'eraser' && !locked && !readOnly ? (
              <ConfigTreeEraser
                onEraseNodes={onEraseNodes}
                onEraseEdges={onEraseEdges}
              />
            ) : null}
          </ReactFlow>
          </GroupActionsContext.Provider>
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
  /** Prefill for create/duplicate name dialogs. */
  suggestedDuplicateName?: string;
  /** Current draft description (prefill create dialog). */
  draftDescription?: string;
  /** Current draft name (prefill create dialog when already typed in the form). */
  draftName?: string;
  /** Metadata shown in the PDF header/footer when downloading the tree. */
  pdfMeta?: ConfigTreePdfMeta;
  /** True when the proposed name clashes with another configuration. */
  isNameTaken?: (name: string) => boolean;
  /**
   * Save current draft. For new configs the tree opens a name dialog and
   * passes `{ name, description }`. For existing configs it is called with no args.
   */
  onSave?: (input?: {
    name: string;
    description: string;
  }) => Promise<boolean | void> | boolean | void;
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
  draftDescription = '',
  draftName = '',
  pdfMeta,
  isNameTaken,
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
  const [saveDialogMode, setSaveDialogMode] = useState<'create' | 'duplicate'>(
    'create'
  );
  const [saveName, setSaveName] = useState('');
  const [saveDescription, setSaveDescription] = useState('');
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [groupDialogOpen, setGroupDialogOpen] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [pendingGroupKeys, setPendingGroupKeys] = useState<string[]>([]);
  const [editGroupId, setEditGroupId] = useState<string | null>(null);
  const [editGroupName, setEditGroupName] = useState('');
  const [editGroupQuantity, setEditGroupQuantity] = useState(2);
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
      if (form || deleteKey || saveDialogOpen || groupDialogOpen || editGroupId) return;
      event.preventDefault();
      closeFullscreen();
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [
    closeFullscreen,
    deleteKey,
    editGroupId,
    form,
    groupDialogOpen,
    overlayOpen,
    saveDialogOpen,
  ]);

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
        inventory_source: normalizeInventorySource(node.inventory_source),
        groupName: isDraftNode(node) ? '' : node.name,
        pendingItems: [],
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
        inventory_source: INVENTORY_SOURCE.TURNKEY,
      };
      const nextSiblings = [...siblings];
      nextSiblings.splice(insertAt, 0, draft);
      const base = nodes.filter((n) => (n.parent_client_key ?? null) !== input.parentKey);
      const reindexed = nextSiblings.map((s, index) => ({ ...s, sort_order: index }));
      onChange(syncInventorySources([...base, ...reindexed]));
      // Force H/V auto-layout after every insert (avoids TB group stretch from stale coords).
      setLayoutNonce((n) => n + 1);
      if (!input.name) {
        setForm({
          mode: 'create',
          clientKey: key,
          level: input.level,
          name: '',
          abbreviation: '',
          inventory_source: INVENTORY_SOURCE.TURNKEY,
          groupName: '',
          pendingItems: [],
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
    const remaining = nodes.filter((n) => !removeKeys.has(n.client_key));
    onChange(syncInventorySources(pruneUndersizedSiblingGroups(remaining)));
    setForm((f) => (f && removeKeys.has(f.clientKey) ? null : f));
    setSelectedKeys((keys) => keys.filter((k) => !removeKeys.has(k)));
    setDeleteKey(null);
    toast.success('Node and children removed');
  }, [deleteKey, nodes, onChange]);

  const openGroupDialog = useCallback(
    (memberIds?: string[]) => {
      const keys = memberIds?.length ? memberIds : selectedKeys;
      if (keys.length < 2 || !areSiblingKeys(nodes, keys)) {
        toast.error('Select two or more sibling nodes (Shift+click)');
        return;
      }
      const existingName = keys
        .map((key) => nodesByKey.get(key)?.sibling_group_name?.trim())
        .find(Boolean);
      setPendingGroupKeys(keys);
      setGroupName(existingName || '');
      setGroupDialogOpen(true);
    },
    [nodes, nodesByKey, selectedKeys]
  );

  const confirmGroupDialog = useCallback(() => {
    const name = groupName.trim();
    if (!name) {
      toast.error('Enter a group name');
      return;
    }
    const keys = pendingGroupKeys.length ? pendingGroupKeys : selectedKeys;
    if (keys.length < 2 || !areSiblingKeys(nodes, keys)) {
      toast.error('Select two or more sibling nodes');
      setGroupDialogOpen(false);
      return;
    }
    onChange(groupSiblingNodes(nodes, keys, name));
    setGroupDialogOpen(false);
    setPendingGroupKeys([]);
    setLayoutNonce((n) => n + 1);
    toast.success(`Grouped as “${name}”`);
  }, [groupName, nodes, onChange, pendingGroupKeys, selectedKeys]);

  const handleUngroupSiblings = useCallback(
    (groupId?: string) => {
      if (groupId) {
        onChange(ungroupSiblingNodes(nodes, { groupId }));
        setLayoutNonce((n) => n + 1);
        toast.success('Ungrouped — nodes kept in the configuration');
        return;
      }
      // Selection: remove only those nodes from their groups (not from config).
      const keysInGroup = selectedKeys.filter((key) =>
        Boolean(nodesByKey.get(key)?.sibling_group_id?.trim())
      );
      if (!keysInGroup.length) {
        toast.error('Selected nodes are not in a group');
        return;
      }
      onChange(
        pruneUndersizedSiblingGroups(
          ungroupSiblingNodes(nodes, { keys: keysInGroup })
        )
      );
      setLayoutNonce((n) => n + 1);
      toast.success('Removed from group (still in configuration)');
    },
    [nodes, nodesByKey, onChange, selectedKeys]
  );

  const openEditGroupDialog = useCallback(
    (groupId: string) => {
      const members = siblingGroupMembers(nodes, groupId);
      if (members.length < 2) {
        toast.error('Group not found');
        return;
      }
      const name =
        members.find((m) => m.sibling_group_name?.trim())?.sibling_group_name?.trim() ||
        members[0].name.trim() ||
        'Group';
      setEditGroupId(groupId);
      setEditGroupName(name);
      setEditGroupQuantity(members.length);
    },
    [nodes]
  );

  const confirmEditGroupDialog = useCallback(() => {
    if (!editGroupId) return;
    const name = editGroupName.trim();
    if (!name) {
      toast.error('Enter a group name');
      return;
    }
    const qty = Math.min(
      MAX_NODE_QUANTITY,
      Math.max(1, Math.floor(Number(editGroupQuantity) || 1))
    );
    let next = renameSiblingGroup(nodes, editGroupId, name);
    next = setSiblingGroupQuantity(next, editGroupId, qty);
    onChange(syncInventorySources(next));
    setEditGroupId(null);
    setLayoutNonce((n) => n + 1);
    if (qty < 2) {
      toast.success('Group dissolved — nodes kept in the configuration');
    } else {
      toast.success(`Group updated · ${qty} nodes`);
    }
  }, [editGroupId, editGroupName, editGroupQuantity, nodes, onChange]);

  const handlePairSiblingNodes = useCallback(
    (draggedKey: string, targetKey: string) => {
      if (draggedKey === targetKey) return;
      const dragged = nodesByKey.get(draggedKey);
      const target = nodesByKey.get(targetKey);
      if (!dragged || !target) return;
      if (
        (dragged.parent_client_key ?? null) !== (target.parent_client_key ?? null)
      ) {
        toast.error('Only siblings under the same parent can be grouped');
        return;
      }
      if (dragged.level === 'system' || target.level === 'system') {
        toast.error('System nodes cannot be grouped');
        return;
      }

      const draggedGroup = dragged.sibling_group_id?.trim() || null;
      const targetGroup = target.sibling_group_id?.trim() || null;

      // Already together in the same group — nothing to do.
      if (draggedGroup && targetGroup && draggedGroup === targetGroup) return;

      // Target already grouped → add dragged into that group.
      if (targetGroup) {
        onChange(
          syncInventorySources(
            pruneUndersizedSiblingGroups(
              addNodesToSiblingGroup(nodes, targetGroup, [draggedKey])
            )
          )
        );
        setLayoutNonce((n) => n + 1);
        toast.success('Added to group');
        return;
      }

      // Dragged already grouped → add target into that group.
      if (draggedGroup) {
        onChange(
          syncInventorySources(
            pruneUndersizedSiblingGroups(
              addNodesToSiblingGroup(nodes, draggedGroup, [targetKey])
            )
          )
        );
        setLayoutNonce((n) => n + 1);
        toast.success('Added to group');
        return;
      }

      // Both ungrouped → create a new sibling group.
      const sameName =
        dragged.name.trim().toLowerCase() === target.name.trim().toLowerCase();
      const groupName = sameName
        ? pluralizeEntityName(dragged.name.trim() || target.name.trim())
        : `${dragged.name.trim() || 'Node'} & ${target.name.trim() || 'Node'}`;
      onChange(
        syncInventorySources(
          groupSiblingNodes(nodes, [draggedKey, targetKey], groupName)
        )
      );
      setLayoutNonce((n) => n + 1);
      toast.success(`Grouped as “${groupName}”`);
    },
    [nodes, nodesByKey, onChange]
  );

  const handleApplyGroupMembership = useCallback(
    (input: { nodeKey: string; targetGroupId: string | null }) => {
      const node = nodesByKey.get(input.nodeKey);
      if (!node) return;
      const currentGroupId = node.sibling_group_id?.trim() || null;
      const targetGroupId = input.targetGroupId?.trim() || null;
      if (currentGroupId === targetGroupId) return;

      if (targetGroupId) {
        const members = siblingGroupMembers(nodes, targetGroupId);
        if (members.length < 2) {
          toast.error('Drop target is not a valid group');
          return;
        }
        const parent = members[0].parent_client_key ?? null;
        if ((node.parent_client_key ?? null) !== parent) {
          toast.error('Only siblings under the same parent can join this group');
          return;
        }
        onChange(
          syncInventorySources(
            pruneUndersizedSiblingGroups(
              addNodesToSiblingGroup(nodes, targetGroupId, [input.nodeKey])
            )
          )
        );
        setLayoutNonce((n) => n + 1);
        toast.success(
          currentGroupId ? 'Moved to group' : 'Added to group'
        );
        return;
      }

      if (!currentGroupId) return;
      onChange(
        syncInventorySources(
          pruneUndersizedSiblingGroups(
            ungroupSiblingNodes(nodes, { keys: [input.nodeKey] })
          )
        )
      );
      setLayoutNonce((n) => n + 1);
      toast.success('Removed from group (still in configuration)');
    },
    [nodes, nodesByKey, onChange]
  );

  const handleApplyGroupNesting = useCallback(
    (input: { childGroupId: string; parentGroupId: string | null }) => {
      const childId = input.childGroupId.trim();
      const parentId = input.parentGroupId?.trim() || null;
      if (!childId) return;
      const childMembers = siblingGroupMembers(nodes, childId);
      if (childMembers.length < 2) {
        toast.error('Dragged group is not valid');
        return;
      }
      const currentParent = siblingGroupParentId(nodes, childId);
      if (currentParent === parentId) return;

      if (parentId) {
        if (wouldCreateGroupNestCycle(nodes, childId, parentId)) {
          toast.error('Cannot nest a group inside its own descendant');
          return;
        }
        const parentMembers = siblingGroupMembers(nodes, parentId);
        if (parentMembers.length < 2) {
          toast.error('Drop target is not a valid group');
          return;
        }
        if (
          (childMembers[0].parent_client_key ?? null) !==
          (parentMembers[0].parent_client_key ?? null)
        ) {
          toast.error('Only same-tier sibling groups can be nested');
          return;
        }
        onChange(nestSiblingGroup(nodes, childId, parentId));
        setLayoutNonce((n) => n + 1);
        toast.success('Group nested inside another group');
        return;
      }

      onChange(nestSiblingGroup(nodes, childId, null));
      setLayoutNonce((n) => n + 1);
      toast.success('Group moved out of parent group');
    },
    [nodes, onChange]
  );

  const entityOptions = useMemo(() => {
    if (!form) return [];
    return filterTemplateNames(entityListItems, form.level);
  }, [entityListItems, form]);

  const pendingNodeCount = useMemo(() => {
    if (!form) return 0;
    return form.pendingItems.reduce(
      (sum, item) => sum + Math.max(0, Math.floor(Number(item.quantity) || 0)),
      0
    );
  }, [form]);

  const saveForm = useCallback(() => {
    if (!form) return;

    const hasChildren =
      form.level !== 'component' &&
      nodes.some((n) => n.parent_client_key === form.clientKey);
    const requested = normalizeInventorySource(form.inventory_source);
    const inventory_source = hasChildren
      ? requested
      : INVENTORY_SOURCE.TURNKEY;

    // Multi-entity create (same tier): build from the pending group panel.
    if (form.mode === 'create' && form.level !== 'system') {
      if (!form.pendingItems.length) {
        toast.error('Add at least one entity to the group');
        return;
      }
      const needsSubgroups = form.pendingItems.length > 1;
      const invalid = form.pendingItems.some(
        (item) =>
          !item.name.trim() ||
          item.quantity < 1 ||
          item.quantity > MAX_NODE_QUANTITY ||
          (needsSubgroups &&
            item.quantity > 1 &&
            !(item.subgroupName.trim() || item.name.trim()))
      );
      if (invalid) {
        toast.error(
          needsSubgroups
            ? 'Each item needs a valid quantity; lines with quantity > 1 need a subgroup name'
            : 'Each group item needs a valid quantity (1–100)'
        );
        return;
      }
      const total = form.pendingItems.reduce(
        (sum, item) => sum + Math.max(1, Math.floor(item.quantity) || 1),
        0
      );
      const groupLabel =
        form.groupName.trim() || form.pendingItems[0]?.name.trim() || 'Group';
      if (total > 1 && !groupLabel) {
        toast.error('Enter a group name');
        return;
      }

      const next = applyPendingSiblingAdds(
        nodes,
        form.clientKey,
        form.pendingItems.map((item) => ({
          name: item.name,
          abbreviation:
            item.abbreviation.trim() || suggestAbbreviation(item.name),
          quantity: item.quantity,
          subgroupName:
            item.subgroupName.trim() || pluralizeEntityName(item.name),
        })),
        inventory_source,
        groupLabel
      );
      onChange(syncInventorySources(next));
      setLayoutNonce((n) => n + 1);
      setForm(null);
      toast.success(
        total > 1
          ? `Added ${total} nodes as “${groupLabel}”`
          : 'Node details saved'
      );
      return;
    }

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
      syncInventorySources(
        nodes.map((n) =>
          n.client_key === form.clientKey
            ? { ...n, name, abbreviation, inventory_source }
            : n
        )
      )
    );
    setForm(null);
    toast.success(form.mode === 'create' ? 'Node details saved' : 'Node updated');
  }, [entityOptions, form, nodes, onChange]);

  const addPendingEntity = useCallback(
    (
      item: { entityId: number; name: string; abbreviation: string },
      quantity: number
    ) => {
      const qty = Math.min(
        MAX_NODE_QUANTITY,
        Math.max(1, Math.floor(Number(quantity) || 1))
      );
      setForm((prev) => {
        if (!prev || prev.mode !== 'create') return prev;
        const existing = prev.pendingItems.find(
          (p) => p.entityId === item.entityId && p.name === item.name
        );
        const nextItems = existing
          ? prev.pendingItems.map((p) =>
              p.entityId === item.entityId && p.name === item.name
                ? {
                    ...p,
                    quantity: Math.min(MAX_NODE_QUANTITY, p.quantity + qty),
                    subgroupName:
                      p.subgroupName.trim() || pluralizeEntityName(p.name),
                  }
                : p
            )
          : [
              ...prev.pendingItems,
              {
                key: newClientKey('pi'),
                entityId: item.entityId,
                name: item.name,
                abbreviation: (
                  item.abbreviation || suggestAbbreviation(item.name)
                ).toUpperCase(),
                quantity: qty,
                subgroupName: pluralizeEntityName(item.name),
              },
            ];
        const defaultGroupName =
          !prev.groupName.trim() ||
          prev.pendingItems.some((p) => p.name === prev.groupName.trim())
            ? prev.pendingItems.length === 0
              ? item.name
              : prev.groupName.trim() || item.name
            : prev.groupName;
        return {
          ...prev,
          pendingItems: nextItems,
          groupName: defaultGroupName,
          name: prev.name || item.name,
          abbreviation:
            prev.abbreviation ||
            (item.abbreviation || suggestAbbreviation(item.name)).toUpperCase(),
        };
      });
    },
    []
  );

  const formCanBuild = Boolean(
    form &&
      form.level !== 'component' &&
      nodes.some((n) => n.parent_client_key === form.clientKey)
  );

  useEffect(() => {
    if (!form) return;
    const node = nodes.find((n) => n.client_key === form.clientKey);
    if (!node) return;
    const next = normalizeInventorySource(node.inventory_source);
    setForm((prev) => {
      if (!prev || prev.inventory_source === next) return prev;
      return { ...prev, inventory_source: next };
    });
  }, [form?.clientKey, nodes]);

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
    // New configuration: collect name + description before create
    if (!configId) {
      setSaveDialogMode('create');
      setSaveName(draftName.trim());
      setSaveDescription(draftDescription.trim());
      setSaveDialogOpen(true);
      return;
    }
    void onSave();
  }, [configId, draftDescription, draftName, ensureEntitiesReady, onSave]);

  const openDuplicateDialog = useCallback(() => {
    if (!ensureEntitiesReady()) return;
    setSaveDialogMode('duplicate');
    setSaveName(suggestedDuplicateName.trim() || 'Configuration');
    setSaveDescription('');
    setSaveDialogOpen(true);
  }, [ensureEntitiesReady, suggestedDuplicateName]);

  const saveNameTaken =
    !!saveName.trim() && (isNameTaken?.(saveName.trim()) ?? false);

  const confirmSaveDialog = useCallback(async () => {
    const name = saveName.trim();
    if (!name) {
      toast.error('Configuration name is required');
      return;
    }
    if (isNameTaken?.(name)) {
      toast.error(`Configuration name “${name}” already exists`);
      return;
    }
    const description = saveDescription.trim();
    if (saveDialogMode === 'create') {
      if (!onSave) return;
      const ok = await onSave({ name, description });
      if (ok !== false) setSaveDialogOpen(false);
      return;
    }
    if (!onDuplicate) return;
    const ok = await onDuplicate({ name, description });
    if (ok !== false) setSaveDialogOpen(false);
  }, [
    isNameTaken,
    onDuplicate,
    onSave,
    saveDescription,
    saveDialogMode,
    saveName,
  ]);

  const changeDirection = useCallback((d: LayoutDirection) => {
    setDirection(d);
    setLayoutNonce((n) => n + 1);
  }, []);

  const deleteTarget = deleteKey ? nodesByKey.get(deleteKey) : null;

  const saveTitle =
    unassignedCount > 0
      ? `Assign entities to all nodes first (${unassignedCount} left)`
      : nodes.length === 0
        ? 'Add nodes first'
        : configId
          ? 'Save changes to this configuration'
          : 'Save configuration';

  const configurationTitle = configId
    ? (draftName.trim() || pdfMeta?.name?.trim() || 'Configuration')
    : 'New Configuration';

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
    pdfMeta,
    onSaveClick: onSave && !readOnly ? handleSaveClick : undefined,
    onDuplicateClick:
      onDuplicate && configId && !readOnly ? openDuplicateDialog : undefined,
    saving,
    saveDisabled: !entitiesReady || saving,
    saveTitle,
    showDuplicate: Boolean(onDuplicate && configId && !readOnly),
    duplicateDisabled: !entitiesReady || saving,
    selectedKeys,
    onSelectedKeysChange: setSelectedKeys,
    onGroupSiblings: openGroupDialog,
    onUngroupSiblings: handleUngroupSiblings,
    onEditGroup: openEditGroupDialog,
    onApplyGroupMembership: handleApplyGroupMembership,
    onApplyGroupNesting: handleApplyGroupNesting,
    onPairSiblingNodes: handlePairSiblingNodes,
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
            title={saveTitle}
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
            <div className="flex items-center justify-between gap-3 border-b border-teal-500/15 bg-gradient-to-r from-slate-100 via-teal-50/80 to-slate-100 px-4 py-2.5 dark:from-slate-900 dark:via-teal-950/50 dark:to-slate-900">
              <h2 className="truncate text-sm font-semibold tracking-tight text-slate-900 dark:text-slate-50">
                {configurationTitle}
              </h2>
              <div className="flex shrink-0 items-center gap-1.5">
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

      <Dialog open={groupDialogOpen} onOpenChange={setGroupDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Group siblings</DialogTitle>
            <DialogDescription>
              Name this group of{' '}
              {(pendingGroupKeys.length || selectedKeys.length) || 0} sibling
              nodes. Groups move together on the canvas and do not change
              hierarchy levels.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="cfg-tree-group-name">Group name</Label>
            <Input
              id="cfg-tree-group-name"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              placeholder="e.g. Power rails"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  confirmGroupDialog();
                }
              }}
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setGroupDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={confirmGroupDialog}
              disabled={!groupName.trim()}
            >
              Group
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!editGroupId}
        onOpenChange={(open) => !open && setEditGroupId(null)}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Edit group</DialogTitle>
            <DialogDescription>
              Rename this group or change how many members it holds. Lowering
              quantity removes nodes from the group only — they stay in the
              configuration. Drag siblings onto or out of the group on the
              canvas to adjust membership.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="cfg-tree-edit-group-name">Group name</Label>
              <Input
                id="cfg-tree-edit-group-name"
                value={editGroupName}
                onChange={(e) => setEditGroupName(e.target.value)}
                placeholder="Group name"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    confirmEditGroupDialog();
                  }
                }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cfg-tree-edit-group-qty">Quantity</Label>
              <Input
                id="cfg-tree-edit-group-qty"
                type="number"
                min={1}
                max={MAX_NODE_QUANTITY}
                step={1}
                value={editGroupQuantity}
                onChange={(e) => {
                  const raw = e.target.value;
                  if (raw === '') {
                    setEditGroupQuantity(0);
                    return;
                  }
                  const next = Number(raw);
                  setEditGroupQuantity(Number.isNaN(next) ? 0 : next);
                }}
              />
              <p className="text-xs text-muted-foreground">
                Increase adds copies of the first member. Decrease ungroups
                excess members (does not delete them). Set to 1 to dissolve the
                group.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setEditGroupId(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={confirmEditGroupDialog}
              disabled={
                !editGroupName.trim() ||
                editGroupQuantity < 1 ||
                editGroupQuantity > MAX_NODE_QUANTITY
              }
            >
              <Pencil className="mr-1.5 h-4 w-4" />
              Save group
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {saveDialogMode === 'create'
                ? 'Save configuration'
                : 'Duplicate configuration'}
            </DialogTitle>
            <DialogDescription>
              {saveDialogMode === 'create'
                ? 'Enter a unique name and optional description for this hierarchy template.'
                : 'Create a copy of this hierarchy template under a new name. The copy will be marked available for HM selection.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="cfg-tree-save-name">
                {saveDialogMode === 'create'
                  ? 'Configuration name'
                  : 'New configuration name'}
              </Label>
              <Input
                id="cfg-tree-save-name"
                value={saveName}
                onChange={(e) => setSaveName(e.target.value)}
                placeholder="e.g. High Data Rate Standard"
                autoFocus
                aria-invalid={saveNameTaken}
              />
              {saveNameTaken ? (
                <p className="text-xs text-destructive">
                  Another configuration already uses this name.
                </p>
              ) : null}
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
                onClick={() => void confirmSaveDialog()}
                disabled={saving || !saveName.trim() || saveNameTaken}
              >
                {saveDialogMode === 'create' ? (
                  <Save className="mr-1.5 h-4 w-4" />
                ) : (
                  <Copy className="mr-1.5 h-4 w-4" />
                )}
                {saving
                  ? 'Saving…'
                  : saveDialogMode === 'create'
                    ? 'Save'
                    : 'Duplicate'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!form} onOpenChange={(open) => !open && setForm(null)}>
        <DialogContent
          className={cn(
            'flex max-h-[85vh] w-full max-w-[calc(100%-2rem)] flex-col gap-0 overflow-hidden p-0',
            form?.mode === 'create' && form.level !== 'system'
              ? 'h-[min(85vh,44rem)] sm:max-w-4xl'
              : 'h-[min(85vh,42rem)] sm:max-w-lg'
          )}
        >
          <DialogHeader className="shrink-0 space-y-1 border-b px-6 py-4 pr-12">
            <DialogTitle>
              {form?.mode === 'create' ? 'Add hierarchy node' : 'Edit hierarchy node'}
            </DialogTitle>
            <DialogDescription>
              {form?.mode === 'create' && form.level !== 'system'
                ? `Hover an entity to set quantity (default 1), then use the arrow to add it to the group. Same-tier entities only (${levelLabel(form.level)}).`
                : form
                  ? `Expand ${levelLabel(form.level)} and pick an entity. Press Ctrl+S or Save.`
                  : null}
            </DialogDescription>
          </DialogHeader>
          {form ? (
            <>
              <div className="flex shrink-0 flex-col gap-3 border-b px-6 py-3">
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground">Level</span>
                  <span className="rounded-full border bg-muted/40 px-2.5 py-0.5 font-medium">
                    {levelLabel(form.level)}
                  </span>
                </div>
                <div className="space-y-1.5">
                  <Label>Inventory source</Label>
                  <InventorySourceToggle
                    size="dialog"
                    value={form.inventory_source}
                    canBuild={formCanBuild}
                    onChange={(source) => {
                      setForm((prev) =>
                        prev ? { ...prev, inventory_source: source } : prev
                      );
                    }}
                    onDenied={(_, reason) => toast.error(reason)}
                  />
                  <p className="text-xs text-muted-foreground">
                    {formCanBuild
                      ? 'Turnkey reserves from stock. Build creates inventory when children are verified. Group is logical only and becomes install verified when all children are verified.'
                      : 'No children — Turnkey only. Add children to enable Build or Group.'}
                  </p>
                </div>
              </div>

              {form.mode === 'create' && form.level !== 'system' ? (
                <div className="grid min-h-0 flex-1 grid-cols-1 gap-0 overflow-hidden md:grid-cols-2">
                  <div className="flex min-h-0 flex-col gap-2 border-b px-4 py-3 md:border-b-0 md:border-r">
                    <Label className="shrink-0">Entity list</Label>
                    <ConfigEntityTypeTree
                      className="min-h-0 flex-1 overflow-hidden"
                      entities={entityListItems}
                      levelLabel={levelLabel}
                      selectableLevel={form.level}
                      defaultExpandedLevels={[form.level]}
                      maxQuantity={MAX_NODE_QUANTITY}
                      onAddEntity={(item, quantity) =>
                        addPendingEntity(
                          {
                            entityId: item.entityId,
                            name: item.name,
                            abbreviation: item.abbreviation,
                          },
                          quantity
                        )
                      }
                    />
                  </div>
                  <div className="flex min-h-0 flex-col gap-3 px-4 py-3">
                    <div className="flex shrink-0 items-center justify-between gap-2">
                      <Label>Group being created</Label>
                      <span className="text-xs tabular-nums text-muted-foreground">
                        {pendingNodeCount} node{pendingNodeCount === 1 ? '' : 's'}
                      </span>
                    </div>
                    <div className="min-h-0 flex-1 overflow-auto rounded-2xl border bg-muted/15 p-2">
                      {form.pendingItems.length === 0 ? (
                        <p className="px-2 py-6 text-center text-xs text-muted-foreground">
                          Hover an entity on the left, set quantity, and click the
                          arrow to add it here.
                        </p>
                      ) : (
                        <ul className="space-y-1.5">
                          {form.pendingItems.map((item) => {
                            const showSubgroup =
                              form.pendingItems.length > 1 && item.quantity > 1;
                            return (
                              <li
                                key={item.key}
                                className="space-y-1.5 rounded-xl border bg-background px-2.5 py-2"
                              >
                                <div className="flex items-center gap-2">
                                  <div className="min-w-0 flex-1">
                                    <div className="truncate text-sm font-medium">
                                      {item.quantity > 1
                                        ? `${item.quantity}× ${item.name}`
                                        : item.name}
                                    </div>
                                    {item.abbreviation ? (
                                      <div className="font-mono text-[10px] text-muted-foreground">
                                        {item.abbreviation}
                                      </div>
                                    ) : null}
                                  </div>
                                  <Input
                                    type="number"
                                    min={1}
                                    max={MAX_NODE_QUANTITY}
                                    step={1}
                                    aria-label={`Quantity for ${item.name}`}
                                    className="h-8 w-16 rounded-md text-center tabular-nums"
                                    value={item.quantity}
                                    onChange={(e) => {
                                      const raw = e.target.value;
                                      const next =
                                        raw === ''
                                          ? 0
                                          : Number.isNaN(Number(raw))
                                            ? 0
                                            : Number(raw);
                                      setForm((prev) =>
                                        prev
                                          ? {
                                              ...prev,
                                              pendingItems: prev.pendingItems.map(
                                                (p) =>
                                                  p.key === item.key
                                                    ? {
                                                        ...p,
                                                        quantity: next,
                                                        subgroupName:
                                                          next > 1 &&
                                                          !p.subgroupName.trim()
                                                            ? pluralizeEntityName(
                                                                p.name
                                                              )
                                                            : p.subgroupName,
                                                      }
                                                    : p
                                              ),
                                            }
                                          : prev
                                      );
                                    }}
                                  />
                                  <Button
                                    type="button"
                                    size="icon"
                                    variant="ghost"
                                    className="size-8 shrink-0 text-muted-foreground hover:text-destructive"
                                    title="Remove from group"
                                    aria-label={`Remove ${item.name} from group`}
                                    onClick={() =>
                                      setForm((prev) =>
                                        prev
                                          ? {
                                              ...prev,
                                              pendingItems:
                                                prev.pendingItems.filter(
                                                  (p) => p.key !== item.key
                                                ),
                                            }
                                          : prev
                                      )
                                    }
                                  >
                                    <Trash2 className="size-3.5" />
                                  </Button>
                                </div>
                                {showSubgroup ? (
                                  <div className="space-y-1">
                                    <Label
                                      htmlFor={`cfg-tree-sub-${item.key}`}
                                      className="text-[11px] text-muted-foreground"
                                    >
                                      Subgroup name
                                    </Label>
                                    <Input
                                      id={`cfg-tree-sub-${item.key}`}
                                      className="h-8"
                                      value={item.subgroupName}
                                      onChange={(e) =>
                                        setForm((prev) =>
                                          prev
                                            ? {
                                                ...prev,
                                                pendingItems:
                                                  prev.pendingItems.map((p) =>
                                                    p.key === item.key
                                                      ? {
                                                          ...p,
                                                          subgroupName:
                                                            e.target.value,
                                                        }
                                                      : p
                                                  ),
                                              }
                                            : prev
                                        )
                                      }
                                      placeholder={pluralizeEntityName(item.name)}
                                    />
                                  </div>
                                ) : null}
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </div>
                    {pendingNodeCount > 1 ? (
                      <div className="shrink-0 space-y-1.5">
                        <Label htmlFor="cfg-tree-node-group-name">Group name</Label>
                        <Input
                          id="cfg-tree-node-group-name"
                          value={form.groupName}
                          onChange={(e) =>
                            setForm((prev) =>
                              prev ? { ...prev, groupName: e.target.value } : prev
                            )
                          }
                          placeholder={
                            form.pendingItems[0]?.name.trim() || 'Group name'
                          }
                        />
                        {form.pendingItems.length > 1 ? (
                          <p className="text-[11px] text-muted-foreground">
                            Same-entity quantities &gt; 1 become nested subgroups;
                            quantity 1 stays a direct member.
                          </p>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : (
                <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-6 py-4">
                  <div className="flex min-h-32 flex-1 flex-col gap-2 overflow-hidden">
                    <Label className="shrink-0">Entity list</Label>
                    <ConfigEntityTypeTree
                      className="min-h-0 flex-1 overflow-hidden"
                      entities={entityListItems}
                      levelLabel={levelLabel}
                      selectableLevel={form.level}
                      selectedName={form.name || undefined}
                      defaultExpandedLevels={[form.level]}
                      onSelect={(item) => {
                        setForm((prev) =>
                          prev
                            ? {
                                ...prev,
                                name: item.name,
                                abbreviation: (
                                  item.abbreviation ||
                                  suggestAbbreviation(item.name)
                                ).toUpperCase(),
                              }
                            : prev
                        );
                      }}
                    />
                  </div>
                  <div className="shrink-0 space-y-2">
                    <Label>Abbreviation</Label>
                    <Input
                      className="rounded-full font-mono uppercase"
                      value={form.abbreviation}
                      onChange={(e) =>
                        setForm((prev) =>
                          prev
                            ? { ...prev, abbreviation: e.target.value.toUpperCase() }
                            : prev
                        )
                      }
                      placeholder={suggestAbbreviation(form.name || 'XX')}
                    />
                  </div>
                </div>
              )}

              <DialogFooter className="shrink-0 border-t px-6 py-4 sm:justify-end">
                <Button type="button" variant="outline" onClick={() => setForm(null)}>
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={saveForm}
                  disabled={
                    form.mode === 'create' && form.level !== 'system'
                      ? form.pendingItems.length < 1 ||
                        pendingNodeCount < 1 ||
                        form.pendingItems.some(
                          (item) =>
                            item.quantity < 1 ||
                            item.quantity > MAX_NODE_QUANTITY ||
                            (form.pendingItems.length > 1 &&
                              item.quantity > 1 &&
                              !(
                                item.subgroupName.trim() ||
                                item.name.trim()
                              ))
                        ) ||
                        (pendingNodeCount > 1 &&
                          !(
                            form.groupName.trim() ||
                            form.pendingItems[0]?.name.trim()
                          ))
                      : !form.name.trim()
                  }
                >
                  Save
                </Button>
              </DialogFooter>
            </>
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

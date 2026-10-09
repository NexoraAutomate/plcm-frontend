import dagre from '@dagrejs/dagre';
import { Position, type Edge, type Node } from '@xyflow/react';
import { CHILD_TEMPLATE_LEVEL, type TemplateDraftNode } from '@/lib/hierarchy-config';
import { isDraftNode } from '@/lib/config-tree-draft';
import {
  DEFAULT_CONFIG_TREE_NODE_FIELD_VISIBILITY,
  type ConfigTreeNodeFieldVisibility,
} from '@/lib/config-tree-node-fields';

export type { ConfigTreeNodeFieldVisibility } from '@/lib/config-tree-node-fields';
export {
  CONFIG_TREE_FIELD_VISIBILITY_KEYS,
  DEFAULT_CONFIG_TREE_NODE_FIELD_VISIBILITY,
} from '@/lib/config-tree-node-fields';

export {
  canLinkLevels,
  childrenOf,
  descendantsOf,
  filterVisibleHierarchyNodes,
  hasSystemNode,
  isDraftNode,
  isEntityAssigned,
  isHierarchyFullyExpanded,
  parentKeysWithChildren,
  siblingsOf,
} from '@/lib/config-tree-draft';

export const DEFAULT_NODE_WIDTH = 176;
export const DEFAULT_NODE_HEIGHT = 74;
export const H_GAP = 48;
export const V_GAP = 24;

export type LayoutDirection = 'LR' | 'TB';

export function layoutHandleIds(direction: LayoutDirection): {
  sourceHandle: string;
  targetHandle: string;
  sourcePosition: Position;
  targetPosition: Position;
} {
  if (direction === 'TB') {
    return {
      sourceHandle: 'source-bottom',
      targetHandle: 'target-top',
      sourcePosition: Position.Bottom,
      targetPosition: Position.Top,
    };
  }
  return {
    sourceHandle: 'source-right',
    targetHandle: 'target-left',
    sourcePosition: Position.Right,
    targetPosition: Position.Left,
  };
}

export type ConfigTreeNodeData = {
  draft: TemplateDraftNode;
  label: string;
  levelLabel: string;
  isDraft: boolean;
  locked: boolean;
  readOnly: boolean;
  canAddChild: boolean;
  canBuildFromChildren: boolean;
  /** True when this node has at least one direct child in the full draft. */
  hasChildren: boolean;
  /** Whether immediate children are currently expanded (ignored when full hierarchy). */
  childrenExpanded: boolean;
  fieldVisibility: ConfigTreeNodeFieldVisibility;
  layoutDirection: LayoutDirection;
  intersecting?: boolean;
  toBeDeleted?: boolean;
};

export type ConfigTreeEdgeData = {
  toBeDeleted?: boolean;
};

/** Dagre layout positions for draft hierarchy (https://reactflow.dev/examples/layout/dagre). */
export function layoutWithDagre(
  nodes: TemplateDraftNode[],
  direction: LayoutDirection,
  sizeById?: Map<string, { width: number; height: number }>
): Map<string, { x: number; y: number }> {
  const g = new dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}));
  g.setGraph({
    rankdir: direction,
    nodesep: direction === 'LR' ? V_GAP : H_GAP,
    ranksep: direction === 'LR' ? H_GAP : V_GAP,
    marginx: 24,
    marginy: 24,
  });

  for (const node of nodes) {
    const size = sizeById?.get(node.client_key);
    g.setNode(node.client_key, {
      width: size?.width ?? DEFAULT_NODE_WIDTH,
      height: size?.height ?? DEFAULT_NODE_HEIGHT,
    });
  }

  for (const node of nodes) {
    if (node.parent_client_key) {
      g.setEdge(node.parent_client_key, node.client_key);
    }
  }

  dagre.layout(g);

  const positions = new Map<string, { x: number; y: number }>();
  for (const node of nodes) {
    const laid = g.node(node.client_key);
    const size = sizeById?.get(node.client_key);
    const w = size?.width ?? DEFAULT_NODE_WIDTH;
    const h = size?.height ?? DEFAULT_NODE_HEIGHT;
    if (!laid) {
      positions.set(node.client_key, { x: 0, y: 0 });
      continue;
    }
    // Dagre returns center; React Flow uses top-left
    positions.set(node.client_key, {
      x: laid.x - w / 2,
      y: laid.y - h / 2,
    });
  }
  return positions;
}

/** Build edges from parent_client_key; positions come from layout or previous map. */
export function buildGraphFromDraft(input: {
  nodes: TemplateDraftNode[];
  levelLabel: (level: string) => string;
  locked: boolean;
  readOnly: boolean;
  direction: LayoutDirection;
  sizeById?: Map<string, { width: number; height: number }>;
  positionById?: Map<string, { x: number; y: number }>;
  applyAutoLayout: boolean;
  /** Parents that have children in the full (unfiltered) draft. */
  parentsWithChildren?: ReadonlySet<string>;
  /** Nodes whose immediate children are expanded. */
  expandedKeys?: ReadonlySet<string>;
  fieldVisibility?: ConfigTreeNodeFieldVisibility;
}): { flowNodes: Node<ConfigTreeNodeData>[]; edges: Edge<ConfigTreeEdgeData>[] } {
  const {
    nodes,
    levelLabel,
    locked,
    readOnly,
    direction,
    sizeById,
    positionById,
    applyAutoLayout,
    parentsWithChildren,
    expandedKeys,
    fieldVisibility = DEFAULT_CONFIG_TREE_NODE_FIELD_VISIBILITY,
  } = input;

  const positions =
    applyAutoLayout || !positionById?.size
      ? layoutWithDagre(nodes, direction, sizeById)
      : (() => {
          const map = new Map<string, { x: number; y: number }>();
          for (const node of nodes) {
            const prev = positionById.get(node.client_key);
            map.set(
              node.client_key,
              prev ?? {
                x: 0,
                y: nodes.indexOf(node) * (DEFAULT_NODE_HEIGHT + V_GAP),
              }
            );
          }
          return map;
        })();

  const parentsFromVisible = new Set<string>();
  for (const node of nodes) {
    if (node.parent_client_key) parentsFromVisible.add(node.parent_client_key);
  }
  const parentsWithKids = parentsWithChildren ?? parentsFromVisible;

  const handles = layoutHandleIds(direction);
  const flowNodes: Node<ConfigTreeNodeData>[] = nodes.map((node) => {
    const size = sizeById?.get(node.client_key);
    const pos = positions.get(node.client_key) ?? { x: 0, y: 0 };
    const hasChildren = parentsWithKids.has(node.client_key);
    return {
      id: node.client_key,
      type: 'configTree',
      position: pos,
      style: {
        width: size?.width ?? DEFAULT_NODE_WIDTH,
        height: size?.height ?? DEFAULT_NODE_HEIGHT,
        overflow: 'visible',
      },
      data: {
        draft: node,
        label: node.name || `New ${levelLabel(node.level)}`,
        levelLabel: levelLabel(node.level),
        isDraft: isDraftNode(node),
        locked,
        readOnly,
        canAddChild: !!CHILD_TEMPLATE_LEVEL[node.level],
        canBuildFromChildren: node.level !== 'component' && hasChildren,
        hasChildren,
        childrenExpanded: hasChildren && (expandedKeys?.has(node.client_key) ?? false),
        fieldVisibility,
        layoutDirection: direction,
      },
      sourcePosition: handles.sourcePosition,
      targetPosition: handles.targetPosition,
      draggable: !locked && !readOnly,
      connectable: !locked && !readOnly,
      deletable: !locked && !readOnly,
    };
  });

  const edges: Edge<ConfigTreeEdgeData>[] = [];
  for (const node of nodes) {
    if (!node.parent_client_key) continue;
    edges.push({
      id: `e-${node.parent_client_key}-${node.client_key}`,
      source: node.parent_client_key,
      target: node.client_key,
      sourceHandle: handles.sourceHandle,
      targetHandle: handles.targetHandle,
      type: 'configAnimated',
      animated: true,
      deletable: !locked && !readOnly,
      data: {},
    });
  }

  return { flowNodes, edges };
}

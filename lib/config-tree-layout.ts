import dagre from '@dagrejs/dagre';
import { Position, type Edge, type Node } from '@xyflow/react';
import {
  CHILD_TEMPLATE_LEVEL,
  type TemplateDraftNode,
  type TemplateNodeLevel,
} from '@/lib/hierarchy-config';

export const DEFAULT_NODE_WIDTH = 168;
export const DEFAULT_NODE_HEIGHT = 52;
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
  layoutDirection: LayoutDirection;
  intersecting?: boolean;
  toBeDeleted?: boolean;
};

export type ConfigTreeEdgeData = {
  toBeDeleted?: boolean;
};

export function isDraftNode(node: TemplateDraftNode): boolean {
  return !node.name.trim() || node.name.trim().toLowerCase().startsWith('new ');
}

/** True when the node has a real Entity List assignment (not a placeholder). */
export function isEntityAssigned(node: TemplateDraftNode): boolean {
  return !isDraftNode(node);
}

export function hasSystemNode(nodes: TemplateDraftNode[]): boolean {
  return nodes.some((n) => n.level === 'system');
}

/** Assigned entity names already used as children of the same parent. */
export function usedAssignedNamesUnderParent(
  nodes: TemplateDraftNode[],
  parentKey: string | null,
  excludeClientKey?: string
): Set<string> {
  const used = new Set<string>();
  for (const n of nodes) {
    if ((n.parent_client_key ?? null) !== parentKey) continue;
    if (excludeClientKey && n.client_key === excludeClientKey) continue;
    if (!isEntityAssigned(n)) continue;
    used.add(n.name.trim().toLowerCase());
  }
  return used;
}

export function isNameTakenUnderParent(
  nodes: TemplateDraftNode[],
  parentKey: string | null,
  name: string,
  excludeClientKey?: string
): boolean {
  const needle = name.trim().toLowerCase();
  if (!needle) return false;
  return usedAssignedNamesUnderParent(nodes, parentKey, excludeClientKey).has(needle);
}

export function descendantsOf(
  nodes: TemplateDraftNode[],
  clientKey: string
): Set<string> {
  const removeKeys = new Set<string>([clientKey]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const node of nodes) {
      if (
        node.parent_client_key &&
        removeKeys.has(node.parent_client_key) &&
        !removeKeys.has(node.client_key)
      ) {
        removeKeys.add(node.client_key);
        changed = true;
      }
    }
  }
  return removeKeys;
}

export function siblingsOf(
  nodes: TemplateDraftNode[],
  parentKey: string | null
): TemplateDraftNode[] {
  return nodes
    .filter((n) => (n.parent_client_key ?? null) === parentKey)
    .slice()
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
}

export function canLinkLevels(
  parentLevel: TemplateNodeLevel,
  childLevel: TemplateNodeLevel
): boolean {
  return CHILD_TEMPLATE_LEVEL[parentLevel] === childLevel;
}

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

  const handles = layoutHandleIds(direction);
  const flowNodes: Node<ConfigTreeNodeData>[] = nodes.map((node) => {
    const size = sizeById?.get(node.client_key);
    const pos = positions.get(node.client_key) ?? { x: 0, y: 0 };
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

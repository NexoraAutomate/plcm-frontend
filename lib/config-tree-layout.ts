import dagre from '@dagrejs/dagre';
import { Position, type Edge, type Node } from '@xyflow/react';
import { CHILD_TEMPLATE_LEVEL, type TemplateDraftNode } from '@/lib/hierarchy-config';
import { isDraftNode } from '@/lib/config-tree-draft';
import {
  DEFAULT_CONFIG_TREE_NODE_FIELD_VISIBILITY,
  type ConfigTreeNodeFieldVisibility,
} from '@/lib/config-tree-node-fields';

export type SiblingGroupNodeData = {
  name: string;
  memberCount: number;
  collapsed: boolean;
  locked: boolean;
  readOnly: boolean;
  groupId: string;
  layoutDirection: LayoutDirection;
};

export type { ConfigTreeNodeFieldVisibility } from '@/lib/config-tree-node-fields';
export {
  CONFIG_TREE_FIELD_VISIBILITY_KEYS,
  DEFAULT_CONFIG_TREE_NODE_FIELD_VISIBILITY,
} from '@/lib/config-tree-node-fields';

export {
  areSiblingKeys,
  canLinkLevels,
  childrenOf,
  descendantsOf,
  filterVisibleHierarchyNodes,
  groupSiblingNodes,
  hasSystemNode,
  isDraftNode,
  isEntityAssigned,
  isHierarchyFullyExpanded,
  parentKeysWithChildren,
  pruneUndersizedSiblingGroups,
  renameSiblingGroup,
  siblingsOf,
  ungroupSiblingNodes,
} from '@/lib/config-tree-draft';

export const DEFAULT_NODE_WIDTH = 176;
export const DEFAULT_NODE_HEIGHT = 74;
export const H_GAP = 48;
export const V_GAP = 36;
/** Tight padding inside an expanded sibling group. */
export const SIBLING_GROUP_PAD_X = 12;
export const SIBLING_GROUP_PAD_Y = 10;
export const SIBLING_GROUP_LABEL_H = 28;
export const SIBLING_GROUP_MEMBER_GAP = 10;
/** Collapsed group renders as a single card. */
export const COLLAPSED_GROUP_WIDTH = DEFAULT_NODE_WIDTH;
export const COLLAPSED_GROUP_HEIGHT = DEFAULT_NODE_HEIGHT + 8;
/** Keep poison/resized dimensions from stretching dagre ranks (esp. TB). */
const MAX_NODE_WIDTH = 320;
const MAX_NODE_HEIGHT = 160;

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

export function siblingGroupFlowId(groupId: string): string {
  return `sibling-group-${groupId}`;
}

export function parseSiblingGroupFlowId(flowId: string): string | null {
  if (!flowId.startsWith('sibling-group-')) return null;
  return flowId.slice('sibling-group-'.length) || null;
}

type GroupPack = {
  groupId: string;
  name: string;
  members: TemplateDraftNode[];
  /** Local top-left of each member inside the group content box (below label). */
  localByKey: Map<string, { x: number; y: number }>;
  contentWidth: number;
  contentHeight: number;
  width: number;
  height: number;
};

function nodeSize(
  key: string,
  sizeById?: Map<string, { width: number; height: number }>
): { width: number; height: number } {
  const raw = sizeById?.get(key);
  const width = raw?.width ?? DEFAULT_NODE_WIDTH;
  const height = raw?.height ?? DEFAULT_NODE_HEIGHT;
  return {
    width: Math.min(MAX_NODE_WIDTH, Math.max(120, width)),
    height: Math.min(MAX_NODE_HEIGHT, Math.max(48, height)),
  };
}

/** Pack sibling-group members into a tight stack (cross-axis for the flow direction). */
function packSiblingGroup(
  groupId: string,
  members: TemplateDraftNode[],
  direction: LayoutDirection,
  sizeById?: Map<string, { width: number; height: number }>
): GroupPack {
  const ordered = members
    .slice()
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  const localByKey = new Map<string, { x: number; y: number }>();
  let cursor = 0;
  let contentWidth = 0;
  let contentHeight = 0;

  // LR flow → stack members vertically inside the group; TB → stack horizontally.
  const stackVertical = direction === 'LR';

  for (const member of ordered) {
    const { width, height } = nodeSize(member.client_key, sizeById);
    if (stackVertical) {
      localByKey.set(member.client_key, { x: 0, y: cursor });
      cursor += height + SIBLING_GROUP_MEMBER_GAP;
      contentWidth = Math.max(contentWidth, width);
      contentHeight = cursor - SIBLING_GROUP_MEMBER_GAP;
    } else {
      localByKey.set(member.client_key, { x: cursor, y: 0 });
      cursor += width + SIBLING_GROUP_MEMBER_GAP;
      contentWidth = cursor - SIBLING_GROUP_MEMBER_GAP;
      contentHeight = Math.max(contentHeight, height);
    }
  }

  const name =
    ordered.find((m) => m.sibling_group_name?.trim())?.sibling_group_name?.trim() ||
    'Group';

  return {
    groupId,
    name,
    members: ordered,
    localByKey,
    contentWidth,
    contentHeight,
    width: contentWidth + SIBLING_GROUP_PAD_X * 2,
    height: contentHeight + SIBLING_GROUP_PAD_Y * 2 + SIBLING_GROUP_LABEL_H,
  };
}

function collectGroupPacks(
  nodes: TemplateDraftNode[],
  direction: LayoutDirection,
  sizeById?: Map<string, { width: number; height: number }>
): Map<string, GroupPack> {
  const byGroup = new Map<string, TemplateDraftNode[]>();
  for (const node of nodes) {
    const gid = node.sibling_group_id?.trim();
    if (!gid) continue;
    const list = byGroup.get(gid) ?? [];
    list.push(node);
    byGroup.set(gid, list);
  }
  const packs = new Map<string, GroupPack>();
  for (const [gid, members] of byGroup) {
    if (members.length < 2) continue;
    packs.set(gid, packSiblingGroup(gid, members, direction, sizeById));
  }
  return packs;
}

/**
 * Group-aware dagre layout: each sibling group is one supernode so external
 * nodes cannot intersect the group, and members pack tightly inside.
 * @see https://reactflow.dev/examples/layout/auto-layout
 */
export function layoutWithDagre(
  nodes: TemplateDraftNode[],
  direction: LayoutDirection,
  sizeById?: Map<string, { width: number; height: number }>,
  collapsedGroupIds?: ReadonlySet<string>
): Map<string, { x: number; y: number }> {
  const packs = collectGroupPacks(nodes, direction, sizeById);
  const memberToGroup = new Map<string, string>();
  for (const [gid, pack] of packs) {
    for (const m of pack.members) memberToGroup.set(m.client_key, gid);
  }

  const g = new dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}));
  // TB: nodesep = horizontal gap at a rank; ranksep = vertical gap between ranks.
  // LR: nodesep = vertical gap; ranksep = horizontal gap between ranks.
  g.setGraph({
    rankdir: direction,
    nodesep: direction === 'TB' ? H_GAP : V_GAP,
    ranksep: direction === 'TB' ? V_GAP + 12 : H_GAP,
    marginx: 24,
    marginy: 24,
  });

  const dagreIdFor = (clientKey: string): string => {
    const gid = memberToGroup.get(clientKey);
    return gid ? siblingGroupFlowId(gid) : clientKey;
  };

  // Supernodes for groups
  for (const [gid, pack] of packs) {
    const collapsed = collapsedGroupIds?.has(gid);
    g.setNode(siblingGroupFlowId(gid), {
      width: collapsed ? COLLAPSED_GROUP_WIDTH : pack.width,
      height: collapsed ? COLLAPSED_GROUP_HEIGHT : pack.height,
    });
  }

  // Ungrouped nodes
  for (const node of nodes) {
    if (memberToGroup.has(node.client_key)) continue;
    const size = nodeSize(node.client_key, sizeById);
    g.setNode(node.client_key, { width: size.width, height: size.height });
  }

  // Edges (dedupe when many members share a parent → one edge into the group)
  const edgeKeys = new Set<string>();
  for (const node of nodes) {
    if (!node.parent_client_key) continue;
    const source = dagreIdFor(node.parent_client_key);
    const target = dagreIdFor(node.client_key);
    if (source === target) continue;
    const key = `${source}->${target}`;
    if (edgeKeys.has(key)) continue;
    edgeKeys.add(key);
    g.setEdge(source, target);
  }

  dagre.layout(g);

  const positions = new Map<string, { x: number; y: number }>();

  // Place ungrouped nodes
  for (const node of nodes) {
    if (memberToGroup.has(node.client_key)) continue;
    const laid = g.node(node.client_key);
    const size = nodeSize(node.client_key, sizeById);
    if (!laid) {
      positions.set(node.client_key, { x: 0, y: 0 });
      continue;
    }
    positions.set(node.client_key, {
      x: laid.x - size.width / 2,
      y: laid.y - size.height / 2,
    });
  }

  // Place group members from supernode + local pack (absolute coords)
  for (const [gid, pack] of packs) {
    const laid = g.node(siblingGroupFlowId(gid));
    const collapsed = collapsedGroupIds?.has(gid);
    const gw = collapsed ? COLLAPSED_GROUP_WIDTH : pack.width;
    const gh = collapsed ? COLLAPSED_GROUP_HEIGHT : pack.height;
    const groupX = laid ? laid.x - gw / 2 : 0;
    const groupY = laid ? laid.y - gh / 2 : 0;
    // Store group origin under a synthetic key for buildGraph (optional)
    positions.set(siblingGroupFlowId(gid), { x: groupX, y: groupY });

    for (const member of pack.members) {
      const local = pack.localByKey.get(member.client_key) ?? { x: 0, y: 0 };
      positions.set(member.client_key, {
        x: groupX + SIBLING_GROUP_PAD_X + local.x,
        y: groupY + SIBLING_GROUP_PAD_Y + SIBLING_GROUP_LABEL_H + local.y,
      });
    }
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
  /** Sibling groups shown as a single card. */
  collapsedGroupIds?: ReadonlySet<string>;
}): {
  flowNodes: Array<Node<ConfigTreeNodeData> | Node<SiblingGroupNodeData>>;
  edges: Edge<ConfigTreeEdgeData>[];
} {
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
    collapsedGroupIds = new Set<string>(),
  } = input;

  const packs = collectGroupPacks(nodes, direction, sizeById);
  const memberToGroup = new Map<string, string>();
  for (const [gid, pack] of packs) {
    for (const m of pack.members) memberToGroup.set(m.client_key, gid);
  }

  const positions =
    applyAutoLayout || !positionById?.size
      ? layoutWithDagre(nodes, direction, sizeById, collapsedGroupIds)
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
          // Re-derive group origins from members when not auto-laying out
          for (const [gid, pack] of packs) {
            const abs = pack.members
              .map((m) => map.get(m.client_key))
              .filter(Boolean) as Array<{ x: number; y: number }>;
            if (!abs.length) continue;
            const minX = Math.min(...abs.map((p) => p.x));
            const minY = Math.min(...abs.map((p) => p.y));
            map.set(siblingGroupFlowId(gid), {
              x: minX - SIBLING_GROUP_PAD_X,
              y: minY - SIBLING_GROUP_PAD_Y - SIBLING_GROUP_LABEL_H,
            });
          }
          return map;
        })();

  const parentsFromVisible = new Set<string>();
  for (const node of nodes) {
    if (node.parent_client_key) parentsFromVisible.add(node.parent_client_key);
  }
  const parentsWithKids = parentsWithChildren ?? parentsFromVisible;
  const handles = layoutHandleIds(direction);

  const groupNodes: Node<SiblingGroupNodeData>[] = [];
  for (const [gid, pack] of packs) {
    const collapsed = collapsedGroupIds.has(gid);
    const origin =
      positions.get(siblingGroupFlowId(gid)) ??
      ({ x: 0, y: 0 } as { x: number; y: number });
    const gw = collapsed ? COLLAPSED_GROUP_WIDTH : pack.width;
    const gh = collapsed ? COLLAPSED_GROUP_HEIGHT : pack.height;
    groupNodes.push({
      id: siblingGroupFlowId(gid),
      type: 'siblingGroup',
      position: origin,
      data: {
        name: pack.name,
        memberCount: pack.members.length,
        collapsed,
        locked,
        readOnly,
        groupId: gid,
        layoutDirection: direction,
      },
      width: gw,
      height: gh,
      style: {
        width: gw,
        height: gh,
      },
      sourcePosition: handles.sourcePosition,
      targetPosition: handles.targetPosition,
      selectable: true,
      draggable: !locked && !readOnly,
      connectable: collapsed && !locked && !readOnly,
      deletable: false,
    });
  }

  const hiddenMemberKeys = new Set<string>();
  for (const [gid, pack] of packs) {
    if (!collapsedGroupIds.has(gid)) continue;
    for (const m of pack.members) hiddenMemberKeys.add(m.client_key);
  }

  const treeNodes: Node<ConfigTreeNodeData>[] = nodes
    .filter((node) => !hiddenMemberKeys.has(node.client_key))
    .map((node) => {
      const size = nodeSize(node.client_key, sizeById);
      const abs = positions.get(node.client_key) ?? { x: 0, y: 0 };
      const hasChildren = parentsWithKids.has(node.client_key);
      const gid = memberToGroup.get(node.client_key);
      const pack = gid ? packs.get(gid) : undefined;
      const collapsed = gid ? collapsedGroupIds.has(gid) : false;
      const parentId =
        gid && pack && !collapsed ? siblingGroupFlowId(gid) : undefined;
      // Always use packed local coords inside groups — never abs-origin deltas
      // (those inflate the parent when TB layout drifts).
      const local = pack?.localByKey.get(node.client_key);
      const position = parentId && local
        ? {
            x: SIBLING_GROUP_PAD_X + local.x,
            y: SIBLING_GROUP_PAD_Y + SIBLING_GROUP_LABEL_H + local.y,
          }
        : abs;

      return {
        id: node.client_key,
        type: 'configTree' as const,
        position,
        parentId,
        // Fixed parent size from pack; do not let RF expand the group to fit children.
        expandParent: false,
        style: {
          width: size.width,
          height: size.height,
          overflow: 'visible' as const,
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
          childrenExpanded:
            hasChildren && (expandedKeys?.has(node.client_key) ?? false),
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

  // Parents before children for React Flow sub-flows.
  const flowNodes: Array<Node<ConfigTreeNodeData> | Node<SiblingGroupNodeData>> = [
    ...groupNodes,
    ...treeNodes,
  ];

  const edges: Edge<ConfigTreeEdgeData>[] = [];
  const edgeIds = new Set<string>();

  const pushEdge = (
    source: string,
    target: string,
    id: string
  ) => {
    if (source === target || edgeIds.has(id)) return;
    edgeIds.add(id);
    edges.push({
      id,
      source,
      target,
      sourceHandle: handles.sourceHandle,
      targetHandle: handles.targetHandle,
      type: 'configAnimated',
      animated: true,
      deletable: !locked && !readOnly,
      data: {},
      zIndex: 1,
    });
  };

  for (const node of nodes) {
    if (!node.parent_client_key) continue;

    const childGid = memberToGroup.get(node.client_key);
    const parentGid = memberToGroup.get(node.parent_client_key);
    const childCollapsed = childGid ? collapsedGroupIds.has(childGid) : false;
    const parentCollapsed = parentGid ? collapsedGroupIds.has(parentGid) : false;

    // Child is inside a collapsed group → one edge parent → group
    if (childGid && childCollapsed) {
      const source = parentCollapsed
        ? siblingGroupFlowId(parentGid!)
        : node.parent_client_key;
      pushEdge(
        source,
        siblingGroupFlowId(childGid),
        `e-${source}-${siblingGroupFlowId(childGid)}`
      );
      continue;
    }

    // Parent is inside a collapsed group → edge group → child
    if (parentGid && parentCollapsed) {
      pushEdge(
        siblingGroupFlowId(parentGid),
        node.client_key,
        `e-${siblingGroupFlowId(parentGid)}-${node.client_key}`
      );
      continue;
    }

    // Expanded (or ungrouped): normal parent → child edges
    if (hiddenMemberKeys.has(node.client_key)) continue;
    if (hiddenMemberKeys.has(node.parent_client_key)) continue;
    pushEdge(
      node.parent_client_key,
      node.client_key,
      `e-${node.parent_client_key}-${node.client_key}`
    );
  }

  return { flowNodes, edges };
}

/** Resolve absolute canvas position (accounts for React Flow parentId nesting). */
export function absoluteFlowPosition(
  node: { id: string; position: { x: number; y: number }; parentId?: string | null },
  byId: Map<string, { position: { x: number; y: number }; parentId?: string | null }>
): { x: number; y: number } {
  let x = node.position.x;
  let y = node.position.y;
  let parentId = node.parentId ?? null;
  const seen = new Set<string>([node.id]);
  while (parentId) {
    if (seen.has(parentId)) break;
    seen.add(parentId);
    const parent = byId.get(parentId);
    if (!parent) break;
    x += parent.position.x;
    y += parent.position.y;
    parentId = parent.parentId ?? null;
  }
  return { x, y };
}

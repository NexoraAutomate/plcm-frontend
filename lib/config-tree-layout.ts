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
  /** e.g. "2× Relay, 1× Modem" — used on collapsed cards instead of "Group · N nodes". */
  memberSummary: string;
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
  addNodesToSiblingGroup,
  applyPendingSiblingAdds,
  areSiblingKeys,
  canLinkLevels,
  childrenOf,
  descendantsOf,
  expandDraftNodeQuantity,
  filterVisibleHierarchyNodes,
  groupSiblingNodes,
  hasSystemNode,
  isDraftNode,
  isEntityAssigned,
  isHierarchyFullyExpanded,
  nestSiblingGroup,
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

/** Build "2× Relay, 1× Modem" style summary for a group (includes nested leaves). */
export function summarizeSiblingGroupMembers(
  packs: Map<string, GroupPack>,
  groupId: string
): string {
  const counts = new Map<string, number>();
  const walk = (gid: string) => {
    const pack = packs.get(gid);
    if (!pack) return;
    for (const member of pack.members) {
      const name = member.name.trim() || 'Node';
      counts.set(name, (counts.get(name) ?? 0) + 1);
    }
    for (const childId of pack.childGroupIds) walk(childId);
  };
  walk(groupId);
  return [...counts.entries()]
    .map(([name, qty]) => `${qty}× ${name}`)
    .join(', ');
}

type GroupPack = {
  groupId: string;
  name: string;
  parentGroupId: string | null;
  members: TemplateDraftNode[];
  childGroupIds: string[];
  /** Local top-left of each direct leaf member inside the group content box. */
  localByKey: Map<string, { x: number; y: number }>;
  /** Local top-left of each nested child group inside this group. */
  localByChildGroup: Map<string, { x: number; y: number }>;
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

function groupNestParentId(members: TemplateDraftNode[]): string | null {
  const parents = new Set(
    members.map((m) => m.sibling_group_parent_id?.trim() || '')
  );
  if (parents.size !== 1) return null;
  const only = [...parents][0];
  return only || null;
}

type PackUnit = {
  kind: 'node' | 'group';
  id: string;
  sort: number;
  width: number;
  height: number;
};

/** Pack a group's direct leaves + nested child packs into one frame. */
function packSiblingGroupUnits(
  groupId: string,
  members: TemplateDraftNode[],
  childPacks: GroupPack[],
  direction: LayoutDirection,
  sizeById?: Map<string, { width: number; height: number }>
): GroupPack {
  const orderedMembers = members
    .slice()
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  const units: PackUnit[] = [
    ...orderedMembers.map((m) => {
      const size = nodeSize(m.client_key, sizeById);
      return {
        kind: 'node' as const,
        id: m.client_key,
        sort: m.sort_order ?? 0,
        width: size.width,
        height: size.height,
      };
    }),
    ...childPacks.map((pack) => {
      const sort = Math.min(
        ...pack.members.map((m) => m.sort_order ?? 0),
        Number.MAX_SAFE_INTEGER
      );
      return {
        kind: 'group' as const,
        id: pack.groupId,
        sort,
        width: pack.width,
        height: pack.height,
      };
    }),
  ].sort((a, b) => a.sort - b.sort || a.id.localeCompare(b.id));

  const localByKey = new Map<string, { x: number; y: number }>();
  const localByChildGroup = new Map<string, { x: number; y: number }>();
  let cursor = 0;
  let contentWidth = 0;
  let contentHeight = 0;
  const stackVertical = direction === 'LR';

  for (const unit of units) {
    if (stackVertical) {
      const pos = { x: 0, y: cursor };
      if (unit.kind === 'node') localByKey.set(unit.id, pos);
      else localByChildGroup.set(unit.id, pos);
      cursor += unit.height + SIBLING_GROUP_MEMBER_GAP;
      contentWidth = Math.max(contentWidth, unit.width);
      contentHeight = cursor - SIBLING_GROUP_MEMBER_GAP;
    } else {
      const pos = { x: cursor, y: 0 };
      if (unit.kind === 'node') localByKey.set(unit.id, pos);
      else localByChildGroup.set(unit.id, pos);
      cursor += unit.width + SIBLING_GROUP_MEMBER_GAP;
      contentWidth = cursor - SIBLING_GROUP_MEMBER_GAP;
      contentHeight = Math.max(contentHeight, unit.height);
    }
  }

  if (!units.length) {
    contentWidth = DEFAULT_NODE_WIDTH;
    contentHeight = DEFAULT_NODE_HEIGHT;
  }

  const name =
    orderedMembers.find((m) => m.sibling_group_name?.trim())?.sibling_group_name?.trim() ||
    'Group';

  return {
    groupId,
    name,
    parentGroupId: groupNestParentId(members),
    members: orderedMembers,
    childGroupIds: childPacks.map((p) => p.groupId),
    localByKey,
    localByChildGroup,
    contentWidth,
    contentHeight,
    width: contentWidth + SIBLING_GROUP_PAD_X * 2,
    height: contentHeight + SIBLING_GROUP_PAD_Y * 2 + SIBLING_GROUP_LABEL_H,
  };
}

function collectGroupPacks(
  nodes: TemplateDraftNode[],
  direction: LayoutDirection,
  sizeById?: Map<string, { width: number; height: number }>,
  collapsedGroupIds?: ReadonlySet<string>
): Map<string, GroupPack> {
  const byGroup = new Map<string, TemplateDraftNode[]>();
  for (const node of nodes) {
    const gid = node.sibling_group_id?.trim();
    if (!gid) continue;
    const list = byGroup.get(gid) ?? [];
    list.push(node);
    byGroup.set(gid, list);
  }

  const parentByGroup = new Map<string, string | null>();
  const virtualParentName = new Map<string, string>();
  for (const [gid, members] of byGroup) {
    const parent = groupNestParentId(members);
    parentByGroup.set(gid, parent);
    if (parent && !byGroup.has(parent)) {
      const pname =
        members.find((m) => m.sibling_group_parent_name?.trim())
          ?.sibling_group_parent_name?.trim() || 'Group';
      virtualParentName.set(parent, pname);
    }
  }

  // Include virtual outer groups (parent id with no direct leaf members).
  for (const [parentId, name] of virtualParentName) {
    if (!parentByGroup.has(parentId)) {
      parentByGroup.set(parentId, null);
      byGroup.set(parentId, []); // no direct leaves
      // Stash name via a synthetic marker on an empty pack later
      void name;
    }
  }

  // Keep groups that have >= 2 slots (direct leaves + nested child groups).
  const childrenTmp = new Map<string, string[]>();
  for (const [gid, parent] of parentByGroup) {
    if (!parent || !parentByGroup.has(parent)) {
      if (parent && !parentByGroup.has(parent)) parentByGroup.set(gid, null);
      continue;
    }
    const list = childrenTmp.get(parent) ?? [];
    list.push(gid);
    childrenTmp.set(parent, list);
  }
  for (const gid of [...parentByGroup.keys()]) {
    const direct = byGroup.get(gid)?.length ?? 0;
    const nested = childrenTmp.get(gid)?.length ?? 0;
    if (direct + nested < 2 && !virtualParentName.has(gid)) {
      parentByGroup.delete(gid);
    }
  }

  const childrenByParent = new Map<string, string[]>();
  for (const [gid, parent] of parentByGroup) {
    if (!parent || !parentByGroup.has(parent)) continue;
    const list = childrenByParent.get(parent) ?? [];
    list.push(gid);
    childrenByParent.set(parent, list);
  }

  const depthOf = (gid: string): number => {
    let d = 0;
    let cur = parentByGroup.get(gid) ?? null;
    const seen = new Set<string>();
    while (cur && parentByGroup.has(cur)) {
      if (seen.has(cur)) break;
      seen.add(cur);
      d += 1;
      cur = parentByGroup.get(cur) ?? null;
    }
    return d;
  };

  const orderedIds = [...parentByGroup.keys()].sort(
    (a, b) => depthOf(b) - depthOf(a) || a.localeCompare(b)
  );

  const packs = new Map<string, GroupPack>();
  for (const gid of orderedIds) {
    const members = byGroup.get(gid) ?? [];
    const childIds = (childrenByParent.get(gid) ?? []).filter((id) =>
      packs.has(id)
    );
    const childPacks = childIds.map((id) => {
      const child = packs.get(id)!;
      if (collapsedGroupIds?.has(id)) {
        return {
          ...child,
          width: COLLAPSED_GROUP_WIDTH,
          height: COLLAPSED_GROUP_HEIGHT,
        };
      }
      return child;
    });
    const pack = packSiblingGroupUnits(
      gid,
      members,
      childPacks,
      direction,
      sizeById
    );
    if (virtualParentName.has(gid) && !members.length) {
      packs.set(gid, {
        ...pack,
        name: virtualParentName.get(gid) || pack.name,
        parentGroupId: null,
      });
    } else {
      packs.set(gid, {
        ...pack,
        parentGroupId: parentByGroup.get(gid) ?? null,
      });
    }
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
  const packs = collectGroupPacks(nodes, direction, sizeById, collapsedGroupIds);
  const memberToGroup = new Map<string, string>();
  for (const [gid, pack] of packs) {
    for (const m of pack.members) memberToGroup.set(m.client_key, gid);
  }

  /** Map a leaf (or its outermost root group) to the dagre node id. */
  const rootGroupId = (gid: string): string => {
    let cur = gid;
    const seen = new Set<string>();
    while (true) {
      if (seen.has(cur)) return cur;
      seen.add(cur);
      const parent = packs.get(cur)?.parentGroupId;
      if (!parent || !packs.has(parent)) return cur;
      cur = parent;
    }
  };

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
    if (!gid) return clientKey;
    return siblingGroupFlowId(rootGroupId(gid));
  };

  // Supernodes for root groups only (nested groups live inside parents).
  for (const [gid, pack] of packs) {
    if (pack.parentGroupId && packs.has(pack.parentGroupId)) continue;
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

  // Place root groups from dagre, then nest children relative to parents (depth order).
  const depthOf = (gid: string): number => {
    let d = 0;
    let cur = packs.get(gid)?.parentGroupId ?? null;
    const seen = new Set<string>();
    while (cur && packs.has(cur)) {
      if (seen.has(cur)) break;
      seen.add(cur);
      d += 1;
      cur = packs.get(cur)?.parentGroupId ?? null;
    }
    return d;
  };
  const orderedPackIds = [...packs.keys()].sort(
    (a, b) => depthOf(a) - depthOf(b) || a.localeCompare(b)
  );

  for (const gid of orderedPackIds) {
    const pack = packs.get(gid)!;
    const collapsed = collapsedGroupIds?.has(gid);
    const gw = collapsed ? COLLAPSED_GROUP_WIDTH : pack.width;
    const gh = collapsed ? COLLAPSED_GROUP_HEIGHT : pack.height;

    let groupX = 0;
    let groupY = 0;
    if (pack.parentGroupId && packs.has(pack.parentGroupId)) {
      const parentOrigin =
        positions.get(siblingGroupFlowId(pack.parentGroupId)) ?? { x: 0, y: 0 };
      const parentPack = packs.get(pack.parentGroupId)!;
      const local =
        parentPack.localByChildGroup.get(gid) ?? ({ x: 0, y: 0 } as const);
      groupX = parentOrigin.x + SIBLING_GROUP_PAD_X + local.x;
      groupY = parentOrigin.y + SIBLING_GROUP_PAD_Y + SIBLING_GROUP_LABEL_H + local.y;
    } else {
      const laid = g.node(siblingGroupFlowId(gid));
      groupX = laid ? laid.x - gw / 2 : 0;
      groupY = laid ? laid.y - gh / 2 : 0;
    }

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

  const packs = collectGroupPacks(
    nodes,
    direction,
    sizeById,
    collapsedGroupIds
  );
  const memberToGroup = new Map<string, string>();
  for (const [gid, pack] of packs) {
    for (const m of pack.members) memberToGroup.set(m.client_key, gid);
  }

  const isAncestorCollapsed = (gid: string): boolean => {
    let cur: string | null = gid;
    const seen = new Set<string>();
    while (cur) {
      if (seen.has(cur)) return false;
      seen.add(cur);
      if (collapsedGroupIds.has(cur)) return true;
      cur = packs.get(cur)?.parentGroupId ?? null;
    }
    return false;
  };

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

  const depthOf = (gid: string): number => {
    let d = 0;
    let cur = packs.get(gid)?.parentGroupId ?? null;
    const seen = new Set<string>();
    while (cur && packs.has(cur)) {
      if (seen.has(cur)) break;
      seen.add(cur);
      d += 1;
      cur = packs.get(cur)?.parentGroupId ?? null;
    }
    return d;
  };

  const groupNodes: Node<SiblingGroupNodeData>[] = [...packs.keys()]
    .sort((a, b) => depthOf(a) - depthOf(b) || a.localeCompare(b))
    .filter((gid) => !isAncestorCollapsed(gid) || collapsedGroupIds.has(gid))
    .filter((gid) => {
      // Hide nested group entirely when an ancestor is collapsed.
      const parent = packs.get(gid)?.parentGroupId;
      if (parent && isAncestorCollapsed(parent)) return false;
      if (parent && collapsedGroupIds.has(parent)) return false;
      return true;
    })
    .map((gid) => {
      const pack = packs.get(gid)!;
      const collapsed = collapsedGroupIds.has(gid);
      const nestedParentId =
        pack.parentGroupId && packs.has(pack.parentGroupId)
          ? siblingGroupFlowId(pack.parentGroupId)
          : undefined;
      const parentPack = pack.parentGroupId
        ? packs.get(pack.parentGroupId)
        : undefined;
      const nestedLocal = parentPack?.localByChildGroup.get(gid);
      const origin =
        nestedParentId && nestedLocal
          ? {
              x: SIBLING_GROUP_PAD_X + nestedLocal.x,
              y: SIBLING_GROUP_PAD_Y + SIBLING_GROUP_LABEL_H + nestedLocal.y,
            }
          : (positions.get(siblingGroupFlowId(gid)) ??
            ({ x: 0, y: 0 } as { x: number; y: number }));
      const gw = collapsed ? COLLAPSED_GROUP_WIDTH : pack.width;
      const gh = collapsed ? COLLAPSED_GROUP_HEIGHT : pack.height;
      return {
        id: siblingGroupFlowId(gid),
        type: 'siblingGroup' as const,
        position: origin,
        parentId: nestedParentId,
        expandParent: false,
        data: {
          name: pack.name,
          memberCount: pack.members.length + pack.childGroupIds.length,
          memberSummary:
            summarizeSiblingGroupMembers(packs, gid) ||
            `${pack.members.length + pack.childGroupIds.length} nodes`,
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
      };
    });

  const hiddenMemberKeys = new Set<string>();
  for (const [gid, pack] of packs) {
    if (!isAncestorCollapsed(gid)) continue;
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
        gid && pack && !collapsed && !isAncestorCollapsed(gid)
          ? siblingGroupFlowId(gid)
          : undefined;
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

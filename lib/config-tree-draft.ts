import {
  CHILD_TEMPLATE_LEVEL,
  newClientKey,
  type TemplateDraftNode,
  type TemplateNodeLevel,
} from '@/lib/hierarchy-config';

/** Pure draft helpers — no dagre/xyflow (safe for config list panels). */

export function isDraftNode(node: { name: string }): boolean {
  return !node.name.trim() || node.name.trim().toLowerCase().startsWith('new ');
}

/** True when the node has a real Entity List assignment (not a placeholder). */
export function isEntityAssigned(node: { name: string }): boolean {
  return !isDraftNode(node);
}

export function hasSystemNode(nodes: Array<{ level: string }>): boolean {
  return nodes.some((n) => n.level === 'system');
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

/** Immediate children only (not grandchildren). */
export function childrenOf(
  nodes: TemplateDraftNode[],
  parentKey: string
): TemplateDraftNode[] {
  return siblingsOf(nodes, parentKey);
}

/** Client keys that have at least one direct child in the full draft. */
export function parentKeysWithChildren(nodes: TemplateDraftNode[]): Set<string> {
  const keys = new Set<string>();
  for (const node of nodes) {
    if (node.parent_client_key) keys.add(node.parent_client_key);
  }
  return keys;
}

/**
 * Visible subset for expand/collapse: roots always show; a non-root node shows
 * only when every ancestor is in `expandedKeys` (immediate-children expand).
 */
export function filterVisibleHierarchyNodes(
  nodes: TemplateDraftNode[],
  expandedKeys: ReadonlySet<string>
): TemplateDraftNode[] {
  if (!nodes.length) return nodes;
  if (!expandedKeys.size) {
    return nodes.filter((n) => !n.parent_client_key);
  }

  const byKey = new Map(nodes.map((n) => [n.client_key, n]));
  return nodes.filter((node) => {
    let parentKey = node.parent_client_key;
    while (parentKey) {
      if (!expandedKeys.has(parentKey)) return false;
      parentKey = byKey.get(parentKey)?.parent_client_key ?? null;
    }
    return true;
  });
}

export function isHierarchyFullyExpanded(
  nodes: TemplateDraftNode[],
  expandedKeys: ReadonlySet<string>
): boolean {
  const parents = parentKeysWithChildren(nodes);
  if (!parents.size) return false;
  for (const key of parents) {
    if (!expandedKeys.has(key)) return false;
  }
  return true;
}

export function canLinkLevels(
  parentLevel: TemplateNodeLevel,
  childLevel: TemplateNodeLevel
): boolean {
  return CHILD_TEMPLATE_LEVEL[parentLevel] === childLevel;
}

/** True when every key refers to a draft node under the same parent. */
export function areSiblingKeys(
  nodes: TemplateDraftNode[],
  keys: readonly string[]
): boolean {
  if (keys.length < 2) return false;
  const byKey = new Map(nodes.map((n) => [n.client_key, n]));
  const first = byKey.get(keys[0]);
  if (!first) return false;
  const parent = first.parent_client_key ?? null;
  return keys.every((key) => {
    const node = byKey.get(key);
    return !!node && (node.parent_client_key ?? null) === parent;
  });
}

/** Assign selected siblings into a named group (creates a new group id). */
export function groupSiblingNodes(
  nodes: TemplateDraftNode[],
  keys: readonly string[],
  groupName: string,
  groupId = newClientKey('sg')
): TemplateDraftNode[] {
  const name = groupName.trim();
  if (!name || keys.length < 2 || !areSiblingKeys(nodes, keys)) return nodes;
  const keySet = new Set(keys);
  return nodes.map((node) =>
    keySet.has(node.client_key)
      ? {
          ...node,
          sibling_group_id: groupId,
          sibling_group_name: name,
        }
      : node
  );
}

/** Clear sibling group fields for the given keys (or whole group id). */
export function ungroupSiblingNodes(
  nodes: TemplateDraftNode[],
  opts: { keys?: readonly string[]; groupId?: string | null }
): TemplateDraftNode[] {
  const keySet = opts.keys ? new Set(opts.keys) : null;
  const groupId = opts.groupId?.trim() || null;
  return nodes.map((node) => {
    const matchKey = keySet?.has(node.client_key);
    const matchGroup = groupId && node.sibling_group_id === groupId;
    if (!matchKey && !matchGroup) return node;
    return {
      ...node,
      sibling_group_id: null,
      sibling_group_name: null,
    };
  });
}

/** Drop group membership when fewer than two members remain. */
export function pruneUndersizedSiblingGroups(
  nodes: TemplateDraftNode[]
): TemplateDraftNode[] {
  const counts = new Map<string, number>();
  for (const node of nodes) {
    const gid = node.sibling_group_id?.trim();
    if (!gid) continue;
    counts.set(gid, (counts.get(gid) ?? 0) + 1);
  }
  const drop = new Set(
    [...counts.entries()].filter(([, count]) => count < 2).map(([id]) => id)
  );
  if (!drop.size) return nodes;
  return nodes.map((node) =>
    node.sibling_group_id && drop.has(node.sibling_group_id)
      ? { ...node, sibling_group_id: null, sibling_group_name: null }
      : node
  );
}

export function renameSiblingGroup(
  nodes: TemplateDraftNode[],
  groupId: string,
  groupName: string
): TemplateDraftNode[] {
  const name = groupName.trim();
  const gid = groupId.trim();
  if (!name || !gid) return nodes;
  return nodes.map((node) =>
    node.sibling_group_id === gid
      ? { ...node, sibling_group_name: name }
      : node
  );
}

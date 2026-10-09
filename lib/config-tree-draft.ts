import {
  CHILD_TEMPLATE_LEVEL,
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

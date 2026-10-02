import {
  allowedChildLevels,
  isValidTemplateParent,
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

/** True when parentLevel may directly contain childLevel (any higher → any lower). */
export function canLinkLevels(
  parentLevel: TemplateNodeLevel,
  childLevel: TemplateNodeLevel
): boolean {
  return isValidTemplateParent(parentLevel, childLevel);
}

export function childLevelsOf(parentLevel: TemplateNodeLevel): TemplateNodeLevel[] {
  return allowedChildLevels(parentLevel);
}

import {
  CHILD_TEMPLATE_LEVEL,
  INVENTORY_SOURCE,
  newClientKey,
  type InventorySource,
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
          sibling_group_parent_id: null,
          sibling_group_parent_name: null,
        }
      : node
  );
}

/** Simple English plural for default subgroup names (e.g. Box → Boxes, Relay → Relays). */
export function pluralizeEntityName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return trimmed;
  const lower = trimmed.toLowerCase();
  if (
    lower.endsWith('s') ||
    lower.endsWith('x') ||
    lower.endsWith('z') ||
    lower.endsWith('ch') ||
    lower.endsWith('sh')
  ) {
    return `${trimmed}es`;
  }
  if (
    lower.endsWith('y') &&
    trimmed.length > 1 &&
    !/[aeiou]/i.test(trimmed.charAt(trimmed.length - 2))
  ) {
    return `${trimmed.slice(0, -1)}ies`;
  }
  return `${trimmed}s`;
}

/**
 * Fill the anchor draft node from a multi-entity pending list (each with its
 * own quantity). Total count > 1 → outer sibling group.
 *
 * When more than one pending line exists, each line with quantity > 1 becomes a
 * nested subgroup (same tier) under the outer group. Quantity 1 lines stay as
 * direct outer-group members. A single pending line never creates a subgroup —
 * only the outer group name is used.
 */
export function applyPendingSiblingAdds(
  nodes: TemplateDraftNode[],
  anchorClientKey: string,
  items: ReadonlyArray<{
    name: string;
    abbreviation: string;
    quantity: number;
    subgroupName?: string;
  }>,
  inventorySource: InventorySource,
  groupName: string
): TemplateDraftNode[] {
  const anchor = nodes.find((n) => n.client_key === anchorClientKey);
  if (!anchor || anchor.level === 'system' || items.length < 1) return nodes;

  type FlatPiece = {
    name: string;
    abbreviation: string;
    itemIndex: number;
  };
  const flat: FlatPiece[] = [];
  const normalizedItems = items
    .map((item, itemIndex) => {
      const name = item.name.trim();
      if (!name) return null;
      return {
        itemIndex,
        name,
        abbreviation: (item.abbreviation || '').trim().toUpperCase(),
        quantity: Math.max(1, Math.floor(Number(item.quantity) || 1)),
        subgroupName: (item.subgroupName || '').trim(),
      };
    })
    .filter(Boolean) as Array<{
    itemIndex: number;
    name: string;
    abbreviation: string;
    quantity: number;
    subgroupName: string;
  }>;

  for (const item of normalizedItems) {
    for (let i = 0; i < item.quantity; i++) {
      flat.push({
        name: item.name,
        abbreviation: item.abbreviation,
        itemIndex: item.itemIndex,
      });
    }
  }
  if (!flat.length) return nodes;

  const inventory_source = inventorySource || INVENTORY_SOURCE.TURNKEY;
  let next = nodes.map((n) =>
    n.client_key === anchorClientKey
      ? {
          ...n,
          name: flat[0].name,
          abbreviation: flat[0].abbreviation,
          inventory_source,
        }
      : n
  );

  if (flat.length === 1) return next;

  const label = groupName.trim() || flat[0].name;
  const parentKey = anchor.parent_client_key ?? null;
  const siblings = siblingsOf(next, parentKey);
  const primaryIdx = siblings.findIndex((s) => s.client_key === anchorClientKey);
  const insertAt = primaryIdx >= 0 ? primaryIdx + 1 : siblings.length;

  const keys = [anchorClientKey];
  const keysByItem = new Map<number, string[]>([
    [flat[0].itemIndex, [anchorClientKey]],
  ]);
  const extras: TemplateDraftNode[] = [];
  for (let i = 1; i < flat.length; i++) {
    const key = newClientKey(anchor.level.slice(0, 3));
    keys.push(key);
    const list = keysByItem.get(flat[i].itemIndex) ?? [];
    list.push(key);
    keysByItem.set(flat[i].itemIndex, list);
    extras.push({
      client_key: key,
      parent_client_key: parentKey,
      level: anchor.level,
      name: flat[i].name,
      abbreviation: flat[i].abbreviation,
      inventory_source,
      sort_order: insertAt + i - 1,
    });
  }

  const nextSiblings = siblings.map((s) =>
    s.client_key === anchorClientKey
      ? (next.find((n) => n.client_key === anchorClientKey) as TemplateDraftNode)
      : s
  );
  nextSiblings.splice(insertAt, 0, ...extras);
  const base = next.filter((n) => (n.parent_client_key ?? null) !== parentKey);
  const reindexed = nextSiblings.map((s, index) => ({ ...s, sort_order: index }));
  next = groupSiblingNodes([...base, ...reindexed], keys, label);

  // Nested subgroups only when multiple pending siblings exist.
  const needsSubgroups = normalizedItems.length > 1;
  if (!needsSubgroups) return next;

  const outerGroupId =
    next.find((n) => n.client_key === anchorClientKey)?.sibling_group_id?.trim() ||
    null;
  if (!outerGroupId) return next;

  for (const item of normalizedItems) {
    if (item.quantity < 2) continue;
    const memberKeys = keysByItem.get(item.itemIndex) ?? [];
    if (memberKeys.length < 2) continue;
    const subName = item.subgroupName || pluralizeEntityName(item.name);
    const subId = newClientKey('sg');
    next = next.map((node) =>
      memberKeys.includes(node.client_key)
        ? {
            ...node,
            sibling_group_id: subId,
            sibling_group_name: subName,
            sibling_group_parent_id: outerGroupId,
            sibling_group_parent_name: label,
          }
        : node
    );
  }

  return next;
}

/**
 * Clone `clientKey` into `quantity` sibling copies under the same parent and
 * place them in one sibling group. Quantity 1 (or system) is a no-op.
 * Primary node fields (name, abbreviation, etc.) must already be set.
 */
export function expandDraftNodeQuantity(
  nodes: TemplateDraftNode[],
  clientKey: string,
  quantity: number,
  groupName: string
): TemplateDraftNode[] {
  const qty = Math.max(1, Math.floor(Number(quantity) || 1));
  const primary = nodes.find((n) => n.client_key === clientKey);
  if (!primary || qty <= 1 || primary.level === 'system') return nodes;

  const label = groupName.trim() || primary.name.trim();
  if (!label) return nodes;

  const parentKey = primary.parent_client_key ?? null;
  const siblings = siblingsOf(nodes, parentKey);
  const primaryIdx = siblings.findIndex((s) => s.client_key === clientKey);
  const insertAt = primaryIdx >= 0 ? primaryIdx + 1 : siblings.length;

  const keys = [clientKey];
  const extras: TemplateDraftNode[] = [];
  for (let i = 1; i < qty; i++) {
    const key = newClientKey(primary.level.slice(0, 3));
    keys.push(key);
    extras.push({
      client_key: key,
      parent_client_key: parentKey,
      level: primary.level,
      name: primary.name,
      abbreviation: primary.abbreviation ?? '',
      description: primary.description ?? null,
      inventory_source: primary.inventory_source,
      sort_order: insertAt + i - 1,
    });
  }

  const nextSiblings = [...siblings];
  nextSiblings.splice(insertAt, 0, ...extras);
  const base = nodes.filter((n) => (n.parent_client_key ?? null) !== parentKey);
  const reindexed = nextSiblings.map((s, index) => ({ ...s, sort_order: index }));
  return groupSiblingNodes([...base, ...reindexed], keys, label);
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
      sibling_group_parent_id: null,
      sibling_group_parent_name: null,
    };
  });
}

/** Drop group membership when fewer than two slots remain (leaves + nested groups). */
export function pruneUndersizedSiblingGroups(
  nodes: TemplateDraftNode[]
): TemplateDraftNode[] {
  const membersByGroup = new Map<string, TemplateDraftNode[]>();
  for (const node of nodes) {
    const gid = node.sibling_group_id?.trim();
    if (!gid) continue;
    const list = membersByGroup.get(gid) ?? [];
    list.push(node);
    membersByGroup.set(gid, list);
  }

  const parentByGroup = new Map<string, string | null>();
  for (const [gid, members] of membersByGroup) {
    const parents = new Set(
      members.map((m) => m.sibling_group_parent_id?.trim() || '')
    );
    parentByGroup.set(gid, parents.size === 1 ? [...parents][0] || null : null);
  }

  const childrenByParent = new Map<string, Set<string>>();
  for (const [gid, parent] of parentByGroup) {
    if (!parent) continue;
    const set = childrenByParent.get(parent) ?? new Set<string>();
    set.add(gid);
    childrenByParent.set(parent, set);
  }

  const drop = new Set<string>();
  let changed = true;
  while (changed) {
    changed = false;
    for (const gid of membersByGroup.keys()) {
      if (drop.has(gid)) continue;
      const direct = (membersByGroup.get(gid) ?? []).length;
      const nested = [...(childrenByParent.get(gid) ?? [])].filter(
        (id) => !drop.has(id)
      ).length;
      if (direct + nested < 2) {
        drop.add(gid);
        changed = true;
      }
    }
  }
  if (!drop.size) return nodes;

  return nodes.map((node) => {
    const gid = node.sibling_group_id?.trim();
    const parentGid = node.sibling_group_parent_id?.trim();
    if (gid && drop.has(gid)) {
      return {
        ...node,
        sibling_group_id: null,
        sibling_group_name: null,
        sibling_group_parent_id: null,
        sibling_group_parent_name: null,
      };
    }
    if (parentGid && drop.has(parentGid)) {
      return {
        ...node,
        sibling_group_parent_id: null,
        sibling_group_parent_name: null,
      };
    }
    return node;
  });
}

/** Nested parent group id shared by members of `groupId` (or null). */
export function siblingGroupParentId(
  nodes: TemplateDraftNode[],
  groupId: string
): string | null {
  const members = siblingGroupMembers(nodes, groupId);
  if (!members.length) return null;
  const parents = new Set(
    members.map((m) => m.sibling_group_parent_id?.trim() || '')
  );
  if (parents.size !== 1) return null;
  const only = [...parents][0];
  return only || null;
}

/** True when nesting `childGroupId` under `parentGroupId` would create a cycle. */
export function wouldCreateGroupNestCycle(
  nodes: TemplateDraftNode[],
  childGroupId: string,
  parentGroupId: string
): boolean {
  if (childGroupId === parentGroupId) return true;
  let cur: string | null = parentGroupId;
  const seen = new Set<string>();
  while (cur) {
    if (cur === childGroupId) return true;
    if (seen.has(cur)) return true;
    seen.add(cur);
    cur = siblingGroupParentId(nodes, cur);
  }
  return false;
}

/**
 * Nest (or un-nest) an existing sibling group under another same-tier group.
 * Pass `parentGroupId = null` to move the group to the root of its tier.
 * Does not remove nodes from the configuration.
 */
export function nestSiblingGroup(
  nodes: TemplateDraftNode[],
  childGroupId: string,
  parentGroupId: string | null
): TemplateDraftNode[] {
  const childId = childGroupId.trim();
  if (!childId) return nodes;
  const members = siblingGroupMembers(nodes, childId);
  if (members.length < 2) return nodes;

  const parentId = parentGroupId?.trim() || null;
  if (parentId) {
    if (wouldCreateGroupNestCycle(nodes, childId, parentId)) return nodes;
    const parentMembers = siblingGroupMembers(nodes, parentId);
    if (parentMembers.length < 2) return nodes;
    const childParent = members[0].parent_client_key ?? null;
    const nestParent = parentMembers[0].parent_client_key ?? null;
    if (childParent !== nestParent) return nodes;
  }

  const parentName = parentId
    ? siblingGroupMembers(nodes, parentId).find((m) =>
        m.sibling_group_name?.trim()
      )?.sibling_group_name?.trim() ||
      siblingGroupMembers(nodes, parentId)[0]?.name?.trim() ||
      'Group'
    : null;

  return nodes.map((node) =>
    node.sibling_group_id?.trim() === childId
      ? {
          ...node,
          sibling_group_parent_id: parentId,
          sibling_group_parent_name: parentId ? parentName : null,
        }
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

/** Members of a sibling group, ordered by sort_order. */
export function siblingGroupMembers(
  nodes: TemplateDraftNode[],
  groupId: string
): TemplateDraftNode[] {
  const gid = groupId.trim();
  if (!gid) return [];
  return nodes
    .filter((n) => n.sibling_group_id?.trim() === gid)
    .slice()
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
}

/**
 * Add existing siblings into an existing group (same parent required).
 * Does not remove nodes from the configuration — only updates group fields.
 */
export function addNodesToSiblingGroup(
  nodes: TemplateDraftNode[],
  groupId: string,
  keys: readonly string[]
): TemplateDraftNode[] {
  const gid = groupId.trim();
  if (!gid || keys.length < 1) return nodes;
  const members = siblingGroupMembers(nodes, gid);
  if (members.length < 1) return nodes;
  const parent = members[0].parent_client_key ?? null;
  const groupName =
    members.find((m) => m.sibling_group_name?.trim())?.sibling_group_name?.trim() ||
    '';
  if (!groupName) return nodes;
  const nestParent = members[0].sibling_group_parent_id?.trim() || null;

  const byKey = new Map(nodes.map((n) => [n.client_key, n]));
  for (const key of keys) {
    const node = byKey.get(key);
    if (!node || (node.parent_client_key ?? null) !== parent) return nodes;
  }

  const keySet = new Set(keys);
  return nodes.map((node) =>
    keySet.has(node.client_key)
      ? {
          ...node,
          sibling_group_id: gid,
          sibling_group_name: groupName,
          sibling_group_parent_id: nestParent,
          sibling_group_parent_name: members[0].sibling_group_parent_name ?? null,
        }
      : node
  );
}

/**
 * Adjust how many members belong to a group.
 * - Increase: clone the first member into the group (adds to configuration).
 * - Decrease: remove excess members from the group only (nodes stay in the config).
 * Quantity under 2 dissolves the group (all members ungrouped, kept in config).
 */
export function setSiblingGroupQuantity(
  nodes: TemplateDraftNode[],
  groupId: string,
  quantity: number
): TemplateDraftNode[] {
  const gid = groupId.trim();
  const qty = Math.max(1, Math.floor(Number(quantity) || 1));
  const members = siblingGroupMembers(nodes, gid);
  if (members.length < 2) return nodes;
  if (qty === members.length) return nodes;

  const groupName =
    members.find((m) => m.sibling_group_name?.trim())?.sibling_group_name?.trim() ||
    members[0].name.trim() ||
    'Group';

  if (qty < members.length) {
    if (qty < 2) {
      return ungroupSiblingNodes(nodes, { groupId: gid });
    }
    const drop = members.slice(qty).map((m) => m.client_key);
    return pruneUndersizedSiblingGroups(
      ungroupSiblingNodes(nodes, { keys: drop })
    );
  }

  const template = members[0];
  if (template.level === 'system') return nodes;
  const need = qty - members.length;
  const parentKey = template.parent_client_key ?? null;
  const siblings = siblingsOf(nodes, parentKey);
  const lastMember = members[members.length - 1];
  const lastIdx = siblings.findIndex((s) => s.client_key === lastMember.client_key);
  const insertAt = lastIdx >= 0 ? lastIdx + 1 : siblings.length;

  const extras: TemplateDraftNode[] = [];
  for (let i = 0; i < need; i++) {
    extras.push({
      client_key: newClientKey(template.level.slice(0, 3)),
      parent_client_key: parentKey,
      level: template.level,
      name: template.name,
      abbreviation: template.abbreviation ?? '',
      description: template.description ?? null,
      inventory_source: template.inventory_source,
      sort_order: insertAt + i,
      sibling_group_id: gid,
      sibling_group_name: groupName,
      sibling_group_parent_id: template.sibling_group_parent_id ?? null,
    });
  }

  const nextSiblings = [...siblings];
  nextSiblings.splice(insertAt, 0, ...extras);
  const base = nodes.filter((n) => (n.parent_client_key ?? null) !== parentKey);
  return nextSiblings.map((s, index) => ({ ...s, sort_order: index })).concat(base);
}

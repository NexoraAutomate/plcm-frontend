import type { Edge, Node } from '@xyflow/react';
import type { EntityLookupNode, lookUpResponse } from '@/lib/models';

export const ENTITY_NODE_WIDTH = 280;
export const ENTITY_NODE_HEIGHT = 160;
const LEVEL_GAP = 200;
const SIBLING_GAP = 60;
const SPINE_CENTER_X = 400;

export const HIERARCHY_LEVELS = [
  'customer',
  'order',
  'project',
  'system',
  'subsystem',
  'module',
  'unit',
  'component',
] as const;

export type HierarchyLevel = (typeof HIERARCHY_LEVELS)[number];

export type EntityNodeRole = 'business' | 'hardware' | 'matched' | 'descendant';

export type EntityFlowFieldKey =
  | 'entity_name'
  | 'entity_type'
  | 'part_number'
  | 'serial_number'
  | 'entity_id';

export const ENTITY_FLOW_FIELD_OPTIONS: Array<{
  key: EntityFlowFieldKey;
  label: string;
}> = [
  { key: 'entity_name', label: 'Name' },
  { key: 'entity_type', label: 'Entity Type' },
  { key: 'part_number', label: 'Part Number' },
  { key: 'serial_number', label: 'Serial Number' },
  { key: 'entity_id', label: 'Entity ID' },
];

export const DEFAULT_VISIBLE_FIELDS: EntityFlowFieldKey[] = [
  'entity_name',
  'entity_type',
  'part_number',
  'serial_number',
];

export interface EntityLookupWorkflowNode {
  entity_type: string;
  entity_id: number;
  entity_name: string;
  entity_PartNumber?: string;
  entity_SerialNumber?: string;
  label?: string;
  role: EntityNodeRole;
  children: EntityLookupWorkflowNode[];
}

export interface EntityFlowNodeData extends Record<string, unknown> {
  entity_type: string;
  entity_id: number;
  entity_name: string;
  entity_PartNumber?: string;
  entity_SerialNumber?: string;
  label?: string;
  role: EntityNodeRole;
}

interface SpineEntry {
  entity_type: string;
  entity_id: number;
  entity_name: string;
  entity_PartNumber?: string;
  entity_SerialNumber?: string;
  label?: string;
  role: EntityNodeRole;
}

const BUSINESS_TYPES = new Set<HierarchyLevel>(['customer', 'order', 'project']);

export function normalizeEntityType(entityType: string): string {
  return entityType.toLowerCase().trim().replace(/\s+/g, '_');
}

export function getHierarchyLevel(entityType: string): number {
  const normalized = normalizeEntityType(entityType);
  const index = HIERARCHY_LEVELS.indexOf(normalized as HierarchyLevel);
  return index === -1 ? HIERARCHY_LEVELS.length : index;
}

export function entityNodeId(entityType: string, entityId: number) {
  return `${normalizeEntityType(entityType)}-${entityId}`;
}

export function buildTree(nodes: EntityLookupNode[]) {
  const roots: EntityLookupNode[] = [];
  const stack: EntityLookupNode[] = [];
  const processed = nodes.map((node) => ({
    ...node,
    children: [] as EntityLookupNode[],
  }));

  for (const current of processed) {
    while (
      stack.length > 0 &&
      (stack[stack.length - 1].depth ?? 0) >= (current.depth ?? 0)
    ) {
      stack.pop();
    }

    if (stack.length === 0) {
      roots.push(current);
    } else {
      stack[stack.length - 1].children.push(current);
    }

    stack.push(current);
  }

  return roots;
}

function buildSpineEntries(response: lookUpResponse): SpineEntry[] {
  const entries: SpineEntry[] = [];
  const seen = new Set<string>();

  const addEntry = (entry: SpineEntry) => {
    const key = entityNodeId(entry.entity_type, entry.entity_id);
    if (seen.has(key)) return false;
    seen.add(key);
    entries.push(entry);
    return true;
  };

  addEntry({
    entity_type: 'customer',
    entity_id: response.customer_id,
    entity_name: response.customer_name,
    role: 'business',
  });

  addEntry({
    entity_type: 'order',
    entity_id: response.order_id,
    entity_name: response.order_ref,
    role: 'business',
  });

  addEntry({
    entity_type: 'project',
    entity_id: response.project_id,
    entity_name: response.project_name,
    role: 'business',
  });

  const hardwareAncestors = (response.ancestors || [])
    .filter(
      (ancestor) => !BUSINESS_TYPES.has(normalizeEntityType(ancestor.entity_type) as HierarchyLevel)
    )
    .sort(
      (a, b) =>
        getHierarchyLevel(a.entity_type) - getHierarchyLevel(b.entity_type) ||
        a.entity_id - b.entity_id
    );

  for (const ancestor of hardwareAncestors) {
    addEntry({
      entity_type: ancestor.entity_type,
      entity_id: ancestor.entity_id,
      entity_name: ancestor.entity_name || ancestor.label,
      entity_PartNumber: ancestor.entity_PartNumber,
      entity_SerialNumber: ancestor.entity_SerialNumber,
      label: ancestor.label,
      role: 'hardware',
    });
  }

  const matchedKey = entityNodeId(
    response.matched_entity_type,
    response.matched_entity_id
  );

  if (!seen.has(matchedKey)) {
    addEntry({
      entity_type: response.matched_entity_type,
      entity_id: response.matched_entity_id,
      entity_name: response.matched_label,
      entity_PartNumber: response.matched_entity_PartNumber,
      entity_SerialNumber: response.matched_entity_serialNumber,
      label: response.matched_label,
      role: 'matched',
    });
  } else {
    const matchedIndex = entries.findIndex(
      (entry) => entityNodeId(entry.entity_type, entry.entity_id) === matchedKey
    );
    if (matchedIndex >= 0) {
      entries[matchedIndex] = {
        ...entries[matchedIndex],
        entity_name: response.matched_label,
        entity_PartNumber: response.matched_entity_PartNumber,
        entity_SerialNumber: response.matched_entity_serialNumber,
        label: response.matched_label,
        role: 'matched',
      };
    }
  }

  return entries.sort(
    (a, b) =>
      getHierarchyLevel(a.entity_type) - getHierarchyLevel(b.entity_type) ||
      a.entity_id - b.entity_id
  );
}

function measureSubtreeWidth(node: EntityLookupNode): number {
  if (!node.children?.length) return ENTITY_NODE_WIDTH;

  const childrenWidth = node.children.reduce(
    (total, child, index) =>
      total + measureSubtreeWidth(child) + (index > 0 ? SIBLING_GAP : 0),
    0
  );

  return Math.max(ENTITY_NODE_WIDTH, childrenWidth);
}

function layoutDescendants(
  treeNodes: EntityLookupNode[],
  parentId: string,
  depth: number,
  startX: number,
  baseY: number,
  nodes: Node<EntityFlowNodeData>[],
  edges: Edge[],
  existingNodeIds: Set<string>
) {
  let currentX = startX;

  for (const child of treeNodes) {
    const id = entityNodeId(child.entity_type, child.entity_id);
    if (existingNodeIds.has(id)) {
      continue;
    }

    const subtreeWidth = measureSubtreeWidth(child);
    const x = currentX + subtreeWidth / 2 - ENTITY_NODE_WIDTH / 2;
    const y = baseY + (depth - 1) * LEVEL_GAP;

    existingNodeIds.add(id);
    nodes.push({
      id,
      type: 'entityFlowNode',
      position: { x, y },
      data: {
        entity_type: child.entity_type,
        entity_id: child.entity_id,
        entity_name: child.entity_name || child.label,
        entity_PartNumber: child.entity_PartNumber,
        entity_SerialNumber: child.entity_SerialNumber,
        label: child.label,
        role: 'descendant',
      },
    });

    edges.push({
      id: `edge-${parentId}-${id}`,
      source: parentId,
      target: id,
      type: 'smoothstep',
    });

    if (child.children?.length) {
      layoutDescendants(
        child.children,
        id,
        depth + 1,
        currentX,
        baseY,
        nodes,
        edges,
        existingNodeIds
      );
    }

    currentX += subtreeWidth + SIBLING_GAP;
  }
}

export function buildEntityLookupFlow(response: lookUpResponse) {
  const nodes: Node<EntityFlowNodeData>[] = [];
  const edges: Edge[] = [];
  const spineEntries = buildSpineEntries(response);

  let previousSpineId: string | null = null;
  let matchedId: string | null = null;
  let matchedY = 0;

  const existingNodeIds = new Set<string>();

  spineEntries.forEach((entry, index) => {
    const id = entityNodeId(entry.entity_type, entry.entity_id);
    existingNodeIds.add(id);
    const y = index * LEVEL_GAP;
    const x = SPINE_CENTER_X - ENTITY_NODE_WIDTH / 2;

    nodes.push({
      id,
      type: 'entityFlowNode',
      position: { x, y },
      data: {
        entity_type: entry.entity_type,
        entity_id: entry.entity_id,
        entity_name: entry.entity_name,
        entity_PartNumber: entry.entity_PartNumber,
        entity_SerialNumber: entry.entity_SerialNumber,
        label: entry.label,
        role: entry.role,
      },
    });

    if (previousSpineId) {
      edges.push({
        id: `edge-${previousSpineId}-${id}`,
        source: previousSpineId,
        target: id,
        type: 'smoothstep',
        animated: entry.role === 'matched',
      });
    }

    if (entry.role === 'matched') {
      matchedId = id;
      matchedY = y;
    }

    previousSpineId = id;
  });

  if (matchedId) {
    const descendants = buildTree(response.descendants || []);
    if (descendants.length > 0) {
      const totalWidth = descendants.reduce(
        (total, child, index) =>
          total + measureSubtreeWidth(child) + (index > 0 ? SIBLING_GAP : 0),
        0
      );
      const descendantStartX = SPINE_CENTER_X - totalWidth / 2;
      const descendantBaseY = matchedY + LEVEL_GAP;

      layoutDescendants(
        descendants,
        matchedId,
        1,
        Math.max(descendantStartX, 0),
        descendantBaseY,
        nodes,
        edges,
        existingNodeIds
      );
    }
  }

  return { nodes, edges };
}

export function toEntityLookupNode(data: EntityFlowNodeData): EntityLookupNode {
  return {
    entity_type: data.entity_type,
    entity_id: data.entity_id,
    label: data.label || data.entity_name,
    entity_name: data.entity_name,
    entity_PartNumber: data.entity_PartNumber || '',
    entity_SerialNumber: data.entity_SerialNumber || '',
    children: [],
  };
}

/** Nested hierarchy used by the collapsible workflow sheet. */
export function buildEntityLookupWorkflowTree(
  response: lookUpResponse
): EntityLookupWorkflowNode | null {
  const spine = buildSpineEntries(response);
  if (!spine.length) return null;

  const root: EntityLookupWorkflowNode = {
    ...spine[0],
    children: [],
  };

  let cursor = root;
  for (let index = 1; index < spine.length; index += 1) {
    const next: EntityLookupWorkflowNode = {
      ...spine[index],
      children: [],
    };
    cursor.children.push(next);
    cursor = next;
  }

  const descendantRoots = buildTree(response.descendants || []);
  for (const child of descendantRoots) {
    cursor.children.push(mapLookupNodeToWorkflow(child, 'descendant'));
  }

  return root;
}

function mapLookupNodeToWorkflow(
  node: EntityLookupNode,
  role: EntityNodeRole
): EntityLookupWorkflowNode {
  return {
    entity_type: node.entity_type,
    entity_id: node.entity_id,
    entity_name: node.entity_name || node.label,
    entity_PartNumber: node.entity_PartNumber,
    entity_SerialNumber: node.entity_SerialNumber,
    label: node.label,
    role,
    children: (node.children || []).map((child) =>
      mapLookupNodeToWorkflow(child, 'descendant')
    ),
  };
}

/** Collect ancestor keys (inclusive) from root to the focus node. */
export function collectWorkflowPathKeys(
  root: EntityLookupWorkflowNode | null,
  focusType: string,
  focusId: number
): Set<string> {
  const path = new Set<string>();
  if (!root) return path;

  const target = entityNodeId(focusType, focusId);

  const walk = (node: EntityLookupWorkflowNode, trail: string[]): boolean => {
    const key = entityNodeId(node.entity_type, node.entity_id);
    const nextTrail = [...trail, key];
    if (key === target) {
      nextTrail.forEach((item) => path.add(item));
      return true;
    }
    for (const child of node.children) {
      if (walk(child, nextTrail)) return true;
    }
    return false;
  };

  if (!walk(root, [])) {
    return collectMatchedWorkflowPathKeys(root);
  }

  return path;
}

/** Expand only the spine down to the matched (suspected) entity. */
export function collectMatchedWorkflowPathKeys(
  root: EntityLookupWorkflowNode | null
): Set<string> {
  const path = new Set<string>();
  if (!root) return path;

  const walk = (node: EntityLookupWorkflowNode, trail: string[]): boolean => {
    const key = entityNodeId(node.entity_type, node.entity_id);
    const nextTrail = [...trail, key];
    if (node.role === 'matched') {
      nextTrail.forEach((item) => path.add(item));
      return true;
    }
    for (const child of node.children) {
      if (walk(child, nextTrail)) return true;
    }
    return false;
  };

  if (!walk(root, [])) {
    let cursor: EntityLookupWorkflowNode | undefined = root;
    while (cursor) {
      path.add(entityNodeId(cursor.entity_type, cursor.entity_id));
      cursor = cursor.children.length === 1 ? cursor.children[0] : undefined;
    }
  }

  return path;
}

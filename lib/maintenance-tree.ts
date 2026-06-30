import type { FaultyEntity, MaintenanceAction } from '@/lib/models';
import { FaultyEntityStatus } from '@/lib/models';
import { isTerminalDisplayStatus, mapFaultyEntityStatusFromApi } from '@/lib/maintenance-workflow';

export interface InvestigationTreeNode {
  id: number;
  part_number: string;
  display_name: string;
  status: string;
  fault_type?: string;
  entity_type?: string;
  children: InvestigationTreeNode[];
}

export interface TreeVisualContext {
  redPingIds: Set<number>;
  amberPingIds: Set<number>;
  spinIds: Set<number>;
}

const TERMINAL_API_STATUSES = new Set<string>([
  FaultyEntityStatus.RESOLVED,
  FaultyEntityStatus.NO_FAULT_FOUND,
  FaultyEntityStatus.FALSEPOSITIVE,
  FaultyEntityStatus.HEALTHY,
]);

function isTerminalNode(
  node: InvestigationTreeNode,
  entities: FaultyEntity[],
  actions: MaintenanceAction[]
): boolean {
  const entity = entities.find((e) => e.id === node.id);
  if (!entity) return TERMINAL_API_STATUSES.has(node.status);
  const entityActions = actions.filter((a) => a.faulty_entity_id === entity.id);
  return isTerminalDisplayStatus(mapFaultyEntityStatusFromApi(entity, entityActions));
}

const FAULT_SOURCE_STATUSES = new Set<string>([
  FaultyEntityStatus.IDENTIFIED,
  FaultyEntityStatus.SUSPECTED,
  FaultyEntityStatus.CONFIRMED_FAULTY,
  FaultyEntityStatus.UNDER_INSPECTION,
]);

const RESOLVED_CASE_STATUSES = new Set(['resolved', 'closed']);

function toTreeNode(entity: FaultyEntity): InvestigationTreeNode {
  return {
    id: entity.id,
    part_number:
      entity.part_number ||
      entity.entity_name ||
      `${entity.entity_type}-${entity.entity_id}`,
    display_name:
      entity.entity_name ||
      entity.part_number ||
      `${entity.entity_type} ${entity.entity_id}`,
    status: entity.status,
    fault_type: entity.fault_type,
    entity_type: entity.entity_type,
    children: [],
  };
}

function sortTreeNodes(nodes: InvestigationTreeNode[]) {
  nodes.sort((a, b) => a.display_name.localeCompare(b.display_name));
  nodes.forEach((node) => sortTreeNodes(node.children));
}

/**
 * Builds a hierarchical investigation tree from flat faulty entities
 * using parent_faulty_entity_id. Falls back to matching hardware entity_id
 * when parent references are stored as entity IDs instead of faulty-entity IDs.
 */
export function buildInvestigationTree(entities: FaultyEntity[]): InvestigationTreeNode[] {
  if (!entities.length) return [];

  const nodeMap = new Map<number, InvestigationTreeNode>();
  const faultyEntityIds = new Set(entities.map((entity) => entity.id));

  for (const entity of entities) {
    nodeMap.set(entity.id, toTreeNode(entity));
  }

  const roots: InvestigationTreeNode[] = [];

  for (const entity of entities) {
    const node = nodeMap.get(entity.id)!;
    const parentId = entity.parent_faulty_entity_id;

    if (parentId == null) {
      roots.push(node);
      continue;
    }

    if (faultyEntityIds.has(parentId)) {
      nodeMap.get(parentId)!.children.push(node);
      continue;
    }

    const parentByEntityId = entities.find(
      (candidate) => candidate.entity_id === parentId && candidate.id !== entity.id
    );

    if (parentByEntityId) {
      nodeMap.get(parentByEntityId.id)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  sortTreeNodes(roots);
  return roots;
}

function walkTree(
  nodes: InvestigationTreeNode[],
  parentId: number | null,
  nodeMap: Map<number, InvestigationTreeNode>,
  parentMap: Map<number, number>
) {
  for (const node of nodes) {
    nodeMap.set(node.id, node);
    if (parentId != null) parentMap.set(node.id, parentId);
    if (node.children.length) walkTree(node.children, node.id, nodeMap, parentMap);
  }
}

function collectDescendantIds(node: InvestigationTreeNode): number[] {
  return node.children.flatMap((child) => [child.id, ...collectDescendantIds(child)]);
}

function collectAncestorIds(nodeId: number, parentMap: Map<number, number>): number[] {
  const ancestors: number[] = [];
  let current = parentMap.get(nodeId);
  while (current != null) {
    ancestors.push(current);
    current = parentMap.get(current);
  }
  return ancestors;
}

export function buildTreeVisualContext(
  nodes: InvestigationTreeNode[],
  caseStatus?: string,
  entities: FaultyEntity[] = [],
  actions: MaintenanceAction[] = []
): TreeVisualContext {
  const redPingIds = new Set<number>();
  const amberPingIds = new Set<number>();
  const spinIds = new Set<number>();

  if (caseStatus && RESOLVED_CASE_STATUSES.has(caseStatus)) {
    return { redPingIds, amberPingIds, spinIds };
  }

  const nodeMap = new Map<number, InvestigationTreeNode>();
  const parentMap = new Map<number, number>();
  walkTree(nodes, null, nodeMap, parentMap);

  for (const [nodeId, node] of nodeMap) {
    if (isTerminalNode(node, entities, actions)) continue;
    if (!FAULT_SOURCE_STATUSES.has(node.status)) continue;

    redPingIds.add(nodeId);
    collectAncestorIds(nodeId, parentMap).forEach((id) => spinIds.add(id));

    const descendants = collectDescendantIds(node);
    for (const descId of descendants) {
      const desc = nodeMap.get(descId);
      if (!desc || isTerminalNode(desc, entities, actions)) continue;
      amberPingIds.add(descId);
    }
  }

  return { redPingIds, amberPingIds, spinIds };
}

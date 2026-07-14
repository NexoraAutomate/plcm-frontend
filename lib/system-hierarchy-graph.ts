import type { Edge, Node } from '@xyflow/react';
import type {
  Component,
  Module,
  Status,
  Subsystem,
  System,
  Unit,
} from '@/lib/models';
import { resolveStatusName } from '@/lib/entity-status';
import { filterCurrentInstallEntities, getReplacementDateForDisplay } from '@/lib/entity-replacement';

export type HierarchyEntityType =
  | 'system'
  | 'subsystem'
  | 'module'
  | 'unit'
  | 'component';

export interface HierarchyTreeNode {
  id: string;
  entityId: number;
  type: HierarchyEntityType;
  name: string;
  status?: string;
  serialNumber?: string;
  partNumber?: string;
  configurationItem?: string;
  createdAt?: string;
  description?: string;
  detailPath: string;
  children: HierarchyTreeNode[];
  replacementSequence?: number;
  replacementDate?: string;
  isCurrentInstall?: boolean;
}

export interface HierarchyNodeFieldVisibility {
  status: boolean;
  serialNumber: boolean;
  partNumber: boolean;
  createdAt: boolean;
  description: boolean;
  replacementDate: boolean;
}

export const DEFAULT_NODE_FIELD_VISIBILITY: HierarchyNodeFieldVisibility = {
  status: true,
  serialNumber: true,
  partNumber: false,
  createdAt: false,
  description: false,
  replacementDate: false,
};

export interface HierarchyNodeData extends Record<string, unknown> {
  entityId: number;
  label: string;
  type: HierarchyEntityType;
  status?: string;
  serialNumber?: string;
  partNumber?: string;
  configurationItem?: string;
  createdAt?: string;
  description?: string;
  detailPath: string;
  fieldVisibility?: HierarchyNodeFieldVisibility;
  highlightState?: 'selected' | 'dimmed' | 'normal';
  hasResolutionHistory?: boolean;
  replacementSequence?: number;
  replacementDate?: string;
  isCurrentInstall?: boolean;
  isReplacedEntity?: boolean;
  dossierMode?: 'bhd' | 'mmhd';
}

const DETAIL_PATH: Record<HierarchyEntityType, (id: number) => string> = {
  system: (id) => `/systems/${id}`,
  subsystem: (id) => `/subsystems/${id}`,
  module: (id) => `/modules/${id}`,
  unit: (id) => `/units/${id}`,
  component: (id) => `/components/${id}`,
};

const NODE_WIDTH = 220;
const NODE_HEIGHT = 118;
const HORIZONTAL_GAP = 48;
const VERTICAL_GAP = 120;

export function makeNodeId(type: HierarchyEntityType, id: number) {
  return `${type}-${id}`;
}

export function mapEntityFields(
  entity: {
    name: string;
    description?: string;
    part_number?: string;
    serial_number?: string;
    configuration_item?: string;
    original_part_number?: string;
    original_serial_number?: string;
    created_at?: string;
    status_id?: number;
    status_name?: string;
    status?: { status_name?: string };
    replacement_sequence?: number;
    is_current_install?: boolean;
    replaced_at?: string | null;
    installation_date?: string;
  },
  statuses: Status[] = [],
  options?: { preferOriginalBuild?: boolean }
) {
  const statusName = resolveStatusName(entity, statuses);
  const useOriginal = options?.preferOriginalBuild === true;
  const partNumber = useOriginal
    ? entity.original_part_number?.trim() || entity.part_number
    : entity.part_number;
  const serialNumber = useOriginal
    ? entity.original_serial_number?.trim() || entity.serial_number
    : entity.serial_number;
  const configurationItem =
    entity.configuration_item?.trim() ||
    (useOriginal ? partNumber : entity.part_number)?.trim() ||
    undefined;

  return {
    name: entity.name,
    status: statusName !== 'Unknown' ? statusName : undefined,
    serialNumber,
    partNumber,
    configurationItem,
    createdAt: entity.created_at,
    description: entity.description,
    replacementSequence: entity.replacement_sequence,
    replacementDate: getReplacementDateForDisplay(entity),
    isCurrentInstall: entity.is_current_install !== false,
  };
}

export function buildSystemHierarchyTree(
  system: System,
  subsystems: Subsystem[],
  modules: Module[],
  units: Unit[],
  components: Component[],
  statuses: Status[] = []
): HierarchyTreeNode {
  const systemSubsystems = filterCurrentInstallEntities(
    subsystems.filter((sub) => sub.system_id === system.id)
  );

  return {
    id: makeNodeId('system', system.id),
    entityId: system.id,
    type: 'system',
    ...mapEntityFields(system, statuses),
    detailPath: DETAIL_PATH.system(system.id),
    children: systemSubsystems.map((subsystem) => {
      const subsystemModules = filterCurrentInstallEntities(
        modules.filter((mod) => mod.subsystem_id === subsystem.id)
      );

      return {
        id: makeNodeId('subsystem', subsystem.id),
        entityId: subsystem.id,
        type: 'subsystem',
        ...mapEntityFields(subsystem, statuses),
        detailPath: DETAIL_PATH.subsystem(subsystem.id),
        children: subsystemModules.map((module) => {
            const moduleUnits = filterCurrentInstallEntities(
              units.filter((unit) => unit.module_id === module.id)
            );

          return {
            id: makeNodeId('module', module.id),
            entityId: module.id,
            type: 'module',
            ...mapEntityFields(module, statuses),
            detailPath: DETAIL_PATH.module(module.id),
            children: moduleUnits.map((unit) => {
              const unitComponents = filterCurrentInstallEntities(
                components.filter((comp) => comp.unit_id === unit.id)
              );

              return {
                id: makeNodeId('unit', unit.id),
                entityId: unit.id,
                type: 'unit',
                ...mapEntityFields(unit, statuses),
                detailPath: DETAIL_PATH.unit(unit.id),
                children: unitComponents.map((component) => ({
                  id: makeNodeId('component', component.id),
                  entityId: component.id,
                  type: 'component',
                  ...mapEntityFields(component, statuses),
                  detailPath: DETAIL_PATH.component(component.id),
                  children: [],
                })),
              };
            }),
          };
        }),
      };
    }),
  };
}

function findSubtreeNode(
  root: HierarchyTreeNode,
  type: HierarchyEntityType,
  entityId: number
): HierarchyTreeNode | null {
  if (root.type === type && root.entityId === entityId) return root;
  for (const child of root.children) {
    const found = findSubtreeNode(child, type, entityId);
    if (found) return found;
  }
  return null;
}

/** Hierarchy rooted at a specific installed entity and its descendants only. */
export function buildEntityHierarchyTree(
  rootType: HierarchyEntityType,
  rootEntityId: number,
  system: System,
  subsystems: Subsystem[],
  modules: Module[],
  units: Unit[],
  components: Component[],
  statuses: Status[] = []
): HierarchyTreeNode | null {
  const fullTree = buildSystemHierarchyTree(
    system,
    subsystems,
    modules,
    units,
    components,
    statuses
  );

  if (rootType === 'system') {
    return rootEntityId === system.id ? fullTree : null;
  }

  return findSubtreeNode(fullTree, rootType, rootEntityId);
}

export const HIERARCHY_ENTITY_TYPES: HierarchyEntityType[] = [
  'system',
  'subsystem',
  'module',
  'unit',
  'component',
];

export function isHierarchyEntityType(value: string | null | undefined): value is HierarchyEntityType {
  return !!value && (HIERARCHY_ENTITY_TYPES as string[]).includes(value);
}

function collectNodesByDepth(
  root: HierarchyTreeNode
): Map<number, HierarchyTreeNode[]> {
  const byDepth = new Map<number, HierarchyTreeNode[]>();

  function walk(node: HierarchyTreeNode, depth: number) {
    const level = byDepth.get(depth) ?? [];
    level.push(node);
    byDepth.set(depth, level);
    node.children.forEach((child) => walk(child, depth + 1));
  }

  walk(root, 0);
  return byDepth;
}

export function hierarchyTreeToFlow(
  root: HierarchyTreeNode
): { nodes: Node<HierarchyNodeData>[]; edges: Edge[] } {
  const nodes: Node<HierarchyNodeData>[] = [];
  const edges: Edge[] = [];
  const byDepth = collectNodesByDepth(root);

  byDepth.forEach((levelNodes, depth) => {
    const count = levelNodes.length;
    const totalWidth = count * NODE_WIDTH + (count - 1) * HORIZONTAL_GAP;
    const startX = -totalWidth / 2 + NODE_WIDTH / 2;

    levelNodes.forEach((node, index) => {
      nodes.push({
        id: node.id,
        type: 'hierarchyNode',
        position: {
          x: startX + index * (NODE_WIDTH + HORIZONTAL_GAP),
          y: depth * (NODE_HEIGHT + VERTICAL_GAP),
        },
        data: {
          entityId: node.entityId,
          label: node.name,
          type: node.type,
          status: node.status,
          serialNumber: node.serialNumber,
          partNumber: node.partNumber,
          configurationItem: node.configurationItem,
          createdAt: node.createdAt,
          description: node.description,
          detailPath: node.detailPath,
          replacementSequence: node.replacementSequence,
          replacementDate: node.replacementDate,
          isCurrentInstall: node.isCurrentInstall,
        },
      });

      node.children.forEach((child) => {
        edges.push({
          id: `${node.id}->${child.id}`,
          source: node.id,
          target: child.id,
          type: 'smoothstep',
        });
      });
    });
  });

  return { nodes, edges };
}

export function countHierarchyNodes(root: HierarchyTreeNode): number {
  return 1 + root.children.reduce((sum, child) => sum + countHierarchyNodes(child), 0);
}

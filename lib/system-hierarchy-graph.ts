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
  createdAt?: string;
  description?: string;
  detailPath: string;
  children: HierarchyTreeNode[];
}

export interface HierarchyNodeFieldVisibility {
  status: boolean;
  serialNumber: boolean;
  partNumber: boolean;
  createdAt: boolean;
  description: boolean;
}

export const DEFAULT_NODE_FIELD_VISIBILITY: HierarchyNodeFieldVisibility = {
  status: true,
  serialNumber: true,
  partNumber: false,
  createdAt: false,
  description: false,
};

export interface HierarchyNodeData extends Record<string, unknown> {
  entityId: number;
  label: string;
  type: HierarchyEntityType;
  status?: string;
  serialNumber?: string;
  partNumber?: string;
  createdAt?: string;
  description?: string;
  detailPath: string;
  fieldVisibility?: HierarchyNodeFieldVisibility;
  highlightState?: 'selected' | 'dimmed' | 'normal';
  hasResolutionHistory?: boolean;
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
    created_at?: string;
    status_id?: number;
    status_name?: string;
    status?: { status_name?: string };
  },
  statuses: Status[] = []
) {
  const statusName = resolveStatusName(entity, statuses);

  return {
    name: entity.name,
    status: statusName !== 'Unknown' ? statusName : undefined,
    serialNumber: entity.serial_number,
    partNumber: entity.part_number,
    createdAt: entity.created_at,
    description: entity.description,
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
  const systemSubsystems = subsystems.filter((sub) => sub.system_id === system.id);

  return {
    id: makeNodeId('system', system.id),
    entityId: system.id,
    type: 'system',
    ...mapEntityFields(system, statuses),
    detailPath: DETAIL_PATH.system(system.id),
    children: systemSubsystems.map((subsystem) => {
      const subsystemModules = modules.filter((mod) => mod.subsystem_id === subsystem.id);

      return {
        id: makeNodeId('subsystem', subsystem.id),
        entityId: subsystem.id,
        type: 'subsystem',
        ...mapEntityFields(subsystem, statuses),
        detailPath: DETAIL_PATH.subsystem(subsystem.id),
        children: subsystemModules.map((module) => {
          const moduleUnits = units.filter((unit) => unit.module_id === module.id);

          return {
            id: makeNodeId('module', module.id),
            entityId: module.id,
            type: 'module',
            ...mapEntityFields(module, statuses),
            detailPath: DETAIL_PATH.module(module.id),
            children: moduleUnits.map((unit) => {
              const unitComponents = components.filter((comp) => comp.unit_id === unit.id);

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
          createdAt: node.createdAt,
          description: node.description,
          detailPath: node.detailPath,
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

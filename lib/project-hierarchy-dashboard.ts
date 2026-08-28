import type {
  Component,
  Module,
  Project,
  Status,
  Subsystem,
  System,
  Unit,
} from '@/lib/models';
import {
  hierarchyTreeToFlow,
  makeNodeId,
  mapEntityFields,
  type HierarchyEntityType,
  type HierarchyTreeNode,
} from '@/lib/system-hierarchy-graph';
import { filterCurrentInstallEntities } from '@/lib/entity-replacement';

export type HierarchyHighlightState = 'selected' | 'dimmed' | 'normal';

export interface HierarchyDashboardSelection {
  projectId?: number;
  systemId?: number;
  subsystemId?: number;
  moduleId?: number;
  unitId?: number;
  componentId?: number;
}

export interface SerialSearchMatch {
  type: HierarchyEntityType;
  entityId: number;
  serialNumber: string;
  name: string;
  selection: HierarchyDashboardSelection;
}

const DETAIL_PATH: Record<HierarchyEntityType, (id: number) => string> = {
  system: (id) => `/systems/${id}`,
  subsystem: (id) => `/subsystems/${id}`,
  module: (id) => `/modules/${id}`,
  unit: (id) => `/units/${id}`,
  component: (id) => `/components/${id}`,
};

export function getRunningProjects(projects: Project[]): Project[] {
  return projects.filter(
    (project) =>
      project.status_name !== 'Completed' && project.status_name !== 'On Hold'
  );
}

export function getSystemsForProject(systems: System[], projectId: number): System[] {
  return filterCurrentInstallEntities(systems.filter((system) => system.project_id === projectId));
}

export function getSubsystemsForSystem(subsystems: Subsystem[], systemId: number): Subsystem[] {
  return filterCurrentInstallEntities(
    subsystems.filter((subsystem) => subsystem.system_id === systemId)
  );
}

export function getModulesForSubsystem(modules: Module[], subsystemId: number): Module[] {
  return filterCurrentInstallEntities(
    modules.filter((module) => module.subsystem_id === subsystemId)
  );
}

export function getUnitsForModule(units: Unit[], moduleId: number): Unit[] {
  return filterCurrentInstallEntities(units.filter((unit) => unit.module_id === moduleId));
}

export function getComponentsForUnit(components: Component[], unitId: number): Component[] {
  return filterCurrentInstallEntities(
    components.filter((component) => component.unit_id === unitId)
  );
}

function getDeepestSelection(
  selection: HierarchyDashboardSelection
): { type: HierarchyEntityType; entityId: number } | null {
  if (selection.componentId) {
    return { type: 'component', entityId: selection.componentId };
  }
  if (selection.unitId) {
    return { type: 'unit', entityId: selection.unitId };
  }
  if (selection.moduleId) {
    return { type: 'module', entityId: selection.moduleId };
  }
  if (selection.subsystemId) {
    return { type: 'subsystem', entityId: selection.subsystemId };
  }
  if (selection.systemId) {
    return { type: 'system', entityId: selection.systemId };
  }
  return null;
}

function highlightStateFor(
  type: HierarchyEntityType,
  entityId: number,
  selection: HierarchyDashboardSelection
): HierarchyHighlightState {
  const deepest = getDeepestSelection(selection);
  if (!deepest) return 'normal';

  if (deepest.type === type && deepest.entityId === entityId) {
    return 'selected';
  }

  const selectedSystemId = selection.systemId;
  const selectedSubsystemId = selection.subsystemId;
  const selectedModuleId = selection.moduleId;
  const selectedUnitId = selection.unitId;

  if (type === 'system' && selectedSystemId && entityId !== selectedSystemId) {
    return 'dimmed';
  }
  if (type === 'subsystem' && selectedSubsystemId && entityId !== selectedSubsystemId) {
    return 'dimmed';
  }
  if (type === 'module' && selectedModuleId && entityId !== selectedModuleId) {
    return 'dimmed';
  }
  if (type === 'unit' && selectedUnitId && entityId !== selectedUnitId) {
    return 'dimmed';
  }
  if (
    type === 'component' &&
    selection.componentId &&
    entityId !== selection.componentId
  ) {
    return 'dimmed';
  }

  return 'normal';
}

function toTreeNode<T extends { id: number; name: string }>(
  entity: T,
  type: HierarchyEntityType,
  statuses: Status[],
  selection: HierarchyDashboardSelection,
  children: HierarchyTreeNode[] = [],
  options?: { preferOriginalBuild?: boolean }
): HierarchyTreeNode {
  const fields = mapEntityFields(
    entity as Parameters<typeof mapEntityFields>[0],
    statuses,
    { preferOriginalBuild: options?.preferOriginalBuild }
  );

  return {
    id: makeNodeId(type, entity.id),
    entityId: entity.id,
    type,
    ...fields,
    detailPath: DETAIL_PATH[type](entity.id),
    children,
    highlightState: highlightStateFor(type, entity.id, selection),
  } as HierarchyTreeNode & { highlightState: HierarchyHighlightState };
}

export function buildProjectHierarchyTree(
  selection: HierarchyDashboardSelection,
  systems: System[],
  subsystems: Subsystem[],
  modules: Module[],
  units: Unit[],
  components: Component[],
  statuses: Status[] = [],
  options?: { expandAll?: boolean; preferOriginalBuild?: boolean }
): HierarchyTreeNode[] {
  if (!selection.projectId) return [];

  const projectSystems = getSystemsForProject(systems, selection.projectId);
  if (projectSystems.length === 0) return [];

  return projectSystems.map((system) => {
    const isOnPath = options?.expandAll || !selection.systemId || system.id === selection.systemId;
    const effectiveSelection = options?.expandAll
      ? { ...selection, systemId: system.id }
      : selection;
    const systemChildren =
      isOnPath && (options?.expandAll || selection.systemId)
        ? buildSubsystemLevel(
            effectiveSelection,
            system.id,
            subsystems,
            modules,
            units,
            components,
            statuses,
            options
          )
        : [];

    return toTreeNode(system, 'system', statuses, selection, systemChildren, options);
  });
}

function buildSubsystemLevel(
  selection: HierarchyDashboardSelection,
  systemId: number,
  subsystems: Subsystem[],
  modules: Module[],
  units: Unit[],
  components: Component[],
  statuses: Status[],
  options?: { expandAll?: boolean; preferOriginalBuild?: boolean }
): HierarchyTreeNode[] {
  const systemSubsystems = getSubsystemsForSystem(subsystems, systemId);

  return systemSubsystems.map((subsystem) => {
    const isOnPath =
      options?.expandAll || !selection.subsystemId || subsystem.id === selection.subsystemId;
    const effectiveSelection = options?.expandAll
      ? { ...selection, subsystemId: subsystem.id }
      : selection;
    const subsystemChildren =
      isOnPath && (options?.expandAll || selection.subsystemId)
        ? buildModuleLevel(
            effectiveSelection,
            subsystem.id,
            modules,
            units,
            components,
            statuses,
            options
          )
        : [];

    return toTreeNode(subsystem, 'subsystem', statuses, selection, subsystemChildren, options);
  });
}

function buildModuleLevel(
  selection: HierarchyDashboardSelection,
  subsystemId: number,
  modules: Module[],
  units: Unit[],
  components: Component[],
  statuses: Status[],
  options?: { expandAll?: boolean; preferOriginalBuild?: boolean }
): HierarchyTreeNode[] {
  const subsystemModules = getModulesForSubsystem(modules, subsystemId);

  return subsystemModules.map((module) => {
    const isOnPath = options?.expandAll || !selection.moduleId || module.id === selection.moduleId;
    const effectiveSelection = options?.expandAll
      ? { ...selection, moduleId: module.id }
      : selection;
    const moduleChildren =
      isOnPath && (options?.expandAll || selection.moduleId)
        ? buildUnitLevel(effectiveSelection, module.id, units, components, statuses, options)
        : [];

    return toTreeNode(module, 'module', statuses, selection, moduleChildren, options);
  });
}

function buildUnitLevel(
  selection: HierarchyDashboardSelection,
  moduleId: number,
  units: Unit[],
  components: Component[],
  statuses: Status[],
  options?: { expandAll?: boolean; preferOriginalBuild?: boolean }
): HierarchyTreeNode[] {
  const moduleUnits = getUnitsForModule(units, moduleId);

  return moduleUnits.map((unit) => {
    const isOnPath = options?.expandAll || !selection.unitId || unit.id === selection.unitId;
    const effectiveSelection = options?.expandAll ? { ...selection, unitId: unit.id } : selection;
    const unitChildren =
      isOnPath && (options?.expandAll || selection.unitId)
        ? buildComponentLevel(effectiveSelection, unit.id, components, statuses, options)
        : [];

    return toTreeNode(unit, 'unit', statuses, selection, unitChildren, options);
  });
}

function buildComponentLevel(
  selection: HierarchyDashboardSelection,
  unitId: number,
  components: Component[],
  statuses: Status[],
  options?: { expandAll?: boolean; preferOriginalBuild?: boolean }
): HierarchyTreeNode[] {
  return getComponentsForUnit(components, unitId).map((component) =>
    toTreeNode(component, 'component', statuses, selection, [], options)
  );
}

export function buildProjectHierarchyFlow(
  selection: HierarchyDashboardSelection,
  systems: System[],
  subsystems: Subsystem[],
  modules: Module[],
  units: Unit[],
  components: Component[],
  statuses: Status[] = [],
  options?: { expandAll?: boolean; preferOriginalBuild?: boolean }
) {
  const roots = buildProjectHierarchyTree(
    selection,
    systems,
    subsystems,
    modules,
    units,
    components,
    statuses,
    options
  );

  if (roots.length === 0) {
    return { nodes: [], edges: [] };
  }

  const virtualRoot: HierarchyTreeNode = {
    id: 'project-root',
    entityId: selection.projectId ?? 0,
    type: 'system',
    name: 'Project',
    detailPath: '#',
    children: roots,
  };

  const flow = hierarchyTreeToFlow(virtualRoot);

  return {
    nodes: flow.nodes
      .filter((node) => node.id !== 'project-root')
      .map((node) => {
        const treeNode = findTreeNode(roots, node.id);
        return {
          ...node,
          data: {
            ...node.data,
            highlightState: (treeNode as HierarchyTreeNode & { highlightState?: HierarchyHighlightState })
              ?.highlightState ?? 'normal',
          },
        };
      }),
    edges: flow.edges.filter(
      (edge) => edge.source !== 'project-root' && edge.target !== 'project-root'
    ),
  };
}

function findTreeNode(
  nodes: HierarchyTreeNode[],
  id: string
): HierarchyTreeNode | undefined {
  for (const node of nodes) {
    if (node.id === id) return node;
    const match = findTreeNode(node.children, id);
    if (match) return match;
  }
  return undefined;
}

export function resolveSelectionFromEntity(
  type: HierarchyEntityType,
  entityId: number,
  systems: System[],
  subsystems: Subsystem[],
  modules: Module[],
  units: Unit[],
  components: Component[]
): HierarchyDashboardSelection | null {
  switch (type) {
    case 'component': {
      const component = components.find((item) => item.id === entityId);
      if (!component) return null;
      const unit = units.find((item) => item.id === component.unit_id);
      if (!unit) return null;
      return {
        ...resolveSelectionFromEntity('unit', unit.id, systems, subsystems, modules, units, components),
        componentId: component.id,
      };
    }
    case 'unit': {
      const unit = units.find((item) => item.id === entityId);
      if (!unit) return null;
      const module = modules.find((item) => item.id === unit.module_id);
      if (!module) return null;
      return {
        ...resolveSelectionFromEntity('module', module.id, systems, subsystems, modules, units, components),
        unitId: unit.id,
      };
    }
    case 'module': {
      const module = modules.find((item) => item.id === entityId);
      if (!module) return null;
      const subsystem = subsystems.find((item) => item.id === module.subsystem_id);
      if (!subsystem) return null;
      return {
        ...resolveSelectionFromEntity(
          'subsystem',
          subsystem.id,
          systems,
          subsystems,
          modules,
          units,
          components
        ),
        moduleId: module.id,
      };
    }
    case 'subsystem': {
      const subsystem = subsystems.find((item) => item.id === entityId);
      if (!subsystem) return null;
      const system = systems.find((item) => item.id === subsystem.system_id);
      if (!system) return null;
      return {
        ...resolveSelectionFromEntity('system', system.id, systems, subsystems, modules, units, components),
        subsystemId: subsystem.id,
      };
    }
    case 'system': {
      const system = systems.find((item) => item.id === entityId);
      if (!system) return null;
      return { projectId: system.project_id, systemId: system.id };
    }
  }
}

export function searchEntityBySerialNumber(
  serialQuery: string,
  systems: System[],
  subsystems: Subsystem[],
  modules: Module[],
  units: Unit[],
  components: Component[]
): SerialSearchMatch | null {
  const query = serialQuery.trim().toLowerCase();
  if (!query) return null;

  const candidates: SerialSearchMatch[] = [];

  const addMatch = (
    type: HierarchyEntityType,
    entity: { id: number; name: string; serial_number?: string }
  ) => {
    if (!entity.serial_number?.toLowerCase().includes(query)) return;
    const selection = resolveSelectionFromEntity(
      type,
      entity.id,
      systems,
      subsystems,
      modules,
      units,
      components
    );
    if (!selection?.projectId) return;

    candidates.push({
      type,
      entityId: entity.id,
      serialNumber: entity.serial_number,
      name: entity.name,
      selection,
    });
  };

  systems.forEach((system) => addMatch('system', system));
  subsystems.forEach((subsystem) => addMatch('subsystem', subsystem));
  modules.forEach((module) => addMatch('module', module));
  units.forEach((unit) => addMatch('unit', unit));
  components.forEach((component) => addMatch('component', component));

  if (candidates.length === 0) return null;

  return candidates.sort((a, b) => {
    const exactA = a.serialNumber.toLowerCase() === query;
    const exactB = b.serialNumber.toLowerCase() === query;
    if (exactA !== exactB) return exactA ? -1 : 1;
    return a.serialNumber.localeCompare(b.serialNumber);
  })[0];
}

export const HIERARCHY_LEVELS: {
  key: keyof HierarchyDashboardSelection;
  type: HierarchyEntityType;
  label: string;
  parentKey?: keyof HierarchyDashboardSelection;
}[] = [
  { key: 'projectId', type: 'system', label: 'Project' },
  { key: 'systemId', type: 'system', label: 'System', parentKey: 'projectId' },
  { key: 'subsystemId', type: 'subsystem', label: 'Subsystem', parentKey: 'systemId' },
  { key: 'moduleId', type: 'module', label: 'Module', parentKey: 'subsystemId' },
  { key: 'unitId', type: 'unit', label: 'Unit', parentKey: 'moduleId' },
  { key: 'componentId', type: 'component', label: 'Component', parentKey: 'unitId' },
];

export interface SubtreeEntityRef {
  type: HierarchyEntityType;
  pk: number;
  name: string;
  part_number?: string;
  serial_number?: string;
  created_at?: string;
  installation_date?: string;
  installed_by_id?: number;
  original_part_number?: string;
  original_serial_number?: string;
  is_current_install?: boolean;
  replacement_sequence?: number;
  root_entity_id?: number | null;
}

function installRefFields(entity: {
  original_part_number?: string;
  original_serial_number?: string;
  is_current_install?: boolean;
  replacement_sequence?: number;
  root_entity_id?: number | null;
}) {
  return {
    original_part_number: entity.original_part_number,
    original_serial_number: entity.original_serial_number,
    is_current_install: entity.is_current_install,
    replacement_sequence: entity.replacement_sequence,
    root_entity_id: entity.root_entity_id,
  };
}
export function collectSubtreeEntities(
  systemId: number,
  systems: System[],
  subsystems: Subsystem[],
  modules: Module[],
  units: Unit[],
  components: Component[]
): SubtreeEntityRef[] {
  const result: SubtreeEntityRef[] = [];
  const system = systems.find((item) => item.id === systemId);
  if (!system) return result;

  result.push({
    type: 'system',
    pk: system.id,
    name: system.name,
    part_number: system.part_number,
    serial_number: system.serial_number,
    created_at: system.created_at,
    installation_date: system.installation_date,
    installed_by_id: system.installed_by_id,
    ...installRefFields(system),
  });

  const systemSubsystems = getSubsystemsForSystem(subsystems, systemId);
  for (const subsystem of systemSubsystems) {
    result.push({
      type: 'subsystem',
      pk: subsystem.id,
      name: subsystem.name,
      part_number: subsystem.part_number,
      serial_number: subsystem.serial_number,
      created_at: subsystem.created_at,
      installation_date: subsystem.installation_date,
      installed_by_id: subsystem.installed_by_id,
      original_part_number: subsystem.original_part_number,
      original_serial_number: subsystem.original_serial_number,
      ...installRefFields(subsystem),
    });

    const subsystemModules = getModulesForSubsystem(modules, subsystem.id);
    for (const module of subsystemModules) {
      result.push({
        type: 'module',
        pk: module.id,
        name: module.name,
        part_number: module.part_number,
        serial_number: module.serial_number,
        created_at: module.created_at,
        installation_date: module.installation_date,
        installed_by_id: module.installed_by_id,
        original_part_number: module.original_part_number,
        original_serial_number: module.original_serial_number,
        ...installRefFields(module),
      });

      const moduleUnits = getUnitsForModule(units, module.id);
      for (const unit of moduleUnits) {
        result.push({
          type: 'unit',
          pk: unit.id,
          name: unit.name,
          part_number: unit.part_number,
          serial_number: unit.serial_number,
          created_at: unit.created_at,
          installation_date: unit.installation_date,
          installed_by_id: unit.installed_by_id,
          original_part_number: unit.original_part_number,
          original_serial_number: unit.original_serial_number,
          ...installRefFields(unit),
        });

        const unitComponents = getComponentsForUnit(components, unit.id);
        for (const component of unitComponents) {
          result.push({
            type: 'component',
            pk: component.id,
            name: component.name,
            part_number: component.part_number,
            serial_number: component.serial_number,
            created_at: component.created_at,
            installation_date: component.installation_date,
            installed_by_id: component.installed_by_id,
            original_part_number: component.original_part_number,
            original_serial_number: component.original_serial_number,
            ...installRefFields(component),
          });
        }
      }
    }
  }

  return result;
}

function toSubtreeRef(
  type: HierarchyEntityType,
  entity: {
    id: number;
    name: string;
    part_number?: string;
    serial_number?: string;
    created_at?: string;
    installation_date?: string;
    installed_by_id?: number;
    original_part_number?: string;
    original_serial_number?: string;
    is_current_install?: boolean;
    replacement_sequence?: number;
    root_entity_id?: number | null;
  }
): SubtreeEntityRef {
  return {
    type,
    pk: entity.id,
    name: entity.name,
    part_number: entity.part_number,
    serial_number: entity.serial_number,
    created_at: entity.created_at,
    installation_date: entity.installation_date,
    installed_by_id: entity.installed_by_id,
    ...installRefFields(entity),
  };
}

export function collectSubtreeFromNode(
  type: HierarchyEntityType,
  pk: number,
  systems: System[],
  subsystems: Subsystem[],
  modules: Module[],
  units: Unit[],
  components: Component[]
): SubtreeEntityRef[] {
  if (type === 'system') {
    return collectSubtreeEntities(pk, systems, subsystems, modules, units, components);
  }

  if (type === 'subsystem') {
    const subsystem = subsystems.find((item) => item.id === pk);
    if (!subsystem) return [];

    const result = [toSubtreeRef('subsystem', subsystem)];
    for (const module of getModulesForSubsystem(modules, pk)) {
      result.push(...collectSubtreeFromNode('module', module.id, systems, subsystems, modules, units, components));
    }
    return result;
  }

  if (type === 'module') {
    const module = modules.find((item) => item.id === pk);
    if (!module) return [];

    const result = [toSubtreeRef('module', module)];
    for (const unit of getUnitsForModule(units, pk)) {
      result.push(...collectSubtreeFromNode('unit', unit.id, systems, subsystems, modules, units, components));
    }
    return result;
  }

  if (type === 'unit') {
    const unit = units.find((item) => item.id === pk);
    if (!unit) return [];

    const result = [toSubtreeRef('unit', unit)];
    for (const component of getComponentsForUnit(components, pk)) {
      result.push(...collectSubtreeFromNode('component', component.id, systems, subsystems, modules, units, components));
    }
    return result;
  }

  const component = components.find((item) => item.id === pk);
  return component ? [toSubtreeRef('component', component)] : [];
}

export function collectProjectEntityRefs(
  projectId: number,
  systems: System[],
  subsystems: Subsystem[],
  modules: Module[],
  units: Unit[],
  components: Component[]
): Array<{ type: HierarchyEntityType; id: number }> {
  const refs: Array<{ type: HierarchyEntityType; id: number }> = [];
  for (const system of getSystemsForProject(systems, projectId)) {
    refs.push({ type: 'system', id: system.id });
    for (const subsystem of getSubsystemsForSystem(subsystems, system.id)) {
      refs.push({ type: 'subsystem', id: subsystem.id });
      for (const module of getModulesForSubsystem(modules, subsystem.id)) {
        refs.push({ type: 'module', id: module.id });
        for (const unit of getUnitsForModule(units, module.id)) {
          refs.push({ type: 'unit', id: unit.id });
          for (const component of getComponentsForUnit(components, unit.id)) {
            refs.push({ type: 'component', id: component.id });
          }
        }
      }
    }
  }
  return refs;
}

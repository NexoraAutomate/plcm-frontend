import type { HierarchyDashboardSelection } from '@/lib/project-hierarchy-dashboard';
import type { HierarchyEntityType } from '@/lib/system-hierarchy-graph';
import type { Component, Module, Subsystem, System, Unit } from '@/lib/models';
import {
  getEntityTypeLabel,
  resolveEntityTypeLabel,
} from '@/lib/app-definitions';
import type { AppDefinitions } from '@/lib/models';

export type DashboardEntityType = HierarchyEntityType;

export type DashboardLevelKey = keyof HierarchyDashboardSelection;

export interface DashboardLevelConfig {
  selectionKey: DashboardLevelKey;
  entityType?: DashboardEntityType;
  label: string;
  childEntityType?: DashboardEntityType;
  parentSelectionKey?: DashboardLevelKey;
  statusType?: string;
  hierarchyType?: DashboardEntityType;
  parentHierarchyType?: DashboardEntityType;
}

/** Structural level keys (labels come from App Definitions via getDashboardLevels). */
const DASHBOARD_LEVEL_BASE: Omit<DashboardLevelConfig, 'label'>[] = [
  {
    selectionKey: 'projectId',
    childEntityType: 'system',
    parentSelectionKey: undefined,
  },
  {
    selectionKey: 'systemId',
    entityType: 'system',
    childEntityType: 'subsystem',
    parentSelectionKey: 'projectId',
    statusType: 'systems',
    hierarchyType: 'system',
  },
  {
    selectionKey: 'subsystemId',
    entityType: 'subsystem',
    childEntityType: 'module',
    parentSelectionKey: 'systemId',
    statusType: 'subsystems',
    hierarchyType: 'subsystem',
    parentHierarchyType: 'system',
  },
  {
    selectionKey: 'moduleId',
    entityType: 'module',
    childEntityType: 'unit',
    parentSelectionKey: 'subsystemId',
    statusType: 'modules',
    hierarchyType: 'module',
    parentHierarchyType: 'subsystem',
  },
  {
    selectionKey: 'unitId',
    entityType: 'unit',
    childEntityType: 'component',
    parentSelectionKey: 'moduleId',
    statusType: 'units',
    hierarchyType: 'unit',
    parentHierarchyType: 'module',
  },
  {
    selectionKey: 'componentId',
    entityType: 'component',
    parentSelectionKey: 'unitId',
    statusType: 'components',
    hierarchyType: 'component',
    parentHierarchyType: 'unit',
  },
];

function levelDisplayLabel(
  base: Omit<DashboardLevelConfig, 'label'>,
  label: (level: string, plural?: boolean) => string
): string {
  if (base.entityType) return label(base.entityType);
  return 'Project';
}

/** Dashboard levels with labels from current App Definitions. */
export function getDashboardLevels(
  label: (level: string, plural?: boolean) => string = resolveEntityTypeLabel
): DashboardLevelConfig[] {
  return DASHBOARD_LEVEL_BASE.map((base) => ({
    ...base,
    label: levelDisplayLabel(base, label),
  }));
}

/** @deprecated Prefer getDashboardLevels() so labels follow App Definitions. */
export const DASHBOARD_LEVELS: DashboardLevelConfig[] = getDashboardLevels();

export const SELECTION_KEY_BY_ENTITY: Record<DashboardEntityType, DashboardLevelKey> = {
  system: 'systemId',
  subsystem: 'subsystemId',
  module: 'moduleId',
  unit: 'unitId',
  component: 'componentId',
};

export const CHILD_ENTITY_TYPE: Record<DashboardEntityType, DashboardEntityType | undefined> = {
  system: 'subsystem',
  subsystem: 'module',
  module: 'unit',
  unit: 'component',
  component: undefined,
};

export function getLevelConfig(selectionKey: DashboardLevelKey): DashboardLevelConfig | undefined {
  return getDashboardLevels().find((level) => level.selectionKey === selectionKey);
}

/** Hierarchy level display name from current App Definitions (singular by default). */
export function getEntityLabel(type: DashboardEntityType, plural = false): string {
  return resolveEntityTypeLabel(type, plural);
}

export function getEntityLabelFromDefinitions(
  type: DashboardEntityType,
  definitions: Pick<
    AppDefinitions,
    | 'label_system'
    | 'label_systems'
    | 'label_subsystem'
    | 'label_subsystems'
    | 'label_module'
    | 'label_modules'
    | 'label_unit'
    | 'label_units'
    | 'label_component'
    | 'label_components'
  > | null | undefined,
  plural = false
): string {
  return getEntityTypeLabel(definitions, type, plural);
}

export const PARENT_ID_FIELD: Record<
  DashboardEntityType,
  'project_id' | 'system_id' | 'subsystem_id' | 'module_id' | 'unit_id'
> = {
  system: 'project_id',
  subsystem: 'system_id',
  module: 'subsystem_id',
  unit: 'module_id',
  component: 'unit_id',
};

export function resolveEntityParentIds(
  type: DashboardEntityType,
  entityId: number,
  selection: HierarchyDashboardSelection,
  systems: System[],
  subsystems: Subsystem[],
  modules: Module[],
  units: Unit[],
  components: Component[]
): { siblingParentId?: number; editParentId?: number } {
  switch (type) {
    case 'system': {
      const system = systems.find((item) => item.id === entityId);
      const projectId = system?.project_id ?? selection.projectId;
      return { siblingParentId: projectId, editParentId: projectId };
    }
    case 'subsystem': {
      const subsystem = subsystems.find((item) => item.id === entityId);
      return { siblingParentId: subsystem?.system_id, editParentId: subsystem?.system_id };
    }
    case 'module': {
      const module = modules.find((item) => item.id === entityId);
      return { siblingParentId: module?.subsystem_id, editParentId: module?.subsystem_id };
    }
    case 'unit': {
      const unit = units.find((item) => item.id === entityId);
      return { siblingParentId: unit?.module_id, editParentId: unit?.module_id };
    }
    case 'component': {
      const component = components.find((item) => item.id === entityId);
      return { siblingParentId: component?.unit_id, editParentId: component?.unit_id };
    }
    default:
      return {};
  }
}

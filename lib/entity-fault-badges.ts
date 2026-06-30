import {
  CaseStatus,
  EntityType,
  FaultyEntityStatus,
  type Component,
  type FaultyEntity,
  type MaintenanceCase,
  type Module,
  type Order,
  type Project,
  type Subsystem,
  type System,
  type Unit,
} from '@/lib/models';

export type EntityScopeType =
  | 'order'
  | 'project'
  | 'system'
  | 'subsystem'
  | 'module'
  | 'unit'
  | 'component';

export function entityScopeKey(type: EntityScopeType | EntityType | string, id: number): string {
  return `${type}:${id}`;
}

export const FAULT_PING_STYLES: Partial<
  Record<FaultyEntityStatus, { ping: string; dot: string; label: string }>
> = {
  [FaultyEntityStatus.CONFIRMED_FAULTY]: {
    ping: 'bg-red-700',
    dot: 'bg-red-500',
    label: 'Confirmed faulty',
  },
  [FaultyEntityStatus.IDENTIFIED]: {
    ping: 'bg-orange-600',
    dot: 'bg-orange-500',
    label: 'Identified',
  },
  [FaultyEntityStatus.SUSPECTED]: {
    ping: 'bg-amber-500',
    dot: 'bg-amber-400',
    label: 'Potentially affected',
  },
  [FaultyEntityStatus.UNDER_INSPECTION]: {
    ping: 'bg-blue-600',
    dot: 'bg-blue-500',
    label: 'Under inspection',
  },
};

const TERMINAL_STATUSES = new Set<string>([
  FaultyEntityStatus.HEALTHY,
  FaultyEntityStatus.RESOLVED,
  FaultyEntityStatus.NO_FAULT_FOUND,
  FaultyEntityStatus.FALSEPOSITIVE,
]);

const STATUS_RANK: Record<string, number> = {
  [FaultyEntityStatus.CONFIRMED_FAULTY]: 5,
  [FaultyEntityStatus.IDENTIFIED]: 4,
  [FaultyEntityStatus.UNDER_INSPECTION]: 3,
  [FaultyEntityStatus.SUSPECTED]: 2,
};

export interface HierarchyData {
  orders: Order[];
  projects: Project[];
  systems: System[];
  subsystems: Subsystem[];
  modules: Module[];
  units: Unit[];
  components: Component[];
}

interface HierarchyIndexes {
  componentsById: Map<number, Component>;
  unitsById: Map<number, Unit>;
  modulesById: Map<number, Module>;
  subsystemsById: Map<number, Subsystem>;
  systemsById: Map<number, System>;
  projectsById: Map<number, Project>;
  subsystemsBySystemId: Map<number, Subsystem[]>;
  modulesBySubsystemId: Map<number, Module[]>;
  unitsByModuleId: Map<number, Unit[]>;
  componentsByUnitId: Map<number, Component[]>;
  faultyEntitiesById: Map<number, FaultyEntity>;
  childrenByParentFaultId: Map<number, FaultyEntity[]>;
}

function groupById<T, K extends number>(
  items: T[],
  keyFn: (item: T) => K
): Map<K, T[]> {
  const map = new Map<K, T[]>();
  for (const item of items) {
    const key = keyFn(item);
    const bucket = map.get(key);
    if (bucket) bucket.push(item);
    else map.set(key, [item]);
  }
  return map;
}

function buildHierarchyIndexes(
  h: HierarchyData,
  faultyEntities: FaultyEntity[]
): HierarchyIndexes {
  return {
    componentsById: new Map(h.components.map((c) => [c.id, c])),
    unitsById: new Map(h.units.map((u) => [u.id, u])),
    modulesById: new Map(h.modules.map((m) => [m.id, m])),
    subsystemsById: new Map(h.subsystems.map((s) => [s.id, s])),
    systemsById: new Map(h.systems.map((s) => [s.id, s])),
    projectsById: new Map(h.projects.map((p) => [p.id, p])),
    subsystemsBySystemId: groupById(h.subsystems, (s) => s.system_id),
    modulesBySubsystemId: groupById(h.modules, (m) => m.subsystem_id),
    unitsByModuleId: groupById(h.units, (u) => u.module_id),
    componentsByUnitId: groupById(h.components, (c) => c.unit_id),
    faultyEntitiesById: new Map(faultyEntities.map((fe) => [fe.id, fe])),
    childrenByParentFaultId: groupById(
      faultyEntities.filter((fe) => fe.parent_faulty_entity_id != null),
      (fe) => fe.parent_faulty_entity_id as number
    ),
  };
}

function mergeStatus(
  map: Map<string, FaultyEntityStatus>,
  key: string,
  status: FaultyEntityStatus
) {
  if (TERMINAL_STATUSES.has(status)) return;
  const current = map.get(key);
  if (!current || (STATUS_RANK[status] ?? 0) > (STATUS_RANK[current] ?? 0)) {
    map.set(key, status);
  }
}

function openCaseIds(cases: MaintenanceCase[]): Set<number> {
  return new Set(
    cases
      .filter((c) => c.status !== CaseStatus.Resolved && c.status !== CaseStatus.Closed)
      .map((c) => c.id)
  );
}

function hardwareAncestorKeys(
  entityType: EntityType | string,
  entityId: number,
  idx: HierarchyIndexes
): string[] {
  const keys: string[] = [];

  const component = idx.componentsById.get(entityId);
  const unit = idx.unitsById.get(entityId);
  const module = idx.modulesById.get(entityId);
  const subsystem = idx.subsystemsById.get(entityId);
  const system = idx.systemsById.get(entityId);

  let currentSystem: System | undefined;
  let currentProject: Project | undefined;

  if (entityType === EntityType.Component && component) {
    keys.push(entityScopeKey('component', component.id));
    const u = idx.unitsById.get(component.unit_id);
    if (u) {
      keys.push(entityScopeKey('unit', u.id));
      const m = idx.modulesById.get(u.module_id);
      if (m) {
        keys.push(entityScopeKey('module', m.id));
        const sub = idx.subsystemsById.get(m.subsystem_id);
        if (sub) {
          keys.push(entityScopeKey('subsystem', sub.id));
          currentSystem = idx.systemsById.get(sub.system_id);
        }
      }
    }
  } else if (entityType === EntityType.Unit && unit) {
    keys.push(entityScopeKey('unit', unit.id));
    const m = idx.modulesById.get(unit.module_id);
    if (m) {
      keys.push(entityScopeKey('module', m.id));
      const sub = idx.subsystemsById.get(m.subsystem_id);
      if (sub) {
        keys.push(entityScopeKey('subsystem', sub.id));
        currentSystem = idx.systemsById.get(sub.system_id);
      }
    }
  } else if (entityType === EntityType.Module && module) {
    keys.push(entityScopeKey('module', module.id));
    const sub = idx.subsystemsById.get(module.subsystem_id);
    if (sub) {
      keys.push(entityScopeKey('subsystem', sub.id));
      currentSystem = idx.systemsById.get(sub.system_id);
    }
  } else if (entityType === EntityType.Subsystem && subsystem) {
    keys.push(entityScopeKey('subsystem', subsystem.id));
    currentSystem = idx.systemsById.get(subsystem.system_id);
  } else if (entityType === EntityType.System && system) {
    keys.push(entityScopeKey('system', system.id));
    currentSystem = system;
  }

  if (currentSystem) {
    keys.push(entityScopeKey('system', currentSystem.id));
    currentProject = idx.projectsById.get(currentSystem.project_id);
  }

  if (currentProject) {
    keys.push(entityScopeKey('project', currentProject.id));
    if (currentProject.order_id) {
      keys.push(entityScopeKey('order', currentProject.order_id));
    }
  }

  return keys;
}

function hardwareDescendantKeys(
  entityType: EntityType | string,
  entityId: number,
  idx: HierarchyIndexes
): string[] {
  const keys: string[] = [];

  if (entityType === EntityType.System) {
    const subs = idx.subsystemsBySystemId.get(entityId) ?? [];
    for (const sub of subs) {
      keys.push(entityScopeKey('subsystem', sub.id));
      keys.push(...hardwareDescendantKeys(EntityType.Subsystem, sub.id, idx));
    }
  } else if (entityType === EntityType.Subsystem) {
    const mods = idx.modulesBySubsystemId.get(entityId) ?? [];
    for (const mod of mods) {
      keys.push(entityScopeKey('module', mod.id));
      keys.push(...hardwareDescendantKeys(EntityType.Module, mod.id, idx));
    }
  } else if (entityType === EntityType.Module) {
    const units = idx.unitsByModuleId.get(entityId) ?? [];
    for (const unit of units) {
      keys.push(entityScopeKey('unit', unit.id));
      keys.push(...hardwareDescendantKeys(EntityType.Unit, unit.id, idx));
    }
  } else if (entityType === EntityType.Unit) {
    const comps = idx.componentsByUnitId.get(entityId) ?? [];
    for (const comp of comps) {
      keys.push(entityScopeKey('component', comp.id));
    }
  }

  return keys;
}

function faultyEntityDescendantKeys(
  rootId: number,
  idx: HierarchyIndexes
): number[] {
  const children = idx.childrenByParentFaultId.get(rootId) ?? [];
  return children.flatMap((c) => [c.id, ...faultyEntityDescendantKeys(c.id, idx)]);
}

export function buildEntityFaultMap(input: {
  faultyEntities: FaultyEntity[];
  maintenanceCases: MaintenanceCase[];
  hierarchy: HierarchyData;
}): Map<string, FaultyEntityStatus> {
  const map = new Map<string, FaultyEntityStatus>();
  const openIds = openCaseIds(input.maintenanceCases);
  const idx = buildHierarchyIndexes(input.hierarchy, input.faultyEntities);

  const activeFaults = input.faultyEntities.filter(
    (fe) => openIds.has(fe.case_id) && !TERMINAL_STATUSES.has(fe.status)
  );

  for (const fe of activeFaults) {
    const status = fe.status as FaultyEntityStatus;
    mergeStatus(map, entityScopeKey(fe.entity_type, fe.entity_id), status);

    for (const key of hardwareAncestorKeys(fe.entity_type, fe.entity_id, idx)) {
      mergeStatus(map, key, status);
    }

    for (const key of hardwareDescendantKeys(fe.entity_type, fe.entity_id, idx)) {
      mergeStatus(map, key, FaultyEntityStatus.SUSPECTED);
    }

    for (const childFeId of faultyEntityDescendantKeys(fe.id, idx)) {
      const child = idx.faultyEntitiesById.get(childFeId);
      if (!child || !openIds.has(child.case_id) || TERMINAL_STATUSES.has(child.status)) continue;
      mergeStatus(map, entityScopeKey(child.entity_type, child.entity_id), child.status);
      for (const key of hardwareAncestorKeys(child.entity_type, child.entity_id, idx)) {
        mergeStatus(map, key, child.status);
      }
    }
  }

  return map;
}

export function getEntityFaultStatus(
  map: Map<string, FaultyEntityStatus>,
  type: EntityScopeType | EntityType | string,
  id: number
): FaultyEntityStatus | undefined {
  return map.get(entityScopeKey(type, id));
}

import type {
  ProjectProgress,
  ProjectProgressModuleNode,
  ProjectProgressSubsystemNode,
  ProjectProgressSystemNode,
  ProjectProgressUnitNode,
} from '@/lib/models';

export type EntityProgressSnapshot = {
  progress_pct: number;
  weight: number;
  verified_leaves: number;
  status?: string | null;
};

export type ProgressHardwareLevel =
  | 'system'
  | 'subsystem'
  | 'module'
  | 'unit'
  | 'component';

function toSnapshot(node: {
  progress_pct: number;
  weight: number;
  verified_leaves: number;
  status?: string | null;
}): EntityProgressSnapshot {
  return {
    progress_pct: node.progress_pct,
    weight: node.weight,
    verified_leaves: node.verified_leaves,
    status: node.status,
  };
}

/** Flatten Flight → SDLS → System nodes from a project progress snapshot. */
export function flattenProgressSystems(
  data?: ProjectProgress | null
): ProjectProgressSystemNode[] {
  if (!data) return [];
  return data.flights.flatMap((flight) =>
    flight.sdls.flatMap((sdls) => sdls.systems)
  );
}

function walkHardware(
  systems: ProjectProgressSystemNode[],
  visit: (level: ProgressHardwareLevel, node: { entity_id: number } & EntityProgressSnapshot) => void
) {
  for (const system of systems) {
    visit('system', { entity_id: system.entity_id, ...toSnapshot(system) });
    for (const subsystem of system.subsystems ?? []) {
      visit('subsystem', { entity_id: subsystem.entity_id, ...toSnapshot(subsystem) });
      for (const module of subsystem.modules ?? []) {
        visit('module', { entity_id: module.entity_id, ...toSnapshot(module) });
        for (const unit of module.units ?? []) {
          visit('unit', { entity_id: unit.entity_id, ...toSnapshot(unit) });
          for (const component of unit.components ?? []) {
            visit('component', {
              entity_id: component.entity_id,
              ...toSnapshot(component),
            });
          }
        }
      }
    }
  }
}

/** Index progress for one hardware level across the whole project tree. */
export function progressByEntityType(
  data: ProjectProgress | null | undefined,
  entityType: ProgressHardwareLevel
): Record<number, EntityProgressSnapshot> {
  const map: Record<number, EntityProgressSnapshot> = {};
  walkHardware(flattenProgressSystems(data), (level, node) => {
    if (level !== entityType) return;
    map[node.entity_id] = {
      progress_pct: node.progress_pct,
      weight: node.weight,
      verified_leaves: node.verified_leaves,
      status: node.status,
    };
  });
  return map;
}

/** Map system entity_id → progress for card display. */
export function systemProgressById(
  data?: ProjectProgress | null
): Record<number, EntityProgressSnapshot> {
  return progressByEntityType(data, 'system');
}

/** Map subsystem entity_id → progress for cards under a system. */
export function subsystemProgressById(
  data: ProjectProgress | null | undefined,
  systemId: number
): Record<number, EntityProgressSnapshot> {
  const map: Record<number, EntityProgressSnapshot> = {};
  const system = flattenProgressSystems(data).find((row) => row.entity_id === systemId);
  for (const subsystem of system?.subsystems ?? []) {
    map[subsystem.entity_id] = toSnapshot(subsystem);
  }
  return map;
}

function findSubsystem(
  data: ProjectProgress | null | undefined,
  subsystemId: number
): ProjectProgressSubsystemNode | undefined {
  for (const system of flattenProgressSystems(data)) {
    const match = (system.subsystems ?? []).find((row) => row.entity_id === subsystemId);
    if (match) return match;
  }
  return undefined;
}

function findModule(
  data: ProjectProgress | null | undefined,
  moduleId: number
): ProjectProgressModuleNode | undefined {
  for (const system of flattenProgressSystems(data)) {
    for (const subsystem of system.subsystems ?? []) {
      const match = (subsystem.modules ?? []).find((row) => row.entity_id === moduleId);
      if (match) return match;
    }
  }
  return undefined;
}

function findUnit(
  data: ProjectProgress | null | undefined,
  unitId: number
): ProjectProgressUnitNode | undefined {
  for (const system of flattenProgressSystems(data)) {
    for (const subsystem of system.subsystems ?? []) {
      for (const module of subsystem.modules ?? []) {
        const match = (module.units ?? []).find((row) => row.entity_id === unitId);
        if (match) return match;
      }
    }
  }
  return undefined;
}

/** Map module entity_id → progress for cards under a subsystem. */
export function moduleProgressById(
  data: ProjectProgress | null | undefined,
  subsystemId: number
): Record<number, EntityProgressSnapshot> {
  const map: Record<number, EntityProgressSnapshot> = {};
  for (const module of findSubsystem(data, subsystemId)?.modules ?? []) {
    map[module.entity_id] = toSnapshot(module);
  }
  return map;
}

/** Map unit entity_id → progress for cards under a module. */
export function unitProgressById(
  data: ProjectProgress | null | undefined,
  moduleId: number
): Record<number, EntityProgressSnapshot> {
  const map: Record<number, EntityProgressSnapshot> = {};
  for (const unit of findModule(data, moduleId)?.units ?? []) {
    map[unit.entity_id] = toSnapshot(unit);
  }
  return map;
}

/** Map component entity_id → progress for cards under a unit. */
export function componentProgressById(
  data: ProjectProgress | null | undefined,
  unitId: number
): Record<number, EntityProgressSnapshot> {
  const map: Record<number, EntityProgressSnapshot> = {};
  for (const component of findUnit(data, unitId)?.components ?? []) {
    map[component.entity_id] = toSnapshot(component);
  }
  return map;
}

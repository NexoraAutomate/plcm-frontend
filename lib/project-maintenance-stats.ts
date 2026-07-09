import type { Component, Module, Subsystem, System, Unit } from '@/lib/models';
import { isCurrentInstallEntity } from '@/lib/entity-replacement';
import { getSystemsForProject } from '@/lib/project-hierarchy-dashboard';
import { makeEntityKey } from '@/lib/resolution-history-matching';
import type { HierarchyEntityType } from '@/lib/system-hierarchy-graph';

export interface ReplacedEntityRef {
  type: HierarchyEntityType;
  entityId: number;
  name: string;
}

export function isReplacedHardwareEntity(entity: {
  replacement_sequence?: number;
  replaced_entity_id?: number | null;
}): boolean {
  return (entity.replacement_sequence ?? 0) > 0 || entity.replaced_entity_id != null;
}

export function collectProjectReplacedEntities(
  projectId: number,
  systems: System[],
  subsystems: Subsystem[],
  modules: Module[],
  units: Unit[],
  components: Component[]
): ReplacedEntityRef[] {
  const projectSystems = getSystemsForProject(systems, projectId);
  const systemIds = new Set(projectSystems.map((system) => system.id));
  const subsystemIds = new Set(
    subsystems.filter((item) => systemIds.has(item.system_id)).map((item) => item.id)
  );
  const moduleIds = new Set(
    modules.filter((item) => subsystemIds.has(item.subsystem_id)).map((item) => item.id)
  );
  const unitIds = new Set(
    units.filter((item) => moduleIds.has(item.module_id)).map((item) => item.id)
  );

  const replaced: ReplacedEntityRef[] = [];
  const seen = new Set<string>();

  const addIfReplaced = (
    type: HierarchyEntityType,
    entity: {
      id: number;
      name: string;
      replacement_sequence?: number;
      replaced_entity_id?: number | null;
      is_current_install?: boolean;
    }
  ) => {
    if (!isCurrentInstallEntity(entity)) return;

    const key = makeEntityKey(type, entity.id);
    if (!isReplacedHardwareEntity(entity)) return;
    if (seen.has(key)) return;

    seen.add(key);
    replaced.push({ type, entityId: entity.id, name: entity.name });
  };

  for (const system of projectSystems) {
    addIfReplaced('system', system);
  }

  for (const subsystem of subsystems) {
    if (!subsystemIds.has(subsystem.id)) continue;
    addIfReplaced('subsystem', subsystem);
  }

  for (const module of modules) {
    if (!moduleIds.has(module.id)) continue;
    addIfReplaced('module', module);
  }

  for (const unit of units) {
    if (!unitIds.has(unit.id)) continue;
    addIfReplaced('unit', unit);
  }

  for (const component of components) {
    if (!unitIds.has(component.unit_id)) continue;
    addIfReplaced('component', component);
  }

  return replaced;
}

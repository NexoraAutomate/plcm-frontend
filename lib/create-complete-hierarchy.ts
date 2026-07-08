import * as api from '@/lib/api';
import type { Hierarchy, Status } from '@/lib/models';

type HierarchyLevel = 'system' | 'subsystem' | 'module' | 'unit' | 'component';

const STATUS_TYPE_BY_LEVEL: Record<HierarchyLevel, string> = {
  system: 'systems',
  subsystem: 'subsystems',
  module: 'modules',
  unit: 'units',
  component: 'components',
};

export interface CreateCompleteHierarchyResult {
  systems: number;
  subsystems: number;
  modules: number;
  units: number;
  components: number;
}

function childrenOf(templates: Hierarchy[], parentId: number, level: HierarchyLevel): Hierarchy[] {
  return templates.filter(
    (entry) => entry.hierarchy_type === level && entry.parent_id === parentId
  );
}

function buildIdentifierBase(
  projectName: string,
  templateName: string,
  counters: Map<string, number>
): string {
  const trimmedProject = projectName.trim();
  const trimmedTemplate = templateName.trim();
  const key = trimmedTemplate.toLowerCase();
  const next = (counters.get(key) ?? 0) + 1;
  counters.set(key, next);
  const suffix = next > 1 ? `-${next}` : '';
  return `${trimmedProject}-${trimmedTemplate}${suffix}`;
}

function buildEntityFields(
  projectName: string,
  templateName: string,
  counters: Map<string, number>
) {
  const name = templateName.trim();
  const identifierBase = buildIdentifierBase(projectName, templateName, counters);

  return {
    name,
    description: 'Auto-created from Systems Hierarchy',
    part_number: `${identifierBase}-PN`,
    serial_number: identifierBase,
    configuration_item: `${identifierBase}-CI`,
  };
}

function firstStatusId(statuses: Status[], level: HierarchyLevel): number | undefined {
  const statusType = STATUS_TYPE_BY_LEVEL[level];
  return statuses.find((status) => status.status_type === statusType)?.id;
}

export async function createCompleteHierarchy(
  projectId: number,
  projectName: string
): Promise<CreateCompleteHierarchyResult> {
  const [hierarchyRes, statusesRes] = await Promise.all([
    api.hierarchies.list(),
    api.statuses.list(0, 500),
  ]);

  const templates = hierarchyRes.data ?? [];
  const statuses = statusesRes.data ?? [];
  const nameCounters = new Map<string, number>();

  const counts: CreateCompleteHierarchyResult = {
    systems: 0,
    subsystems: 0,
    modules: 0,
    units: 0,
    components: 0,
  };

  const systemTemplates = templates.filter((entry) => entry.hierarchy_type === 'system');
  if (systemTemplates.length === 0) {
    return counts;
  }

  for (const systemTemplate of systemTemplates) {
    const systemRes = await api.systems.create({
      ...buildEntityFields(projectName, systemTemplate.name, nameCounters),
      project_id: projectId,
      status_id: firstStatusId(statuses, 'system'),
    });
    const systemId = systemRes.data.id;
    counts.systems += 1;

    for (const subsystemTemplate of childrenOf(templates, systemTemplate.id, 'subsystem')) {
      const subsystemRes = await api.subsystems.create({
        ...buildEntityFields(projectName, subsystemTemplate.name, nameCounters),
        system_id: systemId,
        status_id: firstStatusId(statuses, 'subsystem'),
      });
      const subsystemId = subsystemRes.data.id;
      counts.subsystems += 1;

      for (const moduleTemplate of childrenOf(templates, subsystemTemplate.id, 'module')) {
        const moduleRes = await api.modules.create({
          ...buildEntityFields(projectName, moduleTemplate.name, nameCounters),
          subsystem_id: subsystemId,
          status_id: firstStatusId(statuses, 'module'),
        });
        const moduleId = moduleRes.data.id;
        counts.modules += 1;

        for (const unitTemplate of childrenOf(templates, moduleTemplate.id, 'unit')) {
          const unitRes = await api.units.create({
            ...buildEntityFields(projectName, unitTemplate.name, nameCounters),
            module_id: moduleId,
            status_id: firstStatusId(statuses, 'unit'),
          });
          const unitId = unitRes.data.id;
          counts.units += 1;

          for (const componentTemplate of childrenOf(templates, unitTemplate.id, 'component')) {
            const componentFields = buildEntityFields(
              projectName,
              componentTemplate.name,
              nameCounters
            );
            await api.components.create({
              ...componentFields,
              sku: `${componentFields.serial_number}-SKU`,
              unit_id: unitId,
              status_id: firstStatusId(statuses, 'component'),
            });
            counts.components += 1;
          }
        }
      }
    }
  }

  return counts;
}

export function summarizeHierarchyCounts(counts: CreateCompleteHierarchyResult): string {
  const parts = [
    counts.systems && `${counts.systems} system${counts.systems === 1 ? '' : 's'}`,
    counts.subsystems &&
      `${counts.subsystems} subsystem${counts.subsystems === 1 ? '' : 's'}`,
    counts.modules && `${counts.modules} module${counts.modules === 1 ? '' : 's'}`,
    counts.units && `${counts.units} unit${counts.units === 1 ? '' : 's'}`,
    counts.components &&
      `${counts.components} component${counts.components === 1 ? '' : 's'}`,
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(', ') : 'no hierarchy entries';
}

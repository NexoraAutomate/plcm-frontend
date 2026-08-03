import * as api from '@/lib/api';
import type { Hierarchy, Status, AppDefinitions } from '@/lib/models';
import {
  DEFAULT_APP_DEFINITIONS,
  applyIdentifierTemplate,
  buildEntityIdentifiersFromDefinitions,
  getEntityTypeLabel,
  type HierarchyEntityLevel,
} from '@/lib/app-definitions';

type HierarchyLevel = HierarchyEntityLevel;

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

function nextSeq(templateName: string, counters: Map<string, number>): number {
  const key = templateName.trim().toLowerCase();
  const next = (counters.get(key) ?? 0) + 1;
  counters.set(key, next);
  return next;
}

function asDefinitions(
  definitions: Partial<AppDefinitions> | typeof DEFAULT_APP_DEFINITIONS
): AppDefinitions {
  return { id: 0, ...DEFAULT_APP_DEFINITIONS, ...definitions } as AppDefinitions;
}

function buildEntityFields(
  projectName: string,
  template: { name: string; abbreviation?: string | null },
  counters: Map<string, number>,
  level: HierarchyLevel,
  definitions: AppDefinitions | typeof DEFAULT_APP_DEFINITIONS = DEFAULT_APP_DEFINITIONS
) {
  const name = template.name.trim();
  const seq = nextSeq(template.name, counters);
  const ids = buildEntityIdentifiersFromDefinitions(asDefinitions(definitions), {
    project: projectName,
    name,
    seq,
    pnSeq: seq,
    level,
    entityAbbr: template.abbreviation || undefined,
  });

  return {
    name,
    description: 'Auto-created from Systems Hierarchy',
    part_number: ids.part_number,
    serial_number: ids.serial_number,
    configuration_item: ids.configuration_item,
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
  const [hierarchyRes, statusesRes, definitionsRes] = await Promise.all([
    api.hierarchies.list(),
    api.statuses.list(0, 500),
    api.auth.getAppDefinitions().catch(() => ({ data: { id: 0, ...DEFAULT_APP_DEFINITIONS } })),
  ]);

  const templates = hierarchyRes.data ?? [];
  const statuses = statusesRes.data ?? [];
  const definitions = definitionsRes.data ?? { id: 0, ...DEFAULT_APP_DEFINITIONS };
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
      ...buildEntityFields(projectName, systemTemplate, nameCounters, 'system', definitions),
      project_id: projectId,
      status_id: firstStatusId(statuses, 'system'),
    });
    const systemId = systemRes.data.id;
    counts.systems += 1;

    for (const subsystemTemplate of childrenOf(templates, systemTemplate.id, 'subsystem')) {
      const subsystemRes = await api.subsystems.create({
        ...buildEntityFields(
          projectName,
          subsystemTemplate,
          nameCounters,
          'subsystem',
          definitions
        ),
        system_id: systemId,
        status_id: firstStatusId(statuses, 'subsystem'),
      });
      const subsystemId = subsystemRes.data.id;
      counts.subsystems += 1;

      for (const moduleTemplate of childrenOf(templates, subsystemTemplate.id, 'module')) {
        const moduleRes = await api.modules.create({
          ...buildEntityFields(
            projectName,
            moduleTemplate,
            nameCounters,
            'module',
            definitions
          ),
          subsystem_id: subsystemId,
          status_id: firstStatusId(statuses, 'module'),
        });
        const moduleId = moduleRes.data.id;
        counts.modules += 1;

        for (const unitTemplate of childrenOf(templates, moduleTemplate.id, 'unit')) {
          const unitRes = await api.units.create({
            ...buildEntityFields(projectName, unitTemplate, nameCounters, 'unit', definitions),
            module_id: moduleId,
            status_id: firstStatusId(statuses, 'unit'),
          });
          const unitId = unitRes.data.id;
          counts.units += 1;

          for (const componentTemplate of childrenOf(templates, unitTemplate.id, 'component')) {
            const componentFields = buildEntityFields(
              projectName,
              componentTemplate,
              nameCounters,
              'component',
              definitions
            );
            await api.components.create({
              ...componentFields,
              sku: applyIdentifierTemplate(definitions.sku_template, {
                project: projectName,
                name: componentTemplate.name.trim(),
                serial: componentFields.serial_number,
                level: 'component',
                levelLabel: getEntityTypeLabel(definitions, 'component'),
                entityAbbr: componentTemplate.abbreviation || undefined,
              }),
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

export function summarizeHierarchyCounts(
  counts: CreateCompleteHierarchyResult,
  definitions = DEFAULT_APP_DEFINITIONS
): string {
  const parts = [
    counts.systems &&
      `${counts.systems} ${getEntityTypeLabel(definitions, 'system', counts.systems !== 1)}`,
    counts.subsystems &&
      `${counts.subsystems} ${getEntityTypeLabel(definitions, 'subsystem', counts.subsystems !== 1)}`,
    counts.modules &&
      `${counts.modules} ${getEntityTypeLabel(definitions, 'module', counts.modules !== 1)}`,
    counts.units &&
      `${counts.units} ${getEntityTypeLabel(definitions, 'unit', counts.units !== 1)}`,
    counts.components &&
      `${counts.components} ${getEntityTypeLabel(definitions, 'component', counts.components !== 1)}`,
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(', ') : 'no hierarchy entries';
}

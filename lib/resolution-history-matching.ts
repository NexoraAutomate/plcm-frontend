import type {
  Component,
  ConfigurationHistory,
  FaultyEntity,
  MaintenanceCase,
  MaintenanceDelivery,
  Module,
  Subsystem,
  System,
  Unit,
} from '@/lib/models';
import {
  CaseStatus,
  DeliveryStatus,
  FaultyEntityStatus,
  ResolutionType,
} from '@/lib/models';
import {
  collectSubtreeEntities,
  collectSubtreeFromNode,
  getSystemsForProject,
  type SubtreeEntityRef,
} from '@/lib/project-hierarchy-dashboard';
import type { HierarchyEntityType } from '@/lib/system-hierarchy-graph';
import * as api from '@/lib/api';
import { ABSOLUTE_FETCH_CAP, fetchCappedPages } from '@/lib/data-loading';
import { resolveEntityId } from '@/lib/entity-resolver';
import { formatUserRef } from '@/lib/user-display';

export interface SubtreeMatchContext {
  refs: SubtreeEntityRef[];
  entityKeys: Set<string>;
  partNumbers: Set<string>;
  serialNumbers: Set<string>;
}

export type LifecycleTimelineEventKind =
  | 'installation'
  | 'resolution'
  | 'removal'
  | 'delivery';

export interface LifecycleTimelineEvent {
  id: string;
  kind: LifecycleTimelineEventKind;
  title: string;
  date: string;
  entityLabel: string;
  entityType?: HierarchyEntityType;
  entityPk?: number;
  details?: string;
  performedByLabel?: string;
  maintenanceCaseId?: number;
}

const FAULTY_ENTITY_ID_OFFSET = 1_000_000_000;
const MAINTENANCE_CASE_ID_OFFSET = 2_000_000_000;

export const PROJECT_RESOLUTION_CACHE_VERSION = 9;

const ENTITY_TYPE_ORDER: Record<HierarchyEntityType, number> = {
  system: 0,
  subsystem: 1,
  module: 2,
  unit: 3,
  component: 4,
};

export function makeEntityKey(type: string, pk: number) {
  return `${type.toLowerCase()}:${pk}`;
}

function entityKey(type: string, pk: number) {
  return makeEntityKey(type, pk);
}

function normalizeIdentifier(value?: string | null) {
  return value?.trim().toLowerCase() ?? '';
}

function addIdentifier(target: Set<string>, value?: string | null) {
  const normalized = normalizeIdentifier(value);
  if (normalized) target.add(normalized);
}

function identifiersMatch(contextValues: Set<string>, value?: string | null) {
  const normalized = normalizeIdentifier(value);
  return normalized ? contextValues.has(normalized) : false;
}

export function buildMatchContextFromRefs(refs: SubtreeEntityRef[]): SubtreeMatchContext {
  const entityKeys = new Set(refs.map((ref) => entityKey(ref.type, ref.pk)));
  const partNumbers = new Set<string>();
  const serialNumbers = new Set<string>();

  for (const ref of refs) {
    addIdentifier(partNumbers, ref.part_number);
    addIdentifier(serialNumbers, ref.serial_number);
  }

  return { refs, entityKeys, partNumbers, serialNumbers };
}

export function buildSubtreeMatchContext(
  systemId: number,
  systems: System[],
  subsystems: Subsystem[],
  modules: Module[],
  units: Unit[],
  components: Component[]
): SubtreeMatchContext {
  const refs = collectSubtreeEntities(
    systemId,
    systems,
    subsystems,
    modules,
    units,
    components
  );

  return buildMatchContextFromRefs(refs);
}

export function buildProjectMatchContext(
  projectId: number,
  systems: System[],
  subsystems: Subsystem[],
  modules: Module[],
  units: Unit[],
  components: Component[]
): SubtreeMatchContext {
  const refs = getSystemsForProject(systems, projectId).flatMap((system) =>
    collectSubtreeEntities(system.id, systems, subsystems, modules, units, components)
  );

  return buildMatchContextFromRefs(refs);
}

export function buildNodeMatchContext(
  nodeType: HierarchyEntityType,
  nodePk: number,
  systems: System[],
  subsystems: Subsystem[],
  modules: Module[],
  units: Unit[],
  components: Component[]
): SubtreeMatchContext {
  const refs = collectSubtreeFromNode(
    nodeType,
    nodePk,
    systems,
    subsystems,
    modules,
    units,
    components
  );

  return buildMatchContextFromRefs(refs);
}

function getAncestorEntityKeys(
  type: HierarchyEntityType,
  pk: number,
  systems: System[],
  subsystems: Subsystem[],
  modules: Module[],
  units: Unit[],
  components: Component[]
): string[] {
  const keys = [entityKey(type, pk)];

  if (type === 'component') {
    const component = components.find((item) => item.id === pk);
    if (component) {
      keys.push(
        ...getAncestorEntityKeys('unit', component.unit_id, systems, subsystems, modules, units, components)
      );
    }
    return keys;
  }

  if (type === 'unit') {
    const unit = units.find((item) => item.id === pk);
    if (unit) {
      keys.push(
        ...getAncestorEntityKeys('module', unit.module_id, systems, subsystems, modules, units, components)
      );
    }
    return keys;
  }

  if (type === 'module') {
    const module = modules.find((item) => item.id === pk);
    if (module) {
      keys.push(
        ...getAncestorEntityKeys(
          'subsystem',
          module.subsystem_id,
          systems,
          subsystems,
          modules,
          units,
          components
        )
      );
    }
    return keys;
  }

  if (type === 'subsystem') {
    const subsystem = subsystems.find((item) => item.id === pk);
    if (subsystem) {
      keys.push(
        ...getAncestorEntityKeys(
          'system',
          subsystem.system_id,
          systems,
          subsystems,
          modules,
          units,
          components
        )
      );
    }
    return keys;
  }

  return keys;
}

export function filterHistoryBadgeRecords(records: ConfigurationHistory[]) {
  return records.filter((record) => {
    if (!record.resolution_type) return false;
    if (record.resolution_type === ResolutionType.NO_FAULT_FOUND) return false;
    return true;
  });
}

export function filterReplacementRecords(records: ConfigurationHistory[]) {
  return records.filter((record) => record.resolution_type === ResolutionType.REPLACED);
}

export function entityTypeForRecord(
  record: ConfigurationHistory,
  matchContext: SubtreeMatchContext,
  subtreeByEntityId: Map<number, SubtreeEntityRef>
): HierarchyEntityType | undefined {
  return subtreeRefForRecord(record, matchContext, subtreeByEntityId)?.type;
}

export function sortRecordsByTimeAndEntityType(
  records: ConfigurationHistory[],
  matchContext: SubtreeMatchContext,
  subtreeByEntityId: Map<number, SubtreeEntityRef>
) {
  return [...records].sort((a, b) => {
    const timeDiff = new Date(a.change_date).getTime() - new Date(b.change_date).getTime();
    if (timeDiff !== 0) return timeDiff;

    const typeA =
      ENTITY_TYPE_ORDER[entityTypeForRecord(a, matchContext, subtreeByEntityId) ?? 'component'];
    const typeB =
      ENTITY_TYPE_ORDER[entityTypeForRecord(b, matchContext, subtreeByEntityId) ?? 'component'];
    if (typeA !== typeB) return typeA - typeB;

    return entityLabelForHistory(a, matchContext, subtreeByEntityId).localeCompare(
      entityLabelForHistory(b, matchContext, subtreeByEntityId)
    );
  });
}

function sortLifecycleEvents(events: LifecycleTimelineEvent[]) {
  return [...events].sort((a, b) => {
    const timeDiff = new Date(a.date).getTime() - new Date(b.date).getTime();
    if (timeDiff !== 0) return timeDiff;

    const typeA = a.entityType ? ENTITY_TYPE_ORDER[a.entityType] : 99;
    const typeB = b.entityType ? ENTITY_TYPE_ORDER[b.entityType] : 99;
    if (typeA !== typeB) return typeA - typeB;

    return a.entityLabel.localeCompare(b.entityLabel);
  });
}

export function buildNodesWithResolutionHistory(
  records: ConfigurationHistory[],
  matchContext: SubtreeMatchContext,
  subtreeByEntityId: Map<number, SubtreeEntityRef>,
  systems: System[],
  subsystems: Subsystem[],
  modules: Module[],
  units: Unit[],
  components: Component[]
) {
  const keys = new Set<string>();

  for (const record of filterHistoryBadgeRecords(records)) {
    const ref = subtreeRefForRecord(record, matchContext, subtreeByEntityId);
    if (!ref) continue;

    for (const key of getAncestorEntityKeys(
      ref.type,
      ref.pk,
      systems,
      subsystems,
      modules,
      units,
      components
    )) {
      keys.add(key);
    }
  }

  return keys;
}

export function filterRecordsForNode(
  records: ConfigurationHistory[],
  nodeType: HierarchyEntityType,
  nodePk: number,
  systems: System[],
  subsystems: Subsystem[],
  modules: Module[],
  units: Unit[],
  components: Component[],
  resolvedEntityIds: Set<number>,
  subtreeByEntityId: Map<number, SubtreeEntityRef>
) {
  const nodeContext = buildNodeMatchContext(
    nodeType,
    nodePk,
    systems,
    subsystems,
    modules,
    units,
    components
  );

  return sortRecordsByTimeAndEntityType(
    filterReplacementRecords(
      records.filter((record) =>
        recordMatchesNodeSubtree(record, nodeContext, subtreeByEntityId)
      )
    ),
    nodeContext,
    subtreeByEntityId
  );
}

export function recordMatchesNodeSubtree(
  record: ConfigurationHistory,
  nodeContext: SubtreeMatchContext,
  subtreeByEntityId: Map<number, SubtreeEntityRef>
): boolean {
  const ref = subtreeRefForRecord(record, nodeContext, subtreeByEntityId);
  if (ref) {
    return nodeContext.entityKeys.has(entityKey(ref.type, ref.pk));
  }

  const embedded = record.entity;
  if (embedded?.entity_pk != null && embedded.entity_type) {
    if (nodeContext.entityKeys.has(entityKey(embedded.entity_type, embedded.entity_pk))) {
      return true;
    }
  }

  const partValues = [record.old_part_number, record.new_part_number];
  if (partValues.some((value) => identifiersMatch(nodeContext.partNumbers, value))) {
    return true;
  }

  const serialValues = [record.old_serial_number, record.new_serial_number];
  if (serialValues.some((value) => identifiersMatch(nodeContext.serialNumbers, value))) {
    return true;
  }

  return false;
}

export interface ProjectResolutionHistoryData {
  records: ConfigurationHistory[];
  matchContext: SubtreeMatchContext;
  resolvedEntityIds: Set<number>;
  subtreeByEntityId: Map<number, SubtreeEntityRef>;
  nodesWithHistory: Set<string>;
}

export async function loadResolutionHistoryForProject(
  projectId: number,
  systems: System[],
  subsystems: Subsystem[],
  modules: Module[],
  units: Unit[],
  components: Component[]
): Promise<ProjectResolutionHistoryData> {
  const matchContext = buildProjectMatchContext(
    projectId,
    systems,
    subsystems,
    modules,
    units,
    components
  );

  const entityIdEntries = await Promise.all(
    matchContext.refs.map(async (ref) => {
      const entityId = await resolveEntityId(ref.type, ref.pk);
      return entityId ? ([entityId, ref] as const) : null;
    })
  );

  const subtreeByEntityId = new Map<number, SubtreeEntityRef>();
  const resolvedEntityIds = new Set<number>();

  for (const entry of entityIdEntries) {
    if (!entry) continue;
    const [entityId, ref] = entry;
    subtreeByEntityId.set(entityId, ref);
    resolvedEntityIds.add(entityId);
  }

  const records = await loadConfigurationHistoryForSubtree(
    matchContext,
    resolvedEntityIds,
    projectId,
    subtreeByEntityId
  );

  const nodesWithHistory = buildNodesWithResolutionHistory(
    records,
    matchContext,
    subtreeByEntityId,
    systems,
    subsystems,
    modules,
    units,
    components
  );

  return {
    records,
    matchContext,
    resolvedEntityIds,
    subtreeByEntityId,
    nodesWithHistory,
  };
}

export function subtreeRefForRecord(
  record: ConfigurationHistory,
  context: SubtreeMatchContext,
  subtreeByEntityId: Map<number, SubtreeEntityRef>
): SubtreeEntityRef | undefined {
  const byGenericId = record.entity_id
    ? subtreeByEntityId.get(record.entity_id)
    : undefined;
  if (byGenericId) return byGenericId;

  const embedded = record.entity;
  if (embedded?.entity_pk != null && embedded.entity_type) {
    const normalizedType = embedded.entity_type.toLowerCase();
    const byEmbedded = context.refs.find(
      (ref) => ref.type === normalizedType && ref.pk === embedded.entity_pk
    );
    if (byEmbedded) return byEmbedded;
  }

  if (record.entity_id && embedded?.entity_type) {
    const normalizedType = embedded.entity_type.toLowerCase();
    const byPkAndType = context.refs.find(
      (ref) => ref.pk === record.entity_id && ref.type === normalizedType
    );
    if (byPkAndType) return byPkAndType;
  }

  return undefined;
}

export function entityLabelForHistory(
  record: ConfigurationHistory,
  context: SubtreeMatchContext,
  subtreeByEntityId: Map<number, SubtreeEntityRef>
) {
  const subtreeRef = subtreeRefForRecord(record, context, subtreeByEntityId);
  return (
    subtreeRef?.name ||
    record.entity?.display_name ||
    (record.entity_id ? `Entity #${record.entity_id}` : 'Unknown')
  );
}

export function entityKeyForRecord(
  record: ConfigurationHistory,
  context: SubtreeMatchContext,
  subtreeByEntityId: Map<number, SubtreeEntityRef>
) {
  const subtreeRef = subtreeRefForRecord(record, context, subtreeByEntityId);
  return subtreeRef ? makeEntityKey(subtreeRef.type, subtreeRef.pk) : undefined;
}

function performerLabel(
  record: ConfigurationHistory,
  userLabelsById?: Map<number, string>
) {
  if (record.performed_by_user) {
    return formatUserRef(record.performed_by_user);
  }
  if (record.performed_by && userLabelsById?.has(record.performed_by)) {
    return userLabelsById.get(record.performed_by);
  }
  if (record.performed_by) {
    return `User #${record.performed_by}`;
  }
  return undefined;
}

export function configurationHistoryMatchesSubtree(
  record: ConfigurationHistory,
  context: SubtreeMatchContext,
  resolvedEntityIds: Set<number>,
  caseIdsTouchingSubtree?: Set<number>,
  subtreeByEntityId?: Map<number, SubtreeEntityRef>
) {
  if (
    record.maintenance_case_id &&
    caseIdsTouchingSubtree?.has(record.maintenance_case_id)
  ) {
    return true;
  }

  if (subtreeByEntityId) {
    const ref = subtreeByEntityId.get(record.entity_id);
    if (ref && context.entityKeys.has(entityKey(ref.type, ref.pk))) {
      return true;
    }
  } else if (resolvedEntityIds.has(record.entity_id)) {
    return true;
  }

  const embedded = record.entity;
  if (embedded?.entity_pk != null && embedded.entity_type) {
    if (context.entityKeys.has(entityKey(embedded.entity_type, embedded.entity_pk))) {
      return true;
    }
  }

  const partValues = [record.old_part_number, record.new_part_number];
  if (partValues.some((value) => identifiersMatch(context.partNumbers, value))) return true;

  const serialValues = [record.old_serial_number, record.new_serial_number];
  if (serialValues.some((value) => identifiersMatch(context.serialNumbers, value))) {
    return true;
  }

  return false;
}

function faultyEntityMatchesSubtree(faultyEntity: FaultyEntity, context: SubtreeMatchContext) {
  return context.entityKeys.has(entityKey(faultyEntity.entity_type, faultyEntity.entity_id));
}

function maintenanceCaseMatchesSubtree(
  maintenanceCase: MaintenanceCase,
  context: SubtreeMatchContext
) {
  return context.entityKeys.has(
    entityKey(maintenanceCase.entity_type, maintenanceCase.entity_id)
  );
}

function findSubtreeRef(
  context: SubtreeMatchContext,
  type: string,
  pk: number,
  fallbackName?: string
): SubtreeEntityRef {
  return (
    context.refs.find((ref) => ref.type === type.toLowerCase() && ref.pk === pk) ?? {
      type: type.toLowerCase() as SubtreeEntityRef['type'],
      pk,
      name: fallbackName ?? 'Unknown',
    }
  );
}

function inferResolutionType(faultyEntity: FaultyEntity): ResolutionType {
  if (faultyEntity.resolution_type) return faultyEntity.resolution_type;

  if (
    faultyEntity.status === FaultyEntityStatus.NO_FAULT_FOUND ||
    faultyEntity.status === FaultyEntityStatus.HEALTHY ||
    faultyEntity.status === FaultyEntityStatus.FALSEPOSITIVE
  ) {
    return ResolutionType.NO_FAULT_FOUND;
  }

  if (faultyEntity.status === FaultyEntityStatus.UNDER_INSPECTION) {
    return ResolutionType.NO_FAULT_FOUND;
  }

  if (faultyEntity.status === FaultyEntityStatus.CONFIRMED_FAULTY) {
    return ResolutionType.REPAIRED;
  }

  return ResolutionType.REPAIRED;
}

function inferCaseResolutionType(maintenanceCase: MaintenanceCase): ResolutionType {
  switch (maintenanceCase.status) {
    case CaseStatus.Resolved:
    case CaseStatus.Closed:
    case CaseStatus.UnderRepair:
      return ResolutionType.REPAIRED;
    case CaseStatus.UnderInspection:
      return ResolutionType.NO_FAULT_FOUND;
    default:
      return ResolutionType.REPAIRED;
  }
}

function faultyEntityToConfigurationHistory(
  faultyEntity: FaultyEntity,
  ref: SubtreeEntityRef
): ConfigurationHistory {
  const resolutionType = inferResolutionType(faultyEntity);

  return {
    id: FAULTY_ENTITY_ID_OFFSET + faultyEntity.id,
    entity_id: faultyEntity.entity_id,
    maintenance_case_id: faultyEntity.case_id,
    performed_by: faultyEntity.identified_by,
    change_date: faultyEntity.resolved_at ?? faultyEntity.updated_at ?? faultyEntity.identified_at,
    resolution_type: resolutionType,
    fault_type: faultyEntity.fault_type ?? undefined,
    old_part_number: faultyEntity.part_number,
    new_part_number:
      resolutionType === ResolutionType.REPLACED ? faultyEntity.part_number : undefined,
    old_serial_number: faultyEntity.serial_number,
    reason: faultyEntity.fault_description ?? undefined,
    remarks: faultyEntity.investigation_notes ?? undefined,
    entity: {
      id: 0,
      entity_type: faultyEntity.entity_type,
      entity_pk: faultyEntity.entity_id,
      display_name: ref.name,
      status_id: 0,
      created_at: faultyEntity.created_at,
    },
  };
}

function maintenanceCaseToHistoryRecord(
  maintenanceCase: MaintenanceCase,
  ref: SubtreeEntityRef
): ConfigurationHistory {
  return {
    id: MAINTENANCE_CASE_ID_OFFSET + maintenanceCase.id,
    entity_id: maintenanceCase.entity_id,
    maintenance_case_id: maintenanceCase.id,
    performed_by: 0,
    change_date: maintenanceCase.resolved_at ?? maintenanceCase.reported_at,
    resolution_type: inferCaseResolutionType(maintenanceCase),
    old_part_number: maintenanceCase.part_number,
    reason: `case_status:${maintenanceCase.status}`,
    remarks: maintenanceCase.description,
    entity: {
      id: 0,
      entity_type: maintenanceCase.entity_type,
      entity_pk: maintenanceCase.entity_id,
      display_name: ref.name,
      status_id: 0,
      created_at: maintenanceCase.created_at,
    },
  };
}

export async function loadAllConfigurationHistory() {
  return fetchCappedPages(
    (skip, limit) => api.configurationHistory.list(skip, limit),
    { pageSize: 500, maxItems: ABSOLUTE_FETCH_CAP }
  );
}

async function loadMaintenanceCasesForProject(projectId: number) {
  const matched: MaintenanceCase[] = [];
  const pageSize = 500;
  let skip = 0;

  while (skip < ABSOLUTE_FETCH_CAP) {
    const remaining = ABSOLUTE_FETCH_CAP - skip;
    const limit = Math.min(pageSize, remaining);
    const res = await api.maintenanceCases.list(skip, limit);
    const page = res.data ?? [];
    matched.push(...page.filter((maintenanceCase) => maintenanceCase.project_id === projectId));
    if (page.length < limit) break;
    skip += page.length;
  }

  return matched;
}

async function loadConfigurationHistoryForProjectCases(projectId?: number) {
  if (!projectId) return [];

  const cases = await loadMaintenanceCasesForProject(projectId);

  const pages = await Promise.all(
    cases.map(async (maintenanceCase) => {
      try {
        const res = await api.configurationHistory.listByCaseId(maintenanceCase.id, 0, 500);
        return res.data ?? [];
      } catch {
        return [];
      }
    })
  );

  return pages.flat();
}

async function loadProjectMaintenanceFromCases(
  projectId: number | undefined,
  context: SubtreeMatchContext
) {
  if (!projectId) {
    return {
      pendingFaultyEntities: [] as Array<{ faultyEntity: FaultyEntity; ref: SubtreeEntityRef }>,
      caseRecords: [] as ConfigurationHistory[],
      caseIdsTouchingSubtree: new Set<number>(),
    };
  }

  const cases = await loadMaintenanceCasesForProject(projectId);

  const pendingFaultyEntities: Array<{ faultyEntity: FaultyEntity; ref: SubtreeEntityRef }> = [];
  const caseRecords: ConfigurationHistory[] = [];
  const caseIdsTouchingSubtree = new Set<number>();

  const entitiesByCase = await Promise.all(
    cases.map(async (maintenanceCase) => {
      try {
        const res = await api.faultyEntities.listByCaseId(maintenanceCase.id, 0, 500);
        return { maintenanceCase, faultyEntities: res.data ?? [] };
      } catch {
        return { maintenanceCase, faultyEntities: [] as FaultyEntity[] };
      }
    })
  );

  for (const { maintenanceCase, faultyEntities } of entitiesByCase) {
    const subtreeFaultyEntities = faultyEntities.filter((faultyEntity) =>
      faultyEntityMatchesSubtree(faultyEntity, context)
    );

    const caseTouchesSubtree =
      maintenanceCaseMatchesSubtree(maintenanceCase, context) ||
      subtreeFaultyEntities.length > 0;

    if (!caseTouchesSubtree) continue;

    caseIdsTouchingSubtree.add(maintenanceCase.id);

    for (const faultyEntity of subtreeFaultyEntities) {
      const ref = findSubtreeRef(
        context,
        faultyEntity.entity_type,
        faultyEntity.entity_id,
        faultyEntity.entity_name
      );
      pendingFaultyEntities.push({ faultyEntity, ref });
    }

    const caseRef = findSubtreeRef(
      context,
      maintenanceCase.entity_type,
      maintenanceCase.entity_id,
      maintenanceCase.case_number
        ? `Case ${maintenanceCase.case_number}`
        : maintenanceCase.part_number
    );
    caseRecords.push(maintenanceCaseToHistoryRecord(maintenanceCase, caseRef));
  }

  return { pendingFaultyEntities, caseRecords, caseIdsTouchingSubtree };
}

function realRecordCoversFaultyEntity(
  realRecords: ConfigurationHistory[],
  faultyEntity: FaultyEntity
): boolean {
  return realRecords.some((record) => {
    if (record.faulty_entity_id === faultyEntity.id) return true;
    if (record.maintenance_case_id !== faultyEntity.case_id) return false;

    const embedded = record.entity;
    if (
      embedded?.entity_pk != null &&
      embedded.entity_type?.toLowerCase() === faultyEntity.entity_type.toLowerCase() &&
      embedded.entity_pk === faultyEntity.entity_id
    ) {
      return true;
    }

    return false;
  });
}

function mergeResolutionRecords(...recordGroups: ConfigurationHistory[][]) {
  const byId = new Map<number, ConfigurationHistory>();

  for (const group of recordGroups) {
    for (const record of group) {
      byId.set(record.id, record);
    }
  }

  return [...byId.values()].sort(
    (a, b) => new Date(b.change_date).getTime() - new Date(a.change_date).getTime()
  );
}

export async function loadConfigurationHistoryForSubtree(
  context: SubtreeMatchContext,
  resolvedEntityIds: Set<number>,
  projectId?: number,
  subtreeByEntityId?: Map<number, SubtreeEntityRef>
) {
  const projectMaintenance = await loadProjectMaintenanceFromCases(projectId, context);
  const { caseIdsTouchingSubtree } = projectMaintenance;

  const [allRecords, projectCaseRecords, supplementalPages] = await Promise.all([
    loadAllConfigurationHistory().catch(() => []),
    loadConfigurationHistoryForProjectCases(projectId),
    Promise.all(
      [...resolvedEntityIds].map(async (entityId) => {
        try {
          const res = await api.configurationHistory.listByEntityID(entityId, 0, 500);
          return res.data ?? [];
        } catch {
          return [];
        }
      })
    ),
  ]);

  const byId = new Map<number, ConfigurationHistory>();
  for (const record of [
    ...allRecords,
    ...projectCaseRecords,
    ...supplementalPages.flat(),
  ]) {
    byId.set(record.id, record);
  }

  const configurationRecords = [...byId.values()].filter((record) =>
    configurationHistoryMatchesSubtree(
      record,
      context,
      resolvedEntityIds,
      caseIdsTouchingSubtree,
      subtreeByEntityId
    )
  );

  const syntheticFaultyRecords = projectMaintenance.pendingFaultyEntities
    .filter(
      ({ faultyEntity }) => !realRecordCoversFaultyEntity(configurationRecords, faultyEntity)
    )
    .map(({ faultyEntity, ref }) =>
      faultyEntityToConfigurationHistory(faultyEntity, ref)
    );

  return mergeResolutionRecords(
    configurationRecords,
    syntheticFaultyRecords,
    projectMaintenance.caseRecords
  );
}

export function countReplacements(records: ConfigurationHistory[]) {
  return records.filter((record) => record.resolution_type === ResolutionType.REPLACED)
    .length;
}

export function formatResolutionLabel(record: ConfigurationHistory) {
  if (record.reason?.startsWith('case_status:')) {
    const status = record.reason.replace('case_status:', '');
    return `Case ${status.replace(/_/g, ' ')}`;
  }

  return record.resolution_type.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

function resolutionDetails(record: ConfigurationHistory) {
  const parts: string[] = [];

  if (record.old_part_number || record.new_part_number) {
    parts.push(
      `Part #: ${record.old_part_number || '—'} → ${record.new_part_number || '—'}`
    );
  }

  if (record.old_serial_number || record.new_serial_number) {
    parts.push(
      `Serial #: ${record.old_serial_number || '—'} → ${record.new_serial_number || '—'}`
    );
  }

  if (record.corrective_action) {
    parts.push(record.corrective_action);
  } else if (record.reason) {
    parts.push(record.reason);
  }

  return parts.length > 0 ? parts.join(' · ') : undefined;
}

export async function loadDeliveriesForCases(caseIds: number[]) {
  const uniqueCaseIds = [...new Set(caseIds.filter((id) => id > 0))];
  if (uniqueCaseIds.length === 0) return [];

  const deliveriesByCase = await Promise.all(
    uniqueCaseIds.map(async (caseId) => {
      try {
        const res = await api.maintenanceDeliveries.listByCaseId(caseId, 0, 100);
        return res.data ?? [];
      } catch {
        return [];
      }
    })
  );

  return deliveriesByCase.flat();
}

export function buildLifecycleTimelineEvents(
  records: ConfigurationHistory[],
  matchContext: SubtreeMatchContext,
  subtreeByEntityId: Map<number, SubtreeEntityRef>,
  options?: {
    installationRefs?: SubtreeEntityRef[];
    entityFilterKey?: string;
    userLabelsById?: Map<number, string>;
  }
): LifecycleTimelineEvent[] {
  const events: LifecycleTimelineEvent[] = [];
  const installationRefs = options?.installationRefs ?? matchContext.refs;
  const entityFilterKey = options?.entityFilterKey;
  const userLabelsById = options?.userLabelsById;

  const scopedRefs = entityFilterKey
    ? installationRefs.filter((ref) => makeEntityKey(ref.type, ref.pk) === entityFilterKey)
    : installationRefs;

  const replacementRecords = filterReplacementRecords(
    entityFilterKey
      ? records.filter(
          (record) =>
            entityKeyForRecord(record, matchContext, subtreeByEntityId) === entityFilterKey
        )
      : records
  );

  type InstallationInfo = {
    date: string;
    label: string;
    performedBy?: string;
    partNumber?: string;
  };

  const installationByEntity = new Map<string, InstallationInfo>();

  for (const ref of scopedRefs) {
    const installDate = ref.installation_date ?? ref.created_at;
    if (!installDate) continue;
    installationByEntity.set(makeEntityKey(ref.type, ref.pk), {
      date: installDate,
      label: ref.name,
      performedBy: ref.installed_by_id
        ? userLabelsById?.get(ref.installed_by_id)
        : undefined,
      partNumber: ref.original_part_number ?? ref.part_number,
    });
  }

  for (const record of replacementRecords) {
    const recordKey = entityKeyForRecord(record, matchContext, subtreeByEntityId);
    if (!recordKey || !record.installation_date) continue;

    const label = entityLabelForHistory(record, matchContext, subtreeByEntityId);
    const performedBy = performerLabel(record, userLabelsById);
    const existing = installationByEntity.get(recordKey);
    const recordDate = new Date(record.installation_date);
    const existingDate = existing ? new Date(existing.date) : null;

    if (!existing || recordDate < (existingDate ?? recordDate)) {
      installationByEntity.set(recordKey, {
        date: record.installation_date,
        label,
        performedBy,
        partNumber: record.new_part_number ?? undefined,
      });
    } else if (existing) {
      if (!existing.performedBy && performedBy) existing.performedBy = performedBy;
      if (!existing.partNumber && record.new_part_number) {
        existing.partNumber = record.new_part_number;
      }
    }
  }

  for (const [key, info] of installationByEntity) {
    const ref = scopedRefs.find((item) => makeEntityKey(item.type, item.pk) === key);
    const details = [
      info.partNumber ? `Part #: ${info.partNumber}` : null,
      info.performedBy ? `Installed by ${info.performedBy}` : 'Installed at initial system build',
    ]
      .filter(Boolean)
      .join(' · ');

    events.push({
      id: `installation-${key}`,
      kind: 'installation',
      title: 'Initial Installation',
      date: info.date,
      entityLabel: info.label,
      entityType: ref?.type,
      performedByLabel: info.performedBy,
      details,
    });
  }

  for (const record of replacementRecords) {
    const entityLabel = entityLabelForHistory(record, matchContext, subtreeByEntityId);
    const entityType = entityTypeForRecord(record, matchContext, subtreeByEntityId);

    events.push({
      id: `resolution-${record.id}`,
      kind: 'resolution',
      title: 'Replaced',
      date: record.change_date,
      entityLabel,
      entityType,
      performedByLabel: performerLabel(record, userLabelsById),
      details: resolutionDetails(record),
      maintenanceCaseId: record.maintenance_case_id ?? undefined,
    });
  }

  return sortLifecycleEvents(events);
}

export function buildInstallTimelineForNode(
  installationRefs: SubtreeEntityRef[],
  options?: {
    userLabelsById?: Map<number, string>;
    deliveries?: MaintenanceDelivery[];
  }
): LifecycleTimelineEvent[] {
  const userLabelsById = options?.userLabelsById;
  const deliveries = options?.deliveries ?? [];
  const events: LifecycleTimelineEvent[] = [];

  const sortedRefs = [...installationRefs].sort((a, b) => {
    const levelA = ENTITY_TYPE_ORDER[a.type];
    const levelB = ENTITY_TYPE_ORDER[b.type];
    if (levelA !== levelB) return levelA - levelB;
    return a.name.localeCompare(b.name);
  });

  for (const ref of sortedRefs) {
    const installDate = ref.installation_date ?? ref.created_at;
    if (!installDate) continue;

    const installedBy = ref.installed_by_id
      ? userLabelsById?.get(ref.installed_by_id)
      : undefined;

    const partNumber = ref.original_part_number ?? ref.part_number;
    const serialNumber = ref.original_serial_number ?? ref.serial_number;

    const relatedDelivery = deliveries.find((delivery) => delivery.delivered_at);
    const deliveryDate = relatedDelivery?.delivered_at;

    const details = [
      partNumber ? `Original Part #: ${partNumber}` : null,
      serialNumber ? `Original Serial #: ${serialNumber}` : null,
      installedBy ? `Installed by ${installedBy}` : null,
      deliveryDate ? `Delivery: ${new Date(deliveryDate).toLocaleString()}` : null,
    ]
      .filter(Boolean)
      .join(' · ');

    events.push({
      id: `install-${ref.type}-${ref.pk}`,
      kind: 'installation',
      title: `${ref.type.charAt(0).toUpperCase()}${ref.type.slice(1)} Installed`,
      date: installDate,
      entityLabel: ref.name,
      entityType: ref.type,
      entityPk: ref.pk,
      performedByLabel: installedBy,
      details: details || undefined,
    });

    if (deliveryDate && deliveryDate !== installDate) {
      events.push({
        id: `delivery-${ref.type}-${ref.pk}`,
        kind: 'delivery',
        title: 'Delivered',
        date: deliveryDate,
        entityLabel: ref.name,
        entityType: ref.type,
        entityPk: ref.pk,
        details: relatedDelivery?.received_by
          ? `Received by ${relatedDelivery.received_by}`
          : relatedDelivery?.delivery_type,
      });
    }
  }

  return sortLifecycleEvents(events);
}

export interface ReplacementHistoryRow {
  id: number;
  date: string;
  entityLabel: string;
  faultType?: string;
  oldPartNumber?: string;
  newPartNumber?: string;
  oldSerialNumber?: string;
  newSerialNumber?: string;
  redeliveryDate?: string;
  maintenanceCaseId?: number;
}

export function buildReplacementHistoryRows(
  records: ConfigurationHistory[],
  matchContext: SubtreeMatchContext,
  subtreeByEntityId: Map<number, SubtreeEntityRef>,
  deliveries: MaintenanceDelivery[] = []
): ReplacementHistoryRow[] {
  const deliveryByCase = new Map<number, MaintenanceDelivery>();
  for (const delivery of deliveries) {
    if (delivery.case_id && !deliveryByCase.has(delivery.case_id)) {
      deliveryByCase.set(delivery.case_id, delivery);
    }
  }

  return filterReplacementRecords(records).map((record) => {
    const delivery = record.maintenance_case_id
      ? deliveryByCase.get(record.maintenance_case_id)
      : undefined;

    return {
      id: record.id,
      date: record.change_date,
      entityLabel: entityLabelForHistory(record, matchContext, subtreeByEntityId),
      faultType: record.fault_type ?? undefined,
      oldPartNumber: record.old_part_number ?? undefined,
      newPartNumber: record.new_part_number ?? undefined,
      oldSerialNumber: record.old_serial_number ?? undefined,
      newSerialNumber: record.new_serial_number ?? undefined,
      redeliveryDate: delivery?.delivered_at ?? undefined,
      maintenanceCaseId: record.maintenance_case_id ?? undefined,
    };
  });
}

export function splitBuildAndReplacementRecords(
  records: ConfigurationHistory[],
  nodeContext: SubtreeMatchContext,
  subtreeRefs: SubtreeEntityRef[],
  subtreeByEntityId: Map<number, SubtreeEntityRef>,
  options?: {
    userLabelsById?: Map<number, string>;
    deliveries?: MaintenanceDelivery[];
  }
) {
  const nodeRecords = filterReplacementRecords(
    records.filter((record) => recordMatchesNodeSubtree(record, nodeContext, subtreeByEntityId))
  );

  return {
    installEvents: buildInstallTimelineForNode(subtreeRefs, {
      userLabelsById: options?.userLabelsById,
      deliveries: options?.deliveries,
    }),
    replacementRows: buildReplacementHistoryRows(
      nodeRecords,
      nodeContext,
      subtreeByEntityId,
      options?.deliveries ?? []
    ),
  };
}

export function filterReplacementRowsForEntity(
  records: ConfigurationHistory[],
  entityType: HierarchyEntityType,
  entityPk: number,
  matchContext: SubtreeMatchContext,
  subtreeByEntityId: Map<number, SubtreeEntityRef>,
  deliveries: MaintenanceDelivery[] = []
) {
  const entityFilterKey = makeEntityKey(entityType, entityPk);
  const scoped = filterReplacementRecords(
    records.filter(
      (record) =>
        entityKeyForRecord(record, matchContext, subtreeByEntityId) === entityFilterKey
    )
  );
  return buildReplacementHistoryRows(scoped, matchContext, subtreeByEntityId, deliveries);
}

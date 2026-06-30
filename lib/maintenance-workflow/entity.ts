import {
  ActionType,
  FaultType,
  FaultyEntityStatus,
  ResolutionType,
  type FaultyEntity,
  type MaintenanceAction,
  type UpdateFaultyEntityPayload,
} from '@/lib/models';
import { FaultyEntityWorkflowStatus } from './types';

export interface EntityDisplayContext {
  entity: FaultyEntity;
  displayStatus: FaultyEntityWorkflowStatus;
  actions: MaintenanceAction[];
}

const TERMINAL_DISPLAY_STATUSES = new Set<FaultyEntityWorkflowStatus>([
  FaultyEntityWorkflowStatus.REPAIRED,
  FaultyEntityWorkflowStatus.REPLACED,
  FaultyEntityWorkflowStatus.NO_FAULT_FOUND,
]);

const ACTIVE_ANCESTOR_STATUSES = new Set<FaultyEntityWorkflowStatus>([
  FaultyEntityWorkflowStatus.IDENTIFIED,
  FaultyEntityWorkflowStatus.UNDER_INSPECTION,
  FaultyEntityWorkflowStatus.CONFIRMED_FAULTY,
  FaultyEntityWorkflowStatus.UNDER_REPAIR,
]);

export function isTerminalDisplayStatus(status: FaultyEntityWorkflowStatus): boolean {
  return TERMINAL_DISPLAY_STATUSES.has(status);
}

export function areAllEntitiesTerminalDisplay(contexts: EntityDisplayContext[]): boolean {
  if (contexts.length === 0) return false;
  return contexts.every((ctx) => isTerminalDisplayStatus(ctx.displayStatus));
}

function hasRepairAction(actions: MaintenanceAction[]): boolean {
  return actions.some((action) =>
    [ActionType.Repair, ActionType.Replacement, ActionType.Disassembly].includes(
      action.action_type as ActionType
    )
  );
}

export function mapFaultyEntityStatusFromApi(
  entity: FaultyEntity,
  entityActions: MaintenanceAction[] = []
): FaultyEntityWorkflowStatus {
  const status = String(entity.status);
  const resolution = entity.resolution_type ? String(entity.resolution_type) : undefined;

  if (
    status === FaultyEntityStatus.RESOLVED ||
    status === 'resolved'
  ) {
    if (resolution === ResolutionType.REPLACED || resolution === 'replaced') {
      return FaultyEntityWorkflowStatus.REPLACED;
    }
    if (resolution === ResolutionType.REPAIRED || resolution === 'repaired') {
      return FaultyEntityWorkflowStatus.REPAIRED;
    }
    if (
      resolution === ResolutionType.NO_FAULT_FOUND ||
      resolution === 'no_fault_found' ||
      resolution === ResolutionType.DECOMMISSIONED ||
      resolution === 'decommissioned'
    ) {
      return FaultyEntityWorkflowStatus.NO_FAULT_FOUND;
    }
    return FaultyEntityWorkflowStatus.REPAIRED;
  }

  if (
    status === FaultyEntityStatus.NO_FAULT_FOUND ||
    status === 'no_fault_found' ||
    status === FaultyEntityStatus.FALSEPOSITIVE ||
    status === 'false_positive' ||
    status === FaultyEntityStatus.HEALTHY ||
    status === 'healthy'
  ) {
    return FaultyEntityWorkflowStatus.NO_FAULT_FOUND;
  }

  if (
    status === FaultyEntityStatus.CONFIRMED_FAULTY ||
    status === 'confirmed_faulty'
  ) {
    if (hasRepairAction(entityActions)) {
      return FaultyEntityWorkflowStatus.UNDER_REPAIR;
    }
    return FaultyEntityWorkflowStatus.CONFIRMED_FAULTY;
  }

  if (
    status === FaultyEntityStatus.UNDER_INSPECTION ||
    status === 'under_inspection'
  ) {
    return FaultyEntityWorkflowStatus.UNDER_INSPECTION;
  }

  if (
    status === FaultyEntityStatus.IDENTIFIED ||
    status === 'identified' ||
    status === FaultyEntityStatus.SUSPECTED ||
    status === 'suspected'
  ) {
    return FaultyEntityWorkflowStatus.IDENTIFIED;
  }

  return FaultyEntityWorkflowStatus.IDENTIFIED;
}

export function mapFaultyEntityStatusToApi(
  displayStatus: FaultyEntityWorkflowStatus,
  resolutionType?: ResolutionType
): { status: FaultyEntityStatus; resolution_type?: ResolutionType } {
  switch (displayStatus) {
    case FaultyEntityWorkflowStatus.IDENTIFIED:
      return { status: FaultyEntityStatus.IDENTIFIED };
    case FaultyEntityWorkflowStatus.UNDER_INSPECTION:
      return { status: FaultyEntityStatus.UNDER_INSPECTION };
    case FaultyEntityWorkflowStatus.CONFIRMED_FAULTY:
    case FaultyEntityWorkflowStatus.UNDER_REPAIR:
      return { status: FaultyEntityStatus.CONFIRMED_FAULTY };
    case FaultyEntityWorkflowStatus.REPAIRED:
      return {
        status: FaultyEntityStatus.RESOLVED,
        resolution_type: ResolutionType.REPAIRED,
      };
    case FaultyEntityWorkflowStatus.REPLACED:
      return {
        status: FaultyEntityStatus.RESOLVED,
        resolution_type: ResolutionType.REPLACED,
      };
    case FaultyEntityWorkflowStatus.NO_FAULT_FOUND:
      return {
        status: FaultyEntityStatus.NO_FAULT_FOUND,
        resolution_type: resolutionType ?? ResolutionType.NO_FAULT_FOUND,
      };
    default:
      return { status: FaultyEntityStatus.IDENTIFIED };
  }
}

export function buildEntityDisplayContexts(
  entities: FaultyEntity[],
  actions: MaintenanceAction[]
): EntityDisplayContext[] {
  const actionsByEntity = new Map<number, MaintenanceAction[]>();
  for (const action of actions) {
    const list = actionsByEntity.get(action.faulty_entity_id) ?? [];
    list.push(action);
    actionsByEntity.set(action.faulty_entity_id, list);
  }

  return entities.map((entity) => {
    const entityActions = actionsByEntity.get(entity.id) ?? [];
    return {
      entity,
      displayStatus: mapFaultyEntityStatusFromApi(entity, entityActions),
      actions: entityActions,
    };
  });
}

function getAncestorChain(
  entity: FaultyEntity,
  entities: FaultyEntity[]
): FaultyEntity[] {
  const ancestors: FaultyEntity[] = [];
  let current = entity;
  const byId = new Map(entities.map((e) => [e.id, e]));

  while (current.parent_faulty_entity_id) {
    const parent = byId.get(current.parent_faulty_entity_id);
    if (!parent) break;
    ancestors.push(parent);
    current = parent;
  }

  return ancestors;
}

export function isPotentiallyAffected(
  entity: FaultyEntity,
  entities: FaultyEntity[],
  actions: MaintenanceAction[] = []
): boolean {
  const displayStatus = mapFaultyEntityStatusFromApi(
    entity,
    actions.filter((a) => a.faulty_entity_id === entity.id)
  );

  if (
    displayStatus === FaultyEntityWorkflowStatus.CONFIRMED_FAULTY ||
    isTerminalDisplayStatus(displayStatus)
  ) {
    return false;
  }

  const ancestors = getAncestorChain(entity, entities);
  if (ancestors.length === 0) {
    return String(entity.status) === FaultyEntityStatus.SUSPECTED || String(entity.status) === 'suspected';
  }

  return ancestors.some((ancestor) => {
    const ancestorDisplay = mapFaultyEntityStatusFromApi(
      ancestor,
      actions.filter((a) => a.faulty_entity_id === ancestor.id)
    );
    return ACTIVE_ANCESTOR_STATUSES.has(ancestorDisplay);
  });
}

export function countEntitiesByDisplayStatus(
  contexts: EntityDisplayContext[]
): Record<FaultyEntityWorkflowStatus, number> {
  const counts = Object.values(FaultyEntityWorkflowStatus).reduce(
    (acc, status) => {
      acc[status] = 0;
      return acc;
    },
    {} as Record<FaultyEntityWorkflowStatus, number>
  );

  for (const ctx of contexts) {
    counts[ctx.displayStatus] += 1;
  }

  return counts;
}

export function isClassifiedFaultType(faultType?: FaultType | string | null): boolean {
  if (!faultType) return false;
  const value = String(faultType).toLowerCase();
  return value !== FaultType.UNCLASSIFIED && value !== 'unclassified';
}

export function resolutionRequiresClassifiedFaultType(resolutionType: ResolutionType): boolean {
  return resolutionType !== ResolutionType.NO_FAULT_FOUND;
}

export interface ResolveFaultFields {
  old_part_number?: string;
  new_part_number?: string;
  old_serial_number?: string;
  new_serial_number?: string;
  remarks?: string;
}

/** Maps UI resolution choices to backend-accepted faulty-entity update payloads. */
export function buildResolveFaultUpdatePayload(
  resolutionType: ResolutionType,
  fields: ResolveFaultFields = {}
): UpdateFaultyEntityPayload {
  const status =
    resolutionType === ResolutionType.NO_FAULT_FOUND
      ? FaultyEntityStatus.NO_FAULT_FOUND
      : FaultyEntityStatus.RESOLVED;

  return {
    status,
    resolution_type: resolutionType,
    old_part_number: fields.old_part_number,
    new_part_number: fields.new_part_number,
    old_serial_number: fields.old_serial_number,
    new_serial_number: fields.new_serial_number,
    remarks: fields.remarks,
  };
}

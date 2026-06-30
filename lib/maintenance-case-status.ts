import { CaseStatus, FaultyEntity, FaultyEntityStatus } from './models';
import {
  FaultyEntityWorkflowStatus,
  MaintenanceCaseWorkflowStatus,
  mapCaseStatusFromApi,
  mapFaultyEntityStatusFromApi,
  isTerminalDisplayStatus,
} from './maintenance-workflow';

export function isTerminalFaultyStatus(status: FaultyEntityStatus | string): boolean {
  const display = mapFaultyEntityStatusFromApi({ status } as FaultyEntity);
  return isTerminalDisplayStatus(display);
}

export function areAllFaultyEntitiesTerminal(entities: FaultyEntity[]): boolean {
  if (entities.length === 0) return false;
  return entities.every((entity) => isTerminalFaultyStatus(entity.status));
}

export function shouldSuggestResolveCase(
  entities: FaultyEntity[],
  currentCaseStatus?: CaseStatus | string
): boolean {
  if (!entities.length) return false;
  const apiStatus = String(currentCaseStatus ?? '');
  if (apiStatus === CaseStatus.Resolved || apiStatus === CaseStatus.Closed) {
    return false;
  }
  return areAllFaultyEntitiesTerminal(entities);
}

/** @deprecated Use shouldSuggestResolveCase — no longer auto-resolves */
export const shouldAutoResolveCase = shouldSuggestResolveCase;

export function getDescendantFaultyEntityIds(
  entityId: number,
  entities: FaultyEntity[]
): number[] {
  const children = entities.filter((entity) => entity.parent_faulty_entity_id === entityId);
  return children.flatMap((child) => [child.id, ...getDescendantFaultyEntityIds(child.id, entities)]);
}

export function mapLegacyEntityStatusToDisplay(
  status: FaultyEntityStatus | string
): FaultyEntityWorkflowStatus {
  return mapFaultyEntityStatusFromApi({ status } as FaultyEntity);
}

export function mapLegacyCaseStatusToDisplay(
  status: CaseStatus | string
): MaintenanceCaseWorkflowStatus {
  return mapCaseStatusFromApi(status);
}

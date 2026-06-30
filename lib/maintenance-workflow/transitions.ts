import { MaintenanceCaseWorkflowStatus, FaultyEntityWorkflowStatus } from './types';

const CASE_TRANSITIONS: Record<MaintenanceCaseWorkflowStatus, MaintenanceCaseWorkflowStatus[]> = {
  [MaintenanceCaseWorkflowStatus.OPEN]: [
    MaintenanceCaseWorkflowStatus.UNDER_INVESTIGATION,
    MaintenanceCaseWorkflowStatus.CLOSED,
  ],
  [MaintenanceCaseWorkflowStatus.UNDER_INVESTIGATION]: [
    MaintenanceCaseWorkflowStatus.REPAIR_IN_PROGRESS,
    MaintenanceCaseWorkflowStatus.RESOLVED,
    MaintenanceCaseWorkflowStatus.CLOSED,
  ],
  [MaintenanceCaseWorkflowStatus.REPAIR_IN_PROGRESS]: [
    MaintenanceCaseWorkflowStatus.AWAITING_VERIFICATION,
    MaintenanceCaseWorkflowStatus.RESOLVED,
    MaintenanceCaseWorkflowStatus.CLOSED,
  ],
  [MaintenanceCaseWorkflowStatus.AWAITING_VERIFICATION]: [
    MaintenanceCaseWorkflowStatus.RESOLVED,
    MaintenanceCaseWorkflowStatus.REPAIR_IN_PROGRESS,
    MaintenanceCaseWorkflowStatus.CLOSED,
  ],
  [MaintenanceCaseWorkflowStatus.RESOLVED]: [
    MaintenanceCaseWorkflowStatus.CLOSED,
    MaintenanceCaseWorkflowStatus.REPAIR_IN_PROGRESS,
  ],
  [MaintenanceCaseWorkflowStatus.CLOSED]: [
    MaintenanceCaseWorkflowStatus.RESOLVED,
  ],
};

const ENTITY_TRANSITIONS: Record<FaultyEntityWorkflowStatus, FaultyEntityWorkflowStatus[]> = {
  [FaultyEntityWorkflowStatus.IDENTIFIED]: [
    FaultyEntityWorkflowStatus.UNDER_INSPECTION,
    FaultyEntityWorkflowStatus.CONFIRMED_FAULTY,
    FaultyEntityWorkflowStatus.NO_FAULT_FOUND,
  ],
  [FaultyEntityWorkflowStatus.UNDER_INSPECTION]: [
    FaultyEntityWorkflowStatus.CONFIRMED_FAULTY,
    FaultyEntityWorkflowStatus.NO_FAULT_FOUND,
    FaultyEntityWorkflowStatus.IDENTIFIED,
  ],
  [FaultyEntityWorkflowStatus.CONFIRMED_FAULTY]: [
    FaultyEntityWorkflowStatus.UNDER_REPAIR,
    FaultyEntityWorkflowStatus.REPAIRED,
    FaultyEntityWorkflowStatus.REPLACED,
    FaultyEntityWorkflowStatus.NO_FAULT_FOUND,
  ],
  [FaultyEntityWorkflowStatus.UNDER_REPAIR]: [
    FaultyEntityWorkflowStatus.REPAIRED,
    FaultyEntityWorkflowStatus.REPLACED,
    FaultyEntityWorkflowStatus.CONFIRMED_FAULTY,
  ],
  [FaultyEntityWorkflowStatus.REPAIRED]: [],
  [FaultyEntityWorkflowStatus.REPLACED]: [],
  [FaultyEntityWorkflowStatus.NO_FAULT_FOUND]: [],
};

export function getAllowedCaseStatusTransitions(
  current: MaintenanceCaseWorkflowStatus
): MaintenanceCaseWorkflowStatus[] {
  return CASE_TRANSITIONS[current] ?? [];
}

export function getAllowedEntityStatusTransitions(
  current: FaultyEntityWorkflowStatus
): FaultyEntityWorkflowStatus[] {
  return ENTITY_TRANSITIONS[current] ?? [];
}

export function isCaseStatusTransitionAllowed(
  from: MaintenanceCaseWorkflowStatus,
  to: MaintenanceCaseWorkflowStatus
): boolean {
  if (from === to) return true;
  return getAllowedCaseStatusTransitions(from).includes(to);
}

export function isEntityStatusTransitionAllowed(
  from: FaultyEntityWorkflowStatus,
  to: FaultyEntityWorkflowStatus
): boolean {
  if (from === to) return true;
  return getAllowedEntityStatusTransitions(from).includes(to);
}

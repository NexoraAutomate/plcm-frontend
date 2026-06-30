import {
  ActionOutcome,
  ActionType,
  ResolutionType,
  type MaintenanceAction,
  type MaintenanceCase,
} from '@/lib/models';
import { MaintenanceCaseWorkflowStatus, FaultyEntityWorkflowStatus } from './types';
import {
  buildEntityDisplayContexts,
  areAllEntitiesTerminalDisplay,
  mapFaultyEntityStatusFromApi,
  type EntityDisplayContext,
} from './entity';
import { getCaseDisplayStatus } from './case';
import type { FaultyEntity } from '@/lib/models';

export type WorkflowTrigger =
  | 'case_created'
  | 'first_inspection'
  | 'confirm_faulty'
  | 'repair_action'
  | 'resolve_repaired'
  | 'resolve_replaced'
  | 'resolve_no_fault'
  | 'testing_pass'
  | 'verification_approved'
  | 'close_case';

export interface WorkflowSuggestion {
  trigger: WorkflowTrigger;
  suggestedCaseStatus?: MaintenanceCaseWorkflowStatus;
  suggestedEntityStatus?: FaultyEntityWorkflowStatus;
  message: string;
}

export interface SuggestionContext {
  maintenanceCase?: MaintenanceCase | null;
  entities: FaultyEntity[];
  actions: MaintenanceAction[];
  trigger: WorkflowTrigger;
  entityId?: number;
  resolutionType?: ResolutionType;
  actionType?: ActionType;
  actionOutcome?: ActionOutcome;
}

function hasInspectionAction(actions: MaintenanceAction[]): boolean {
  return actions.some((a) => a.action_type === ActionType.Inspection);
}

export function getWorkflowSuggestion(context: SuggestionContext): WorkflowSuggestion | null {
  const { trigger, entities, actions, maintenanceCase, entityId, resolutionType } = context;
  const displayContexts = buildEntityDisplayContexts(entities, actions);
  const currentCaseDisplay = maintenanceCase
    ? getCaseDisplayStatus(maintenanceCase, displayContexts, actions)
    : MaintenanceCaseWorkflowStatus.OPEN;

  switch (trigger) {
    case 'case_created':
      return {
        trigger,
        suggestedCaseStatus: MaintenanceCaseWorkflowStatus.OPEN,
        message: 'Case opened for investigation.',
      };

    case 'first_inspection':
      if (currentCaseDisplay === MaintenanceCaseWorkflowStatus.OPEN) {
        return {
          trigger,
          suggestedCaseStatus: MaintenanceCaseWorkflowStatus.UNDER_INVESTIGATION,
          suggestedEntityStatus: FaultyEntityWorkflowStatus.UNDER_INSPECTION,
          message:
            'This action normally changes the Case Status to Under Investigation. Proceed?',
        };
      }
      if (entityId) {
        const entity = entities.find((e) => e.id === entityId);
        if (entity) {
          const display = mapFaultyEntityStatusFromApi(entity, actions.filter((a) => a.faulty_entity_id === entityId));
          if (display === FaultyEntityWorkflowStatus.IDENTIFIED) {
            return {
              trigger,
              suggestedEntityStatus: FaultyEntityWorkflowStatus.UNDER_INSPECTION,
              message:
                'This action normally changes the entity status to Under Inspection. Proceed?',
            };
          }
        }
      }
      return null;

    case 'confirm_faulty':
      return {
        trigger,
        suggestedCaseStatus: MaintenanceCaseWorkflowStatus.REPAIR_IN_PROGRESS,
        suggestedEntityStatus: FaultyEntityWorkflowStatus.CONFIRMED_FAULTY,
        message:
          'This action normally changes the Case Status to Repair In Progress and confirms the fault. Proceed?',
      };

    case 'repair_action':
      return {
        trigger,
        suggestedEntityStatus: FaultyEntityWorkflowStatus.UNDER_REPAIR,
        message: 'This action normally changes the entity status to Under Repair. Proceed?',
      };

    case 'resolve_repaired':
      return {
        trigger,
        suggestedEntityStatus: FaultyEntityWorkflowStatus.REPAIRED,
        message: 'This action normally marks the entity as Repaired. Proceed?',
      };

    case 'resolve_replaced':
      return {
        trigger,
        suggestedEntityStatus: FaultyEntityWorkflowStatus.REPLACED,
        message: 'This action normally marks the entity as Replaced. Proceed?',
      };

    case 'resolve_no_fault':
      return {
        trigger,
        suggestedEntityStatus: FaultyEntityWorkflowStatus.NO_FAULT_FOUND,
        message: 'This action normally marks the entity as No Fault Found. Proceed?',
      };

    case 'testing_pass':
      if (
        areAllEntitiesTerminalDisplay(displayContexts) &&
        currentCaseDisplay !== MaintenanceCaseWorkflowStatus.RESOLVED &&
        currentCaseDisplay !== MaintenanceCaseWorkflowStatus.CLOSED
      ) {
        return {
          trigger,
          suggestedCaseStatus: MaintenanceCaseWorkflowStatus.AWAITING_VERIFICATION,
          message:
            'Successful testing normally changes the Case Status to Awaiting Verification. Proceed?',
        };
      }
      return null;

    case 'verification_approved':
      if (
        currentCaseDisplay === MaintenanceCaseWorkflowStatus.AWAITING_VERIFICATION ||
        (currentCaseDisplay === MaintenanceCaseWorkflowStatus.REPAIR_IN_PROGRESS &&
          areAllEntitiesTerminalDisplay(displayContexts) &&
          hasInspectionAction(actions))
      ) {
        return {
          trigger,
          suggestedCaseStatus: MaintenanceCaseWorkflowStatus.RESOLVED,
          message: 'Verification approved normally changes the Case Status to Resolved. Proceed?',
        };
      }
      return null;

    case 'close_case':
      return {
        trigger,
        suggestedCaseStatus: MaintenanceCaseWorkflowStatus.CLOSED,
        message: 'This action normally changes the Case Status to Closed. Proceed?',
      };

    default:
      return null;
  }
}

export function resolveTriggerFromAction(
  actionType: ActionType,
  outcome: ActionOutcome,
  isFirstInspection: boolean
): WorkflowTrigger | null {
  if (actionType === ActionType.Inspection && isFirstInspection) {
    return 'first_inspection';
  }
  if (
    actionType === ActionType.Repair ||
    actionType === ActionType.Replacement ||
    actionType === ActionType.Disassembly ||
    actionType === ActionType.Assembly
  ) {
    return 'repair_action';
  }
  if (actionType === ActionType.Testing && outcome === ActionOutcome.Pass) {
    return 'testing_pass';
  }
  return null;
}

export function resolveTriggerFromResolution(
  resolutionType: ResolutionType
): WorkflowTrigger {
  switch (resolutionType) {
    case ResolutionType.REPLACED:
      return 'resolve_replaced';
    case ResolutionType.NO_FAULT_FOUND:
      return 'resolve_no_fault';
    default:
      return 'resolve_repaired';
  }
}

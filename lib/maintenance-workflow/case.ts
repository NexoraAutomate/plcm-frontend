import { CaseStatus, type MaintenanceAction, type MaintenanceCase } from '@/lib/models';
import { MaintenanceCaseWorkflowStatus } from './types';
import { areAllEntitiesTerminalDisplay, type EntityDisplayContext } from './entity';

export function isCaseInVerificationPhase(
  entities: EntityDisplayContext[],
  actions: MaintenanceAction[]
): boolean {
  if (entities.length === 0) return false;
  if (!areAllEntitiesTerminalDisplay(entities)) return false;

  return actions.some(
    (action) =>
      action.action_type === 'testing' && action.outcome === 'pass'
  );
}

export function mapCaseStatusFromApi(
  apiStatus: CaseStatus | string,
  context?: {
    entities?: EntityDisplayContext[];
    actions?: MaintenanceAction[];
  }
): MaintenanceCaseWorkflowStatus {
  const status = String(apiStatus);

  switch (status) {
    case CaseStatus.Open:
    case 'open':
      return MaintenanceCaseWorkflowStatus.OPEN;
    case CaseStatus.UnderInspection:
    case 'under_inspection':
      return MaintenanceCaseWorkflowStatus.UNDER_INVESTIGATION;
    case CaseStatus.UnderRepair:
    case 'under_repair':
      if (
        context?.entities &&
        context?.actions &&
        isCaseInVerificationPhase(context.entities, context.actions)
      ) {
        return MaintenanceCaseWorkflowStatus.AWAITING_VERIFICATION;
      }
      return MaintenanceCaseWorkflowStatus.REPAIR_IN_PROGRESS;
    case CaseStatus.Resolved:
    case 'resolved':
      return MaintenanceCaseWorkflowStatus.RESOLVED;
    case CaseStatus.Closed:
    case 'closed':
      return MaintenanceCaseWorkflowStatus.CLOSED;
    default:
      return MaintenanceCaseWorkflowStatus.OPEN;
  }
}

export function mapCaseStatusToApi(displayStatus: MaintenanceCaseWorkflowStatus): CaseStatus {
  switch (displayStatus) {
    case MaintenanceCaseWorkflowStatus.OPEN:
      return CaseStatus.Open;
    case MaintenanceCaseWorkflowStatus.UNDER_INVESTIGATION:
      return CaseStatus.UnderInspection;
    case MaintenanceCaseWorkflowStatus.REPAIR_IN_PROGRESS:
    case MaintenanceCaseWorkflowStatus.AWAITING_VERIFICATION:
      return CaseStatus.UnderRepair;
    case MaintenanceCaseWorkflowStatus.RESOLVED:
      return CaseStatus.Resolved;
    case MaintenanceCaseWorkflowStatus.CLOSED:
      return CaseStatus.Closed;
    default:
      return CaseStatus.Open;
  }
}

export function getCaseDisplayStatus(
  maintenanceCase: MaintenanceCase | null,
  entities: EntityDisplayContext[],
  actions: MaintenanceAction[]
): MaintenanceCaseWorkflowStatus {
  if (!maintenanceCase) return MaintenanceCaseWorkflowStatus.OPEN;
  return mapCaseStatusFromApi(maintenanceCase.status, { entities, actions });
}

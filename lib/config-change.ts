/**
 * Spec 12 — configuration change after hierarchy / reservation.
 * CONTROL RULE: never mutate sealed project configuration in place.
 */

import { ConfigChangeRequestStatus } from '@/lib/models';
import { ProjectWorkflowStatus } from '@/lib/workflow-status';

export const CONTROL_RULE =
  'Existing project configuration is not edited in place after hierarchy setup / reservation. The previous project remains traceable; the desired configuration is implemented through a new approved Project / Flight.';

export const CONFIG_CHANGE_STEPS = [
  {
    key: 'CC-1',
    status: ConfigChangeRequestStatus.REQUESTED,
    label: 'Request change',
    hint: 'HM opens a configuration change on this sealed project.',
  },
  {
    key: 'CC-2',
    status: ConfigChangeRequestStatus.REQUESTED,
    label: 'Return inventory',
    hint: 'Release reserved stock and recall issued units to IM.',
  },
  {
    key: 'CC-3',
    status: ConfigChangeRequestStatus.INVENTORY_RETURNED,
    label: 'IM inspect & restore',
    hint: 'Inspect returned serials; reusable stock goes Available.',
  },
  {
    key: 'CC-4',
    status: ConfigChangeRequestStatus.SUBMITTED,
    label: 'Submit change request',
    hint: 'Choose a different approved configuration and give a reason.',
  },
  {
    key: 'CC-5',
    status: ConfigChangeRequestStatus.APPROVED,
    label: 'Admin approval',
    hint: 'Admin reviews the CR after inventory is cleared.',
  },
  {
    key: 'CC-6',
    status: ConfigChangeRequestStatus.NEW_PROJECT_CREATED,
    label: 'Create new project',
    hint: 'New draft Project/Flight with the target config; old project is superseded.',
  },
] as const;

const STATUS_STEP_INDEX: Record<string, number> = {
  [ConfigChangeRequestStatus.REQUESTED]: 1,
  [ConfigChangeRequestStatus.INVENTORY_RETURNED]: 3,
  [ConfigChangeRequestStatus.SUBMITTED]: 4,
  [ConfigChangeRequestStatus.APPROVED]: 5,
  [ConfigChangeRequestStatus.NEW_PROJECT_CREATED]: 6,
};

export function configChangeStepIndex(status?: string | null, inventoryCleared?: boolean): number {
  if (!status) return 0;
  if (status === ConfigChangeRequestStatus.REQUESTED && inventoryCleared) return 3;
  return STATUS_STEP_INDEX[status] ?? 0;
}

export function isConfigSealed(statusName?: string | null): boolean {
  return (
    statusName === ProjectWorkflowStatus.APPROVED ||
    statusName === ProjectWorkflowStatus.HIERARCHY_GENERATED ||
    statusName === ProjectWorkflowStatus.READY_FOR_INVENTORY ||
    statusName === ProjectWorkflowStatus.CANCELLED ||
    statusName === ProjectWorkflowStatus.COMPLETED ||
    statusName === ProjectWorkflowStatus.READY_TO_DELIVER ||
    statusName === ProjectWorkflowStatus.SUPERSEDED
  );
}

export function canRequestConfigChange(statusName?: string | null): boolean {
  // Entry from the project workflow is only before Generate Hierarchy.
  return statusName === ProjectWorkflowStatus.APPROVED;
}

export function isOpenConfigChange(status?: string | null): boolean {
  return (
    status === ConfigChangeRequestStatus.REQUESTED ||
    status === ConfigChangeRequestStatus.INVENTORY_RETURNED ||
    status === ConfigChangeRequestStatus.SUBMITTED ||
    status === ConfigChangeRequestStatus.APPROVED
  );
}

export function canCancelConfigChange(status?: string | null): boolean {
  return (
    status === ConfigChangeRequestStatus.REQUESTED ||
    status === ConfigChangeRequestStatus.INVENTORY_RETURNED ||
    status === ConfigChangeRequestStatus.SUBMITTED
  );
}

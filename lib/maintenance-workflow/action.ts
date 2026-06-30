import { ActionOutcome, ActionType } from '@/lib/models';

const API_ACTION_FALLBACK: Partial<Record<ActionType, ActionType>> = {
  [ActionType.Assembly]: ActionType.Disassembly,
  [ActionType.SoftwareUpdate]: ActionType.Inspection,
  [ActionType.ConfigurationChange]: ActionType.Recalibration,
  [ActionType.Documentation]: ActionType.Inspection,
};

const API_OUTCOME_FALLBACK: Partial<Record<ActionOutcome, ActionOutcome>> = {
  [ActionOutcome.NotApplicable]: ActionOutcome.Inconclusive,
};

export function toApiActionType(actionType: ActionType | string): ActionType {
  const typed = actionType as ActionType;
  return API_ACTION_FALLBACK[typed] ?? typed;
}

export function toApiActionOutcome(outcome: ActionOutcome | string): ActionOutcome {
  const typed = outcome as ActionOutcome;
  return API_OUTCOME_FALLBACK[typed] ?? typed;
}

export function formatActionTypeLabel(actionType: string): string {
  return actionType.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export const ALL_ACTION_TYPES: ActionType[] = [
  ActionType.Inspection,
  ActionType.Disassembly,
  ActionType.Assembly,
  ActionType.Repair,
  ActionType.Replacement,
  ActionType.Testing,
  ActionType.Cleaning,
  ActionType.Recalibration,
  ActionType.SoftwareUpdate,
  ActionType.ConfigurationChange,
  ActionType.Documentation,
];

export const ALL_ACTION_OUTCOMES: ActionOutcome[] = [
  ActionOutcome.Pass,
  ActionOutcome.Fail,
  ActionOutcome.Pending,
  ActionOutcome.Inconclusive,
  ActionOutcome.NotApplicable,
];

export const UI_RESOLUTION_TYPES = [
  'repaired',
  'replaced',
  'no_fault_found',
  'decommissioned',
] as const;

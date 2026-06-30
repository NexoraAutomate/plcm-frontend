import type { LucideIcon } from 'lucide-react';
import {
  CircleDot,
  Search,
  AlertTriangle,
  Wrench,
  Replace,
  TestTube2,
  CheckCircle2,
  Archive,
  Hammer,
  FileText,
} from 'lucide-react';
import {
  ActionType,
  ResolutionType,
  type FaultyEntity,
  type MaintenanceAction,
  type MaintenanceCase,
  type User,
} from '@/lib/models';
import { formatUserRef } from '@/lib/user-display';

export enum TimelineEventKind {
  CaseOpened = 'case_opened',
  InspectionStarted = 'inspection_started',
  FaultConfirmed = 'fault_confirmed',
  RepairStarted = 'repair_started',
  ComponentReplaced = 'component_replaced',
  VerificationTestPassed = 'verification_test_passed',
  CaseResolved = 'case_resolved',
  CaseClosed = 'case_closed',
  EntityIdentified = 'entity_identified',
  EntityResolved = 'entity_resolved',
  ActionRecorded = 'action_recorded',
}

export const TIMELINE_EVENT_META: Record<
  TimelineEventKind,
  { title: string; icon: LucideIcon }
> = {
[TimelineEventKind.CaseOpened]                : { title: 'Case Opened', icon: CircleDot },
  [TimelineEventKind.InspectionStarted]       : { title: 'Inspection Started', icon: Search },
  [TimelineEventKind.FaultConfirmed]          : { title: 'Fault Confirmed', icon: AlertTriangle },
[TimelineEventKind.RepairStarted]             : { title: 'Repair Started', icon: Wrench },
[TimelineEventKind.ComponentReplaced]         : { title: 'Component Replaced', icon: Replace },
  [TimelineEventKind.VerificationTestPassed]  : {title: 'Verification Test Passed',icon: TestTube2,},
  [TimelineEventKind.CaseResolved]            : { title: 'Case Resolved', icon: CheckCircle2 },
  [TimelineEventKind.CaseClosed]              : { title: 'Case Closed', icon: Archive },
  [TimelineEventKind.EntityIdentified]        : { title: 'Entity Identified', icon: Search },
  [TimelineEventKind.EntityResolved]          : { title: 'Entity Resolved', icon: Hammer },
[TimelineEventKind.ActionRecorded]            : { title: 'Action Recorded', icon: FileText },
};

export interface CaseTimelineEvent {
  id: string;
  kind: TimelineEventKind;
  title: string;
  notes?: string;
  outcome?: string;
  performed_at: string;
  entityLabel?: string;
  faultyEntityId?: number;
  performed_by?: number;
  userLabel?: string;
}

function entityLabel(entity: FaultyEntity) {
  return (
    entity.entity_name ||
    entity.part_number ||
    `${entity.entity_type} ${entity.entity_id}`
  );
}

function formatActionTitle(actionType: string) {
  return actionType.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

function resolveUserLabel(
  userId?: number,
  userRef?: string | User
): string | undefined {
  if (userRef) return formatUserRef(userRef);
  if (userId) return `User #${userId}`;
  return undefined;
}

function actionKindForType(action: MaintenanceAction): TimelineEventKind {
  if (action.action_type === ActionType.Inspection) {
    return TimelineEventKind.InspectionStarted;
  }
  if (
    action.action_type === ActionType.Repair ||
    action.action_type === ActionType.Disassembly ||
    action.action_type === ActionType.Assembly
  ) {
    return TimelineEventKind.RepairStarted;
  }
  if (action.action_type === ActionType.Replacement) {
    return TimelineEventKind.ComponentReplaced;
  }
  if (action.action_type === ActionType.Testing && action.outcome === 'pass') {
    return TimelineEventKind.VerificationTestPassed;
  }
  return TimelineEventKind.ActionRecorded;
}

export function buildCaseTimelineEvents(
  maintenanceCase: MaintenanceCase | null,
  entities: FaultyEntity[],
  actions: MaintenanceAction[]
): CaseTimelineEvent[] {
  const events: CaseTimelineEvent[] = [];

  if (maintenanceCase) {
    events.push({
      id: `case-${maintenanceCase.id}-opened`,
      kind: TimelineEventKind.CaseOpened,
      title: TIMELINE_EVENT_META[TimelineEventKind.CaseOpened].title,
      notes: maintenanceCase.description,
      outcome: maintenanceCase.status,
      performed_at: maintenanceCase.reported_at || maintenanceCase.created_at,
      userLabel: resolveUserLabel(undefined, maintenanceCase.reported_by_user),
    });

    if (maintenanceCase.resolved_at) {
      events.push({
        id: `case-${maintenanceCase.id}-resolved`,
        kind: TimelineEventKind.CaseResolved,
        title: TIMELINE_EVENT_META[TimelineEventKind.CaseResolved].title,
        notes: maintenanceCase.resolution_notes,
        outcome: 'resolved',
        performed_at: maintenanceCase.resolved_at,
      });
    }

    if (maintenanceCase.status === 'closed') {
      events.push({
        id: `case-${maintenanceCase.id}-closed`,
        kind: TimelineEventKind.CaseClosed,
        title: TIMELINE_EVENT_META[TimelineEventKind.CaseClosed].title,
        notes: maintenanceCase.resolution_notes,
        outcome: 'closed',
        performed_at: maintenanceCase.updated_at || maintenanceCase.resolved_at || maintenanceCase.created_at,
      });
    }
  }

  for (const entity of entities) {
    const label = entityLabel(entity);

    events.push({
      id: `entity-${entity.id}-identified`,
      kind: TimelineEventKind.EntityIdentified,
      title: TIMELINE_EVENT_META[TimelineEventKind.EntityIdentified].title,
      notes: entity.fault_description || entity.investigation_notes,
      outcome: entity.status,
      performed_at: entity.identified_at || entity.created_at,
      entityLabel: label,
      faultyEntityId: entity.id,
      userLabel: entity.identified_by ? `User #${entity.identified_by}` : undefined,
    });

    if (entity.confirmed_at) {
      events.push({
        id: `entity-${entity.id}-confirmed`,
        kind: TimelineEventKind.FaultConfirmed,
        title: TIMELINE_EVENT_META[TimelineEventKind.FaultConfirmed].title,
        notes: entity.fault_type ? `Fault type: ${entity.fault_type}` : entity.investigation_notes,
        outcome: 'confirmed_faulty',
        performed_at: entity.confirmed_at,
        entityLabel: label,
        faultyEntityId: entity.id,
      });
    }

    if (entity.resolved_at) {
      const isReplacement = entity.resolution_type === ResolutionType.REPLACED;
      events.push({
        id: `entity-${entity.id}-resolved`,
        kind: isReplacement
          ? TimelineEventKind.ComponentReplaced
          : TimelineEventKind.EntityResolved,
        title: isReplacement
          ? TIMELINE_EVENT_META[TimelineEventKind.ComponentReplaced].title
          : TIMELINE_EVENT_META[TimelineEventKind.EntityResolved].title,
        notes: entity.resolution_type
          ? `Resolution: ${entity.resolution_type.replace(/_/g, ' ')}`
          : entity.investigation_notes,
        outcome: entity.resolution_type || 'resolved',
        performed_at: entity.resolved_at,
        entityLabel: label,
        faultyEntityId: entity.id,
      });
    }
  }

  for (const action of actions) {
    const relatedEntity = entities.find((entity) => entity.id === action.faulty_entity_id);
    const kind = actionKindForType(action);

    events.push({
      id: `action-${action.id}`,
      kind,
      title:
        kind === TimelineEventKind.ActionRecorded
          ? formatActionTitle(action.action_type)
          : TIMELINE_EVENT_META[kind].title,
      notes: action.notes,
      outcome: action.outcome,
      performed_at: action.performed_at,
      entityLabel: relatedEntity ? entityLabel(relatedEntity) : undefined,
      faultyEntityId: action.faulty_entity_id,
      performed_by: action.performed_by,
      userLabel: action.performed_by ? `User #${action.performed_by}` : undefined,
    });
  }

  return events.sort(
    (a, b) => new Date(b.performed_at).getTime() - new Date(a.performed_at).getTime()
  );
}

export function getTimelineEventIcon(kind: TimelineEventKind): LucideIcon {
  return TIMELINE_EVENT_META[kind]?.icon ?? FileText;
}

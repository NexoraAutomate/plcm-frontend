import type { LucideIcon } from 'lucide-react';
import {
  CircleDot,
  Search,
  Wrench,
  ClipboardCheck,
  CheckCircle2,
  Archive,
  Eye,
  AlertTriangle,
  Hammer,
  CheckCheck,
  Replace,
  CircleOff,
  FileText,
  Settings,
  Package,
  Cpu,
  Layers,
  TestTube2,
  HelpCircle,
  MinusCircle,
} from 'lucide-react';

export enum MaintenanceCaseWorkflowStatus {
  OPEN = 'open',
  UNDER_INVESTIGATION = 'under_investigation',
  REPAIR_IN_PROGRESS = 'repair_in_progress',
  AWAITING_VERIFICATION = 'awaiting_verification',
  RESOLVED = 'resolved',
  CLOSED = 'closed',
}

export enum FaultyEntityWorkflowStatus {
  IDENTIFIED = 'identified',
  UNDER_INSPECTION = 'under_inspection',
  CONFIRMED_FAULTY = 'confirmed_faulty',
  UNDER_REPAIR = 'under_repair',
  REPAIRED = 'repaired',
  REPLACED = 'replaced',
  NO_FAULT_FOUND = 'no_fault_found',
}

export interface WorkflowStatusMeta {
  label: string;
  colorClass: string;
  icon: LucideIcon;
  tooltip: string;
}

export const CASE_WORKFLOW_ORDER: MaintenanceCaseWorkflowStatus[] = [
  MaintenanceCaseWorkflowStatus.OPEN,
  MaintenanceCaseWorkflowStatus.UNDER_INVESTIGATION,
  MaintenanceCaseWorkflowStatus.REPAIR_IN_PROGRESS,
  MaintenanceCaseWorkflowStatus.AWAITING_VERIFICATION,
  MaintenanceCaseWorkflowStatus.RESOLVED,
  MaintenanceCaseWorkflowStatus.CLOSED,
];

export const CASE_STATUS_META: Record<MaintenanceCaseWorkflowStatus, WorkflowStatusMeta> = {
  [MaintenanceCaseWorkflowStatus.OPEN]: {
    label: 'Open',
    colorClass:
      'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800',
    icon: CircleDot,
    tooltip: 'Fault reported. Case automatically created.',
  },
  [MaintenanceCaseWorkflowStatus.UNDER_INVESTIGATION]: {
    label: 'Under Investigation',
    colorClass:
      'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800',
    icon: Search,
    tooltip: 'Engineer started diagnosis. Root cause not confirmed.',
  },
  [MaintenanceCaseWorkflowStatus.REPAIR_IN_PROGRESS]: {
    label: 'Repair In Progress',
    colorClass:
      'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950 dark:text-orange-300 dark:border-orange-800',
    icon: Wrench,
    tooltip: 'Fault confirmed. Repair activity started.',
  },
  [MaintenanceCaseWorkflowStatus.AWAITING_VERIFICATION]: {
    label: 'Awaiting Verification',
    colorClass:
      'bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950 dark:text-violet-300 dark:border-violet-800',
    icon: ClipboardCheck,
    tooltip: 'Repair completed. Waiting for functional testing or verification.',
  },
  [MaintenanceCaseWorkflowStatus.RESOLVED]: {
    label: 'Resolved',
    colorClass:
      'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800',
    icon: CheckCircle2,
    tooltip: 'Technical issue resolved. Can still be reopened.',
  },
  [MaintenanceCaseWorkflowStatus.CLOSED]: {
    label: 'Closed',
    colorClass:
      'bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
    icon: Archive,
    tooltip: 'Administrative closure after documentation, approvals, and delivery.',
  },
};

export const FAULTY_ENTITY_STATUS_META: Record<FaultyEntityWorkflowStatus, WorkflowStatusMeta> = {
  [FaultyEntityWorkflowStatus.IDENTIFIED]: {
    label: 'Identified',
    colorClass:
      'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800',
    icon: Eye,
    tooltip: 'Entity flagged for investigation.',
  },
  [FaultyEntityWorkflowStatus.UNDER_INSPECTION]: {
    label: 'Under Inspection',
    colorClass:
      'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950 dark:text-orange-300 dark:border-orange-800',
    icon: Search,
    tooltip: 'Entity is being inspected.',
  },
  [FaultyEntityWorkflowStatus.CONFIRMED_FAULTY]: {
    label: 'Confirmed Fault',
    colorClass:
      'bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-300 dark:border-red-800',
    icon: AlertTriangle,
    tooltip: 'Root cause confirmed.',
  },
  [FaultyEntityWorkflowStatus.UNDER_REPAIR]: {
    label: 'Under Repair',
    colorClass:
      'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950 dark:text-purple-300 dark:border-purple-800',
    icon: Hammer,
    tooltip: 'Repair activity in progress.',
  },
  [FaultyEntityWorkflowStatus.REPAIRED]: {
    label: 'Repaired',
    colorClass:
      'bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-300 dark:border-green-800',
    icon: CheckCheck,
    tooltip: 'Entity repaired successfully.',
  },
  [FaultyEntityWorkflowStatus.REPLACED]: {
    label: 'Replaced',
    colorClass:
      'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950 dark:text-indigo-300 dark:border-indigo-800',
    icon: Replace,
    tooltip: 'Entity replaced with a new component.',
  },
  [FaultyEntityWorkflowStatus.NO_FAULT_FOUND]: {
    label: 'No Fault Found',
    colorClass:
      'bg-gray-50 text-gray-700 border-gray-200 dark:bg-gray-950 dark:text-gray-300 dark:border-gray-800',
    icon: CircleOff,
    tooltip: 'Inspection completed with no fault found.',
  },
};

export const ACTION_TYPE_META: Record<string, WorkflowStatusMeta> = {
  inspection: {
    label: 'Inspection',
    colorClass: 'bg-sky-50 text-sky-700 border-sky-200',
    icon: Search,
    tooltip: 'Visual or diagnostic inspection.',
  },
  disassembly: {
    label: 'Disassembly',
    colorClass: 'bg-orange-50 text-orange-700 border-orange-200',
    icon: Layers,
    tooltip: 'Component disassembly.',
  },
  repair: {
    label: 'Repair',
    colorClass: 'bg-purple-50 text-purple-700 border-purple-200',
    icon: Wrench,
    tooltip: 'Repair work performed.',
  },
  replacement: {
    label: 'Replacement',
    colorClass: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    icon: Replace,
    tooltip: 'Component replacement.',
  },
  testing: {
    label: 'Testing',
    colorClass: 'bg-violet-50 text-violet-700 border-violet-200',
    icon: TestTube2,
    tooltip: 'Functional or verification testing.',
  },
  cleaning: {
    label: 'Cleaning',
    colorClass: 'bg-teal-50 text-teal-700 border-teal-200',
    icon: Package,
    tooltip: 'Cleaning performed.',
  },
  recalibration: {
    label: 'Recalibration',
    colorClass: 'bg-cyan-50 text-cyan-700 border-cyan-200',
    icon: Settings,
    tooltip: 'Recalibration performed.',
  },
  assembly: {
    label: 'Assembly',
    colorClass: 'bg-blue-50 text-blue-700 border-blue-200',
    icon: Layers,
    tooltip: 'Assembly work performed.',
  },
  software_update: {
    label: 'Software Update',
    colorClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    icon: Cpu,
    tooltip: 'Software or firmware update.',
  },
  configuration_change: {
    label: 'Configuration Change',
    colorClass: 'bg-amber-50 text-amber-700 border-amber-200',
    icon: Settings,
    tooltip: 'Configuration change applied.',
  },
  documentation: {
    label: 'Documentation',
    colorClass: 'bg-slate-50 text-slate-700 border-slate-200',
    icon: FileText,
    tooltip: 'Documentation recorded.',
  },
};

export const ACTION_OUTCOME_META: Record<string, WorkflowStatusMeta> = {
  pass: {
    label: 'Pass',
    colorClass:
      'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800',
    icon: CheckCircle2,
    tooltip: 'Action outcome: pass.',
  },
  fail: {
    label: 'Fail',
    colorClass:
      'bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-300 dark:border-red-800',
    icon: AlertTriangle,
    tooltip: 'Action outcome: fail.',
  },
  pending: {
    label: 'Pending',
    colorClass:
      'bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-950 dark:text-yellow-300 dark:border-yellow-800',
    icon: CircleDot,
    tooltip: 'Action outcome pending.',
  },
  inconclusive: {
    label: 'Inconclusive',
    colorClass:
      'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950 dark:text-orange-300 dark:border-orange-800',
    icon: HelpCircle,
    tooltip: 'Action outcome inconclusive.',
  },
  not_applicable: {
    label: 'Not Applicable',
    colorClass:
      'bg-gray-50 text-gray-700 border-gray-200 dark:bg-gray-950 dark:text-gray-300 dark:border-gray-800',
    icon: MinusCircle,
    tooltip: 'Outcome not applicable to this action.',
  },
};

export const RESOLUTION_TYPE_META: Record<string, WorkflowStatusMeta> = {
  repaired: {
    label: 'Repaired',
    colorClass:
      'bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-300 dark:border-green-800',
    icon: CheckCheck,
    tooltip: 'Entity was repaired.',
  },
  replaced: {
    label: 'Replaced',
    colorClass:
      'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950 dark:text-indigo-300 dark:border-indigo-800',
    icon: Replace,
    tooltip: 'Entity was replaced.',
  },
  no_fault_found: {
    label: 'No Fault Found',
    colorClass:
      'bg-gray-50 text-gray-700 border-gray-200 dark:bg-gray-950 dark:text-gray-300 dark:border-gray-800',
    icon: CircleOff,
    tooltip: 'No fault found during investigation.',
  },
  decommissioned: {
    label: 'Decommissioned',
    colorClass:
      'bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
    icon: Archive,
    tooltip: 'Entity decommissioned.',
  },
};

export const POTENTIALLY_AFFECTED_META: WorkflowStatusMeta = {
  label: 'Potentially Affected',
  colorClass:
    'bg-amber-50 text-amber-800 border-amber-300 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-700',
  icon: AlertTriangle,
  tooltip: 'Descendant of reported fault; not individually inspected.',
};

export function getCaseStatusMeta(status: MaintenanceCaseWorkflowStatus): WorkflowStatusMeta {
  return CASE_STATUS_META[status];
}

export function getFaultyEntityStatusMeta(status: FaultyEntityWorkflowStatus): WorkflowStatusMeta {
  return FAULTY_ENTITY_STATUS_META[status];
}

export function getActionTypeMeta(actionType: string): WorkflowStatusMeta {
  return (
    ACTION_TYPE_META[actionType] ?? {
      label: actionType.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
      colorClass: 'bg-secondary text-secondary-foreground border-border',
      icon: CircleDot,
      tooltip: actionType,
    }
  );
}

export function getActionOutcomeMeta(outcome: string): WorkflowStatusMeta {
  return (
    ACTION_OUTCOME_META[outcome] ?? {
      label: outcome.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
      colorClass: 'bg-secondary text-secondary-foreground border-border',
      icon: CircleDot,
      tooltip: outcome,
    }
  );
}

export function getResolutionTypeMeta(resolutionType: string): WorkflowStatusMeta | null {
  if (resolutionType === 'clear') return null;
  return (
    RESOLUTION_TYPE_META[resolutionType] ?? {
      label: resolutionType.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
      colorClass: 'bg-secondary text-secondary-foreground border-border',
      icon: CircleDot,
      tooltip: resolutionType,
    }
  );
}

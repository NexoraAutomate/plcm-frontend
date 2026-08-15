/**
 * Spec 00 — canonical item + project workflow status vocabulary.
 * Display labels stay aligned with codes (no parallel names like "In Stock").
 */

export const ItemStatus = {
  AVAILABLE: 'AVAILABLE',
  RESERVED: 'RESERVED',
  ISSUED: 'ISSUED',
  INSTALLATION_IN_PROGRESS: 'INSTALLATION_IN_PROGRESS',
  UNDER_TESTING_REVIEW: 'UNDER_TESTING_REVIEW',
  INSTALLED_VERIFIED: 'INSTALLED_VERIFIED',
  RETURNED: 'RETURNED',
  INSPECTION: 'INSPECTION',
  REUSABLE: 'REUSABLE',
  REPAIRABLE: 'REPAIRABLE',
  SCRAPPED: 'SCRAPPED',
} as const;

export type ItemStatusCode = (typeof ItemStatus)[keyof typeof ItemStatus];

export const ProjectWorkflowStatus = {
  DRAFT: 'DRAFT',
  APPROVED: 'APPROVED',
  HIERARCHY_GENERATED: 'HIERARCHY_GENERATED',
  READY_FOR_INVENTORY: 'READY_FOR_INVENTORY',
  CANCELLED: 'CANCELLED',
  COMPLETED: 'COMPLETED',
  READY_TO_DELIVER: 'READY_TO_DELIVER',
} as const;

export type ProjectWorkflowStatusCode =
  (typeof ProjectWorkflowStatus)[keyof typeof ProjectWorkflowStatus];

export function isProjectCancelled(statusName?: string | null): boolean {
  return statusName === ProjectWorkflowStatus.CANCELLED;
}

export const ITEM_STATUS_LABELS: Record<ItemStatusCode, string> = {
  AVAILABLE: 'Available',
  RESERVED: 'Reserved',
  ISSUED: 'Issued',
  INSTALLATION_IN_PROGRESS: 'Installation In Progress',
  UNDER_TESTING_REVIEW: 'Under Testing / Review',
  INSTALLED_VERIFIED: 'Installed Verified',
  RETURNED: 'Returned',
  INSPECTION: 'Inspection',
  REUSABLE: 'Reusable',
  REPAIRABLE: 'Repairable',
  SCRAPPED: 'Scrapped',
};

export const PROJECT_STATUS_LABELS: Record<ProjectWorkflowStatusCode, string> = {
  DRAFT: 'Draft',
  APPROVED: 'Approved',
  HIERARCHY_GENERATED: 'Hierarchy Generated',
  READY_FOR_INVENTORY: 'Ready For Inventory',
  CANCELLED: 'Cancelled',
  COMPLETED: 'Completed',
  READY_TO_DELIVER: 'Ready To Deliver',
};

export const WORKFLOW_STATUS_LABELS: Record<string, string> = {
  ...ITEM_STATUS_LABELS,
  ...PROJECT_STATUS_LABELS,
};

export const ITEM_STATUS_COLORS: Record<ItemStatusCode, string> = {
  AVAILABLE: '#548235',
  RESERVED: '#2E75B6',
  ISSUED: '#0070C0',
  INSTALLATION_IN_PROGRESS: '#C55A11',
  UNDER_TESTING_REVIEW: '#BF9000',
  INSTALLED_VERIFIED: '#00B050',
  RETURNED: '#7030A0',
  INSPECTION: '#ED7D31',
  REUSABLE: '#70AD47',
  REPAIRABLE: '#C55A11',
  SCRAPPED: '#595959',
};

export const PROJECT_STATUS_COLORS: Record<ProjectWorkflowStatusCode, string> = {
  DRAFT: '#7F7F7F',
  APPROVED: '#00B050',
  HIERARCHY_GENERATED: '#2E75B6',
  READY_FOR_INVENTORY: '#548235',
  CANCELLED: '#C00000',
  COMPLETED: '#375623',
  READY_TO_DELIVER: '#2F5496',
};

export const WORKFLOW_STATUS_COLORS: Record<string, string> = {
  ...ITEM_STATUS_COLORS,
  ...PROJECT_STATUS_COLORS,
};

/** Normalize free-form status strings toward Spec codes when possible. */
export function normalizeWorkflowStatusCode(status: string | null | undefined): string | null {
  if (!status) return null;
  const trimmed = status.trim();
  if (!trimmed) return null;
  const upper = trimmed.toUpperCase().replace(/\s+/g, '_').replace(/\//g, '_').replace(/_+/g, '_');
  if (WORKFLOW_STATUS_LABELS[upper]) return upper;
  // Already a known display label → map back to code
  const fromLabel = Object.entries(WORKFLOW_STATUS_LABELS).find(
    ([, label]) => label.toLowerCase() === trimmed.toLowerCase()
  );
  return fromLabel ? fromLabel[0] : null;
}

/**
 * Human label for badges. Spec codes → Spec labels.
 * Unknown legacy names (Initiation, In Stock, …) pass through unchanged.
 */
export function workflowStatusLabel(status: string | null | undefined): string {
  if (!status) return 'Unknown';
  const code = normalizeWorkflowStatusCode(status);
  if (code && WORKFLOW_STATUS_LABELS[code]) return WORKFLOW_STATUS_LABELS[code];
  return status;
}

export function workflowStatusColor(status: string | null | undefined): string | null {
  const code = normalizeWorkflowStatusCode(status);
  if (code && WORKFLOW_STATUS_COLORS[code]) return WORKFLOW_STATUS_COLORS[code];
  return null;
}

export const ALL_ITEM_STATUSES = Object.values(ItemStatus);
export const ALL_PROJECT_WORKFLOW_STATUSES = Object.values(ProjectWorkflowStatus);

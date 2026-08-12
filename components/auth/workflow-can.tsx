'use client';

import type { ReactNode } from 'react';
import { Can } from '@/components/auth/can';
import {
  ROLE,
  type WorkflowRoleCode,
  roleNamesFor,
} from '@/lib/workflow-roles';

interface WorkflowCanProps {
  /** Spec role code(s): ADMIN | PD | HM | IM | DEV */
  role: WorkflowRoleCode | WorkflowRoleCode[];
  /** Optional workflow / legacy permission gate (OR with role when both set via Can). */
  permission?: string | string[];
  children: ReactNode;
  fallback?: ReactNode;
}

/**
 * Spec 00 shell — hide actions unless the user has a workflow role (and optional permission).
 * Example: <WorkflowCan role="HM" permission={P.hierarchy_generate}>...</WorkflowCan>
 */
export function WorkflowCan({ role, permission, children, fallback = null }: WorkflowCanProps) {
  const codes = Array.isArray(role) ? role : [role];
  const dbNames = roleNamesFor(...codes);
  return (
    <Can role={dbNames} permission={permission} fallback={fallback}>
      {children}
    </Can>
  );
}

export { ROLE };

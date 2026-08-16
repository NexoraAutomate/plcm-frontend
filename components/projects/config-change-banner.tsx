'use client';

import Link from 'next/link';
import { AlertTriangle, GitBranch, Link2 } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import type { Project } from '@/lib/models';
import { CONTROL_RULE, isConfigSealed } from '@/lib/config-change';
import {
  ProjectWorkflowStatus,
  isProjectSuperseded,
} from '@/lib/workflow-status';

type Props = {
  project: Project;
};

export function ConfigChangeBanner({ project }: Props) {
  const sealed = isConfigSealed(project.status_name);
  const superseded = isProjectSuperseded(project.status_name);

  return (
    <div className="space-y-3">
      {sealed && project.status_name !== ProjectWorkflowStatus.DRAFT ? (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Configuration control rule</AlertTitle>
          <AlertDescription>{CONTROL_RULE}</AlertDescription>
        </Alert>
      ) : null}

      {superseded ? (
        <Alert>
          <GitBranch className="h-4 w-4" />
          <AlertTitle>Project superseded</AlertTitle>
          <AlertDescription>
            This project remains readable for traceability. Reserve, issue, and
            generate are blocked.
            {project.successor_project_id ? (
              <>
                {' '}
                Successor:{' '}
                <Link
                  href={`/projects/${project.successor_project_id}`}
                  className="font-medium underline underline-offset-2"
                >
                  Project #{project.successor_project_id}
                </Link>
              </>
            ) : null}
          </AlertDescription>
        </Alert>
      ) : null}

      {project.predecessor_project_id ? (
        <Alert>
          <Link2 className="h-4 w-4" />
          <AlertTitle>Created from a configuration change</AlertTitle>
          <AlertDescription>
            Predecessor{' '}
            <Link
              href={`/projects/${project.predecessor_project_id}`}
              className="font-medium underline underline-offset-2"
            >
              Project #{project.predecessor_project_id}
            </Link>{' '}
            stays traceable. Approve and generate hierarchy on this new project.
          </AlertDescription>
        </Alert>
      ) : null}
    </div>
  );
}

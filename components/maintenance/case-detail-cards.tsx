'use client';

import { useMemo } from 'react';
import { CaseProgressStepper } from '@/components/maintenance/case-progress-stepper';
import {
  buildEntityDisplayContexts,
  getCaseDisplayStatus,
} from '@/lib/maintenance-workflow';
import type { FaultyEntity, MaintenanceAction, MaintenanceCase } from '@/lib/models';

interface CaseDetailCardsProps {
  maintenanceCase: MaintenanceCase;
  entities: FaultyEntity[];
  actions: MaintenanceAction[];
}

export function CaseDetailCards({
  maintenanceCase,
  entities,
  actions,
}: CaseDetailCardsProps) {
  const contexts = useMemo(
    () => buildEntityDisplayContexts(entities, actions),
    [entities, actions]
  );
  const displayStatus = useMemo(
    () => getCaseDisplayStatus(maintenanceCase, contexts, actions),
    [maintenanceCase, contexts, actions]
  );

  return <CaseProgressStepper displayStatus={displayStatus} />;
}

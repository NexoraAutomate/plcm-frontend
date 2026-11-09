'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  CaseProgressStepper,
  type TrackAProgress,
} from '@/components/maintenance/case-progress-stepper';
import { maintenanceCases } from '@/lib/api';
import {
  buildEntityDisplayContexts,
  getCaseDisplayStatus,
} from '@/lib/maintenance-workflow';
import type { FaultyEntity, MaintenanceAction, MaintenanceCase } from '@/lib/models';

interface CaseDetailCardsProps {
  maintenanceCase: MaintenanceCase;
  entities: FaultyEntity[];
  actions: MaintenanceAction[];
  /**
   * Optional live progress from DualTrackBoard. When omitted/null, this card
   * loads Track A from the dual-track API so existing cases still show the branch.
   */
  trackAProgress?: TrackAProgress | null;
  /** Bump with dual-track refresh so the stepper stays in sync. */
  refreshKey?: number;
}

function progressFromBoard(data: {
  track_a?: {
    status?: string | null;
    assigned_me_id?: number | null;
    reservations?: unknown[] | null;
  } | null;
  track_a_status?: string | null;
}): TrackAProgress | null {
  if (!data.track_a) return null;
  const status = data.track_a.status ?? data.track_a_status ?? null;
  if (!status) return null;
  return {
    status,
    assignedMeId: data.track_a.assigned_me_id ?? null,
    hasReservation: (data.track_a.reservations?.length ?? 0) > 0,
  };
}

export function CaseDetailCards({
  maintenanceCase,
  entities,
  actions,
  trackAProgress: trackAProgressProp = null,
  refreshKey = 0,
}: CaseDetailCardsProps) {
  const [fetchedProgress, setFetchedProgress] = useState<TrackAProgress | null>(null);

  const contexts = useMemo(
    () => buildEntityDisplayContexts(entities, actions),
    [entities, actions]
  );
  const displayStatus = useMemo(
    () => getCaseDisplayStatus(maintenanceCase, contexts, actions),
    [maintenanceCase, contexts, actions]
  );

  useEffect(() => {
    let cancelled = false;
    const caseId = maintenanceCase.id;
    if (!Number.isFinite(caseId)) {
      setFetchedProgress(null);
      return;
    }

    const load = async () => {
      try {
        const { data } = await maintenanceCases.getDualTrack(caseId);
        if (cancelled) return;
        setFetchedProgress(progressFromBoard(data));
      } catch {
        if (!cancelled) setFetchedProgress(null);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [maintenanceCase.id, refreshKey]);

  // Prefer live board updates when present; otherwise use fetched existing Track A.
  const trackAProgress = trackAProgressProp?.status ? trackAProgressProp : fetchedProgress;

  return (
    <CaseProgressStepper
      displayStatus={displayStatus}
      skipToClosed={Boolean(maintenanceCase.workflow_skip_to_closed)}
      skipFromStatus={maintenanceCase.workflow_skip_from_status}
      trackAProgress={trackAProgress}
    />
  );
}

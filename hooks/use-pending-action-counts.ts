'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import * as api from '@/lib/api';
import { WORKFLOW_POLL_MS } from '@/lib/data-loading';
import { queryKeys } from '@/hooks/queries/query-keys';
import type { PendingActionCounts } from '@/lib/models';

const EMPTY_COUNTS: PendingActionCounts = {
  verify_queue: 0,
  my_assignments: 0,
  issue_queue: 0,
  inspect_queue: 0,
  issuances: 0,
  projects: 0,
  config_changes: 0,
  shortages: 0,
  notifications: 0,
};

/** Map sidebar href → pending-action count field. */
export const PENDING_COUNT_BY_HREF: Record<string, keyof PendingActionCounts> = {
  '/verify-queue': 'verify_queue',
  '/my-assignments': 'my_assignments',
  '/issue-queue': 'issue_queue',
  '/inspect-queue': 'inspect_queue',
  '/inventory/issuances': 'issuances',
  '/projects': 'projects',
  '/config-changes': 'config_changes',
  '/shortages': 'shortages',
  '/notifications': 'notifications',
};

async function fetchPendingActionCounts(): Promise<PendingActionCounts> {
  const response = await api.pendingActions.counts();
  return response.data;
}

export function usePendingActionCounts(enabled = true) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: queryKeys.pendingActionCounts(),
    queryFn: fetchPendingActionCounts,
    enabled,
    staleTime: WORKFLOW_POLL_MS,
    refetchInterval: WORKFLOW_POLL_MS,
    refetchOnWindowFocus: true,
    retry: 1,
  });

  const invalidate = useCallback(() => {
    return queryClient.invalidateQueries({
      queryKey: queryKeys.pendingActionCounts(),
    });
  }, [queryClient]);

  const counts = query.data ?? EMPTY_COUNTS;

  const countForHref = useCallback(
    (href: string) => {
      const key = PENDING_COUNT_BY_HREF[href];
      if (!key) return 0;
      return Math.max(0, counts[key] ?? 0);
    },
    [counts]
  );

  const sumForHrefs = useCallback(
    (hrefs: string[]) =>
      hrefs.reduce((total, href) => total + countForHref(href), 0),
    [countForHref]
  );

  return {
    ...query,
    counts,
    countForHref,
    sumForHrefs,
    invalidate,
  };
}

/** Invalidate sidebar pending badges after a queue/workflow action. */
export function invalidatePendingActionCounts(
  queryClient: ReturnType<typeof useQueryClient>
) {
  return queryClient.invalidateQueries({
    queryKey: queryKeys.pendingActionCounts(),
  });
}

'use client';

import dynamic from 'next/dynamic';
import { HelpCircle, ListChecks, Wrench } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PageDataRefreshProvider, PageRefreshButton } from '@/components/page-data-refresh';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

const MmhdAssignmentsPanel = dynamic(
  () =>
    import('@/components/maintenance/mmhd-assignments-panel').then((m) => m.MmhdAssignmentsPanel),
  {
    ssr: false,
    loading: () => (
      <p className="py-8 text-center text-sm text-muted-foreground">
        Loading maintenance assignments…
      </p>
    ),
  }
);

const RecallQueuePanel = dynamic(
  () =>
    import('@/components/inventory/recall-queue-panel').then((m) => m.RecallQueuePanel),
  {
    ssr: false,
    loading: () => (
      <p className="py-8 text-center text-sm text-muted-foreground">Loading recall returns…</p>
    ),
  }
);

export default function MmhdAssignmentsPage() {
  return (
    <PageDataRefreshProvider>
      <div className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  className="inline-flex items-center gap-1.5 rounded-sm text-left outline-none hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <h1 className="text-2xl font-semibold tracking-tight">MMHD Assignments</h1>
                  <HelpCircle className="h-4 w-4 text-muted-foreground" aria-hidden />
                  <span className="sr-only">
                    Maintenance dual-track tasks for PD, ME, IE, and IM — approvals, assign, and
                    issue actions.
                  </span>
                </button>
              </TooltipTrigger>
              <TooltipContent className="max-w-sm text-pretty">
                Maintenance dual-track tasks for PD, ME, IE, and IM. Act inline, or open the case
                for full board context.
              </TooltipContent>
            </Tooltip>
          </div>
          <PageRefreshButton />
        </div>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Wrench className="h-4 w-4" />
              Maintenance assignments
            </CardTitle>
            <CardDescription>
              Dual-track PD / ME / IE / IM tasks. Act inline, or open the case for full board
              context.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <MmhdAssignmentsPanel />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ListChecks className="h-4 w-4" />
              Recall returns
            </CardTitle>
            <CardDescription>
              Confirm physical return of issued units when a project is cancelled.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <RecallQueuePanel mine />
          </CardContent>
        </Card>
      </div>
    </PageDataRefreshProvider>
  );
}

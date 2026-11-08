'use client';

import dynamic from 'next/dynamic';
import { HelpCircle, ListChecks } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PageDataRefreshProvider, PageRefreshButton } from '@/components/page-data-refresh';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

const MyAssignmentsPanel = dynamic(
  () =>
    import('@/components/inventory/my-assignments-panel').then((m) => m.MyAssignmentsPanel),
  {
    ssr: false,
    loading: () => (
      <p className="py-8 text-center text-sm text-muted-foreground">Loading assignments…</p>
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

export default function BhdAssignmentsPage() {
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
                  <h1 className="text-2xl font-semibold tracking-tight">BHD assignments</h1>
                  <HelpCircle className="h-4 w-4 text-muted-foreground" aria-hidden />
                  <span className="sr-only">
                    Hierarchy items assigned to you by a Hierarchy Manager. Request Inventory
                    Manager handover, then install, test Pass/Fail, and report complete for HM
                    verification.
                  </span>
                </button>
              </TooltipTrigger>
              <TooltipContent className="max-w-sm text-pretty">
                Hierarchy items assigned to you by a Hierarchy Manager. Request Inventory Manager
                handover, then install, test Pass/Fail, and report complete for HM verification.
              </TooltipContent>
            </Tooltip>
          </div>
          <PageRefreshButton />
        </div>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ListChecks className="h-4 w-4" />
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1.5 rounded-sm text-left outline-none hover:text-foreground/90 focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    Assigned items
                    <HelpCircle className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
                    <span className="sr-only">
                      Physical issue stays with Inventory Manager. Assignment can be reverted by
                      HM until the item is issued.
                    </span>
                  </button>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs text-pretty">
                  Physical issue stays with Inventory Manager. Assignment can be reverted by HM
                  until the item is issued.
                </TooltipContent>
              </Tooltip>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <MyAssignmentsPanel />
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

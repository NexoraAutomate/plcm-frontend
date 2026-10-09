'use client';

import dynamic from 'next/dynamic';
import { ListChecks } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PageDataRefreshProvider, PageRefreshButton } from '@/components/page-data-refresh';

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

export default function MyAssignmentsPage() {
  return (
    <PageDataRefreshProvider>
      <div className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">My assignments</h1>
            <p className="text-sm text-muted-foreground">
              Hierarchy items assigned to you by a Hierarchy Manager. Request Inventory Manager
              handover, then install, test Pass/Fail, and report complete for HM verification.
            </p>
          </div>
          <PageRefreshButton />
        </div>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ListChecks className="h-4 w-4" />
              Assigned items
            </CardTitle>
            <CardDescription>
              Physical issue stays with Inventory Manager. Assignment can be reverted by HM until
              the item is issued.
            </CardDescription>
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

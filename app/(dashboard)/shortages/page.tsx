'use client';

import { AlertTriangle } from 'lucide-react';
import { ShortageListPanel } from '@/components/shortages/shortage-list-panel';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PageDataRefreshProvider, PageRefreshButton } from '@/components/page-data-refresh';

export default function ShortagesPage() {
  return (
    <PageDataRefreshProvider>
      <div className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Shortages</h1>
            <p className="text-sm text-muted-foreground">
              Open stock shortages waiting for receipt. First-come demand is auto-reserved when
              matching inventory arrives.
            </p>
          </div>
          <PageRefreshButton />
        </div>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="h-4 w-4" />
              Open shortages
            </CardTitle>
            <CardDescription>
              All waiting Flight / SDLS demand. Inventory managers can add received stock here;
              matching part numbers auto-reserve FCFS.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ShortageListPanel inventoryScope pollMs={12_000} />
          </CardContent>
        </Card>
      </div>
    </PageDataRefreshProvider>
  );
}

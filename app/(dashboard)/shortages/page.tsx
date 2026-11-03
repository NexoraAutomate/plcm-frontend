'use client';

import { WORKFLOW_POLL_MS } from '@/lib/data-loading';

import { useSearchParams } from 'next/navigation';
import { AlertTriangle } from 'lucide-react';
import { ShortageListPanel } from '@/components/shortages/shortage-list-panel';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PageDataRefreshProvider, PageRefreshButton } from '@/components/page-data-refresh';

export default function ShortagesPage() {
  const searchParams = useSearchParams();
  const highlightParam = Number(searchParams.get('shortage'));
  const highlightId = Number.isFinite(highlightParam) && highlightParam > 0 ? highlightParam : undefined;

  return (
    <PageDataRefreshProvider>
      <div className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Shortages</h1>
            <p className="text-sm text-muted-foreground">
              Open stock shortages waiting for receipt. First-come demand is auto-reserved when
              matching inventory arrives (including stock added on the Inventory page).
            </p>
          </div>
          <PageRefreshButton title="Refresh and auto-fulfill shortages from available stock" />
        </div>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="h-4 w-4" />
              Shortages
            </CardTitle>
            <CardDescription>
              Mini dashboard plus Flight/SDLS or item-wise views. Refresh also FCFS
              auto-reserves against warehouse stock on hand.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ShortageListPanel
              inventoryScope
              pollMs={WORKFLOW_POLL_MS}
              highlightId={highlightId}
            />
          </CardContent>
        </Card>
      </div>
    </PageDataRefreshProvider>
  );
}

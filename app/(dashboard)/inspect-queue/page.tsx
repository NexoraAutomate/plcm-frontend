'use client';

import { SearchCheck, Undo2 } from 'lucide-react';
import { InspectQueuePanel } from '@/components/inventory/inspect-queue-panel';
import { RecallQueuePanel } from '@/components/inventory/recall-queue-panel';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function InspectQueuePage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Inspect queue</h1>
        <p className="text-sm text-muted-foreground">
          Returned units from defect rework, cancelled-project recall, and
          configuration-change returns. Inspect, then disposition reusable,
          repairable, or scrapped.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Undo2 className="h-4 w-4" />
            Project recall
          </CardTitle>
          <CardDescription>
            Issued inventory recalled because a project was cancelled or is
            changing configuration. Reusable stock returns to Available; scrapped
            serials stay out of stock.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RecallQueuePanel />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <SearchCheck className="h-4 w-4" />
            Open rework
          </CardTitle>
          <CardDescription>
            Defect loop for active installs — not project-wide recall.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <InspectQueuePanel />
        </CardContent>
      </Card>
    </div>
  );
}

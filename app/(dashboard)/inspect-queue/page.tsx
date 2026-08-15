'use client';

import { SearchCheck } from 'lucide-react';
import { InspectQueuePanel } from '@/components/inventory/inspect-queue-panel';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function InspectQueuePage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Inspect queue</h1>
        <p className="text-sm text-muted-foreground">
          Returned failed units. Inspect, disposition, then re-issue a repaired serial or a
          replacement with a signature.
        </p>
      </div>
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

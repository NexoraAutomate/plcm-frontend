'use client';

import { AlertTriangle } from 'lucide-react';
import { ShortageListPanel } from '@/components/shortages/shortage-list-panel';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function ShortagesPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Shortages</h1>
        <p className="text-sm text-muted-foreground">
          Open stock shortages waiting for receipt. First-come demand is auto-reserved when
          matching inventory arrives.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <AlertTriangle className="h-4 w-4" />
            Open shortages
          </CardTitle>
          <CardDescription>
            All waiting Flight / SDLS demand. Receipt of matching part numbers auto-reserves
            FCFS.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ShortageListPanel inventoryScope pollMs={12_000} />
        </CardContent>
      </Card>
    </div>
  );
}

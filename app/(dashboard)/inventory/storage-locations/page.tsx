'use client';

import { MapPinned } from 'lucide-react';
import { StorageLocationsPanel } from '@/components/inventory/storage-locations-panel';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PageDataRefreshProvider, PageRefreshButton } from '@/components/page-data-refresh';

export default function StorageLocationsPage() {
  return (
    <PageDataRefreshProvider>
      <div className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Storage locations</h1>
            <p className="text-sm text-muted-foreground">
              Build the Room → Cabinet → Rack tree used when stocking and locating inventory.
            </p>
          </div>
          <PageRefreshButton />
        </div>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <MapPinned className="h-4 w-4" />
              Location tree
            </CardTitle>
            <CardDescription>
              Each Room can have many Cabinets; each Cabinet can have many Racks.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <StorageLocationsPanel />
          </CardContent>
        </Card>
      </div>
    </PageDataRefreshProvider>
  );
}

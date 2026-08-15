'use client';

import { ListChecks } from 'lucide-react';
import { MyAssignmentsPanel } from '@/components/inventory/my-assignments-panel';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function MyAssignmentsPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">My assignments</h1>
        <p className="text-sm text-muted-foreground">
          Hierarchy items assigned to you by a Hierarchy Manager. Request Inventory Manager
          handover, then install, test Pass/Fail, and report complete for HM verification.
        </p>
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
    </div>
  );
}

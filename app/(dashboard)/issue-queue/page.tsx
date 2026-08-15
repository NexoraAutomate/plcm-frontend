'use client';

import { ClipboardPen } from 'lucide-react';
import { IssueQueuePanel } from '@/components/inventory/issue-queue-panel';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function IssueQueuePage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Issue queue</h1>
        <p className="text-sm text-muted-foreground">
          Developer requests for reserved stock. Issue only with a digital signature or hard-copy
          acknowledgment.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ClipboardPen className="h-4 w-4" />
            Pending requests
          </CardTitle>
          <CardDescription>
            Assigned and reserved items waiting for Inventory Manager issue.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <IssueQueuePanel />
        </CardContent>
      </Card>
    </div>
  );
}

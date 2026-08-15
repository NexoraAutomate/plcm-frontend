'use client';

import { ShieldCheck } from 'lucide-react';
import { VerifyQueuePanel } from '@/components/inventory/verify-queue-panel';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function VerifyQueuePage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Verify queue</h1>
        <p className="text-sm text-muted-foreground">
          Items the Developer has tested Pass and reported complete. Verify to set Installed
          Verified. Verify stays disabled until complete is reported.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldCheck className="h-4 w-4" />
            Waiting for HM verification
          </CardTitle>
          <CardDescription>
            INSTALLED_VERIFIED is set only after testing and your verification.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <VerifyQueuePanel />
        </CardContent>
      </Card>
    </div>
  );
}

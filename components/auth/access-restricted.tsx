'use client';

import { useRouter } from 'next/navigation';
import { ShieldAlert, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface AccessRestrictedProps {
  title?: string;
  message?: string;
  showGoBack?: boolean;
}

/**
 * Professional authorization page shown when a user lacks view permission.
 */
export function AccessRestricted({
  title = 'Access Restricted',
  message = 'You do not have permission to view this page.',
  showGoBack = true,
}: AccessRestrictedProps) {
  const router = useRouter();

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
        <ShieldAlert className="h-8 w-8 text-muted-foreground" aria-hidden />
      </div>
      <h1 className="mt-6 text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">{message}</p>
      <p className="mt-1 max-w-md text-sm text-muted-foreground">
        If you believe this is incorrect, please contact your administrator.
      </p>
      {showGoBack ? (
        <Button variant="outline" className="mt-8 gap-2" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
          Go Back
        </Button>
      ) : null}
    </div>
  );
}
